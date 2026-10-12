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
    private const MORNING_TAGS = ['visite', 'culture', 'plage', 'sport'];
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
            $occupied[$existing->getDate()->format('Y-m-d') . '|' . $existing->getSlot()] = true;
            if ($existing->getPlace()) $usedPlaces[$existing->getPlace()->getId()] = true;
        }

        [$morningPool, $lunchPool] = $lat !== null && $lng !== null
            ? $this->candidatePools($user, $lat, $lng)
            : [[], []];

        $morningFallbacks = $this->morningFallbacksFor($user);

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
    private function candidatePools(User $user, float $lat, float $lng): array
    {
        $bbox = [$lat - self::RADIUS_DEG, $lng - self::RADIUS_DEG, $lat + self::RADIUS_DEG, $lng + self::RADIUS_DEG];

        return [
            $this->places->findByFilters(self::MORNING_TAGS, '', $bbox, $user),
            $this->places->findByFilters(self::LUNCH_TAGS, '', $bbox, $user),
        ];
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

    private function morningFallbacksFor(User $user): array
    {
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
