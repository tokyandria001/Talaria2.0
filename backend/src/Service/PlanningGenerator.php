<?php

namespace App\Service;

use App\Entity\Activity;
use App\Entity\Place;
use App\Entity\Trip;
use App\Entity\User;
use App\Repository\PlaceRepository;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Remplissage automatique du planning d'un voyage :
 * 2 activités par jour (matin + midi), choisies selon les préférences de l'utilisateur.
 * Les créneaux déjà occupés (activités ajoutées à la main) ne sont jamais écrasés.
 */
class PlanningGenerator
{
    /** Rayon de recherche des lieux autour de la destination (~25 km) */
    private const RADIUS_DEG = 0.25;

    /** Au-delà, on ne génère pas (évite des milliers d'activités sur une saisie erronée) */
    private const MAX_DAYS = 60;

    /** Tags de lieux adaptés à une activité du matin / à un déjeuner */
    private const MORNING_TAGS = ['visite', 'culture', 'musee', 'plage', 'sport', 'activite', 'nature'];
    private const LUNCH_TAGS   = ['restaurant'];

    /** Activités génériques (sans lieu) quand la carte n'a rien à proposer, par centre d'intérêt */
    private const MORNING_FALLBACKS = [
        'culture'     => ['Visite culturelle (musée, monument)', 'visite'],
        'nature'      => ['Balade nature', 'visite'],
        'sport'       => ['Activité sportive', 'sport'],
        'aventure'    => ['Activité aventure', 'sport'],
        'plage'       => ['Matinée à la plage', 'plage'],
        'shopping'    => ['Shopping', null],
        'gastronomie' => ['Marché local', 'visite'],
    ];
    private const DEFAULT_MORNING = ['Découverte du quartier', 'visite'];

    /** Activités souhaitées pour le voyage (assistant) : tags de lieux et activité générique associés */
    private const WISH_TAGS = [
        'plongee'    => ['plage', 'sport', 'activite'],
        'randonnee'  => ['nature'],
        'motorise'   => ['activite', 'sport'],
        'excursions' => ['visite', 'musee', 'culture'],
    ];
    private const WISH_FALLBACKS = [
        'plongee'    => ['Plongée', 'plage'],
        'randonnee'  => ['Randonnée', 'nature'],
        'motorise'   => ['Activité motorisée (quad, jet-ski...)', 'activite'],
        'excursions' => ['Excursion touristique', 'visite'],
    ];
    private const DEFAULT_LUNCH   = ['Déjeuner — restaurant à choisir', 'restaurant'];

    public function __construct(
        private EntityManagerInterface $em,
        private PlaceRepository $places,
    ) {}

    /**
     * @param float|null $lat,$lng Coordonnées de la destination (géocodées par le client).
     *                             Sans elles, seules des activités génériques sont proposées.
     * @return int Nombre d'activités créées
     */
    public function generate(Trip $trip, User $user, ?float $lat, ?float $lng, bool $replaceAuto = false): int
    {
        $repo = $this->em->getRepository(Activity::class);

        if ($replaceAuto) {
            foreach ($repo->findBy(['trip' => $trip, 'isAuto' => true]) as $auto) {
                $this->em->remove($auto);
            }
            $this->em->flush();
        }

        $occupied   = [];
        $usedPlaces = [];
        foreach ($repo->findBy(['trip' => $trip]) as $existing) {
            // Les propositions en vote ou refusées ne réservent pas de créneau
            if (!$existing->isInPlanning()) continue;
            $occupied[$existing->getDate()->format('Y-m-d') . '|' . $existing->getSlot()] = true;
            if ($existing->getPlace()) $usedPlaces[$existing->getPlace()->getId()] = true;
        }

        [$morningPool, $lunchPool] = $lat !== null && $lng !== null
            ? $this->candidatePools($user, $lat, $lng, $trip)
            : [[], []];

        $morningFallbacks = $this->morningFallbacksFor($user, $trip);

        $created = 0;
        $dayIndex = 0;
        $day = $trip->getStartDate();
        while ($day <= $trip->getEndDate() && $dayIndex < self::MAX_DAYS) {
            $key = $day->format('Y-m-d');

            if (!isset($occupied[$key . '|matin'])) {
                $place = $this->takeNext($morningPool, $usedPlaces);
                $fallback = $morningFallbacks[$dayIndex % count($morningFallbacks)];
                $this->persist($trip, $day, 'matin', $place, $fallback);
                $created++;
            }

            if (!isset($occupied[$key . '|midi'])) {
                $place = $this->takeNext($lunchPool, $usedPlaces);
                $this->persist($trip, $day, 'midi', $place, self::DEFAULT_LUNCH);
                $created++;
            }

            $day = $day->modify('+1 day');
            $dayIndex++;
        }

        $this->em->flush();

        return $created;
    }

    /** Lieux autour de la destination, triés par pertinence (préférences) puis popularité. */
    private function candidatePools(User $user, float $lat, float $lng, Trip $trip): array
    {
        $bbox = [$lat - self::RADIUS_DEG, $lng - self::RADIUS_DEG, $lat + self::RADIUS_DEG, $lng + self::RADIUS_DEG];

        // Les activités souhaitées pour ce voyage passent en premier, puis les autres lieux du matin
        $wishTags = array_values(array_unique(array_merge(...array_map(
            fn (string $w) => self::WISH_TAGS[$w] ?? [],
            $trip->getWishedActivities() ?: ['_'],
        ))));
        $morning = $wishTags ? $this->places->findByFilters($wishTags, '', $bbox, $user) : [];
        $wishedIds = array_map(fn ($p) => $p->getId(), $morning);
        foreach ($this->places->findByFilters(self::MORNING_TAGS, '', $bbox, $user) as $place) {
            if (!in_array($place->getId(), $wishedIds, true)) $morning[] = $place;
        }

        return [$morning, $this->places->findByFilters(self::LUNCH_TAGS, '', $bbox, $user)];
    }

    /** Premier lieu du pool pas encore utilisé dans ce voyage. */
    private function takeNext(array &$pool, array &$usedPlaces): ?Place
    {
        while ($place = array_shift($pool)) {
            if (!isset($usedPlaces[$place->getId()])) {
                $usedPlaces[$place->getId()] = true;
                return $place;
            }
        }
        return null;
    }

    private function morningFallbacksFor(User $user, Trip $trip): array
    {
        // Activités souhaitées pour le voyage d'abord, sinon centres d'intérêt du profil
        $wished = array_values(array_filter(array_map(fn (string $w) => self::WISH_FALLBACKS[$w] ?? null, $trip->getWishedActivities())));
        if ($wished) return $wished;

        $fallbacks = [];
        foreach ($user->getActivityTags() as $tag) {
            if (isset(self::MORNING_FALLBACKS[$tag])) $fallbacks[] = self::MORNING_FALLBACKS[$tag];
        }
        return $fallbacks ?: [self::DEFAULT_MORNING];
    }

    private function persist(Trip $trip, \DateTimeImmutable $day, string $slot, ?Place $place, array $fallback): void
    {
        [$title, $category] = $fallback;

        $activity = (new Activity())
            ->setTrip($trip)
            ->setDate($day)
            ->setSlot($slot)
            ->setTime(\DateTimeImmutable::createFromFormat('!H:i', $slot === 'midi' ? '12:30' : '09:00'))
            ->setIsAuto(true);

        if ($place) {
            $placeCategory = $place->getTags()[0] ?? $category;
            $activity
                ->setPlace($place)
                ->setTitle($place->getName())
                ->setDescription($place->getDescription())
                ->setCategory($placeCategory)
                ->setPrice($place->getAveragePrice() ?? Activity::defaultPriceFor($placeCategory));
        } else {
            $activity->setTitle($title)->setCategory($category)->setPrice(Activity::defaultPriceFor($category));
        }

        $this->em->persist($activity);
    }
}
