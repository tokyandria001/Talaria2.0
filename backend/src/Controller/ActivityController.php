<?php

namespace App\Controller;

use App\Entity\Activity;
use App\Entity\Place;
use App\Entity\Trip;
use App\Entity\User;
use App\Service\PlanningGenerator;
use App\Service\TripAccess;
use App\Service\UserPresenter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Validator\ValidatorInterface;

#[Route('/api/trips/{tripId}/activities', name: 'api_activities_')]
class ActivityController extends AbstractController
{
    use ApiInputTrait;

    public function __construct(
        private EntityManagerInterface $em,
        private TripAccess $access,
    ) {}

    /* ── List (planning) ──────────────────────── */
    #[Route('', methods: ['GET'])]
    public function list(int $tripId): JsonResponse
    {
        $trip = $this->findOwnedTrip($tripId);
        if (!$trip) return $this->json(['message' => 'Voyage introuvable.'], 404);

        return $this->json($this->planning($trip));
    }

    /* ── Auto-remplissage ─────────────────────── */
    #[Route('/generate', methods: ['POST'])]
    public function generate(int $tripId, Request $req, PlanningGenerator $generator): JsonResponse
    {
        $trip = $this->findOwnedTrip($tripId);
        if (!$trip) return $this->json(['message' => 'Voyage introuvable.'], 404);

        $data = json_decode($req->getContent(), true) ?? [];
        $lat  = isset($data['lat']) && is_numeric($data['lat']) ? (float) $data['lat'] : null;
        $lng  = isset($data['lng']) && is_numeric($data['lng']) ? (float) $data['lng'] : null;

        /** @var User $me */
        $me      = $this->getUser();
        $created = $generator->generate($trip, $me, $lat, $lng, (bool) ($data['replaceAuto'] ?? false));
        if ($created > 0) {
            $this->notifyPlanningChange($trip);
            $this->em->flush();
        }

        return $this->json(['created' => $created, 'activities' => $this->planning($trip)]);
    }

    /* ── Create ───────────────────────────────── */
    #[Route('', methods: ['POST'])]
    public function create(int $tripId, Request $req, ValidatorInterface $validator): JsonResponse
    {
        $trip = $this->findOwnedTrip($tripId);
        if (!$trip) return $this->json(['message' => 'Voyage introuvable.'], 404);

        $data = json_decode($req->getContent(), true) ?? [];
        if (empty($data['date'])) {
            return $this->json(['message' => 'La date de l\'activité est requise.'], 400);
        }

        $activity = (new Activity())->setTrip($trip)->setTitle('');
        if ($error = $this->apply($activity, $data)) return $error;

        // Sans prix fourni : prix moyen prédéfini du tag (lieu de la carte en priorité)
        if (!array_key_exists('price', $data)) {
            $activity->setPrice($activity->getPlace()?->getAveragePrice() ?? Activity::defaultPriceFor($activity->getCategory()));
        }

        $errors = $validator->validate($activity);
        if (count($errors) > 0) return $this->validationError($errors);

        $this->em->persist($activity);
        $this->notifyPlanningChange($trip);
        $this->em->flush();

        return $this->json($this->serialize($activity), 201);
    }

    /* ── Update ───────────────────────────────── */
    #[Route('/{id}', methods: ['PATCH'])]
    public function update(int $tripId, int $id, Request $req, ValidatorInterface $validator): JsonResponse
    {
        $trip = $this->findOwnedTrip($tripId);
        if (!$trip) return $this->json(['message' => 'Voyage introuvable.'], 404);

        $activity = $this->em->getRepository(Activity::class)->findOneBy(['id' => $id, 'trip' => $trip]);
        if (!$activity) return $this->json(['message' => 'Activité introuvable.'], 404);

        $data = json_decode($req->getContent(), true) ?? [];
        if ($error = $this->apply($activity, $data)) return $error;

        // Une activité modifiée à la main n'est plus remplacée par une régénération
        $activity->setIsAuto(false);

        $errors = $validator->validate($activity);
        if (count($errors) > 0) return $this->validationError($errors);

        $this->notifyPlanningChange($trip);
        $this->em->flush();

        return $this->json($this->serialize($activity));
    }

    /* ── Delete ───────────────────────────────── */
    #[Route('/{id}', methods: ['DELETE'])]
    public function delete(int $tripId, int $id): JsonResponse
    {
        $trip = $this->findOwnedTrip($tripId);
        if (!$trip) return $this->json(['message' => 'Voyage introuvable.'], 404);

        $activity = $this->em->getRepository(Activity::class)->findOneBy(['id' => $id, 'trip' => $trip]);
        if (!$activity) return $this->json(['message' => 'Activité introuvable.'], 404);

        $this->em->remove($activity);
        $this->notifyPlanningChange($trip);
        $this->em->flush();

        return $this->json(null, 204);
    }

    /* ── Helpers ──────────────────────────────── */

    /** Applique les champs présents dans $data. Retourne une réponse d'erreur si invalide. */
    private function apply(Activity $a, array $data): ?JsonResponse
    {
        if (array_key_exists('date', $data)) {
            $date = $this->parseDate($data['date'], 'date');
            $trip = $a->getTrip();
            if ($date < $trip->getStartDate() || $date > $trip->getEndDate()) {
                return $this->json(['message' => 'La date doit être comprise dans les dates du voyage.'], 400);
            }
            $a->setDate($date);
        }

        if (array_key_exists('placeId', $data)) {
            $placeId = $this->parseInt($data['placeId'], 'lieu');
            $place = $placeId ? $this->em->find(Place::class, $placeId) : null;
            if ($placeId && !$place) return $this->json(['message' => 'Lieu introuvable.'], 404);
            $a->setPlace($place);
        }

        if (array_key_exists('slot', $data))             $a->setSlot((string) $data['slot']);
        if (array_key_exists('title', $data))            $a->setTitle(trim((string) $data['title']));
        if (array_key_exists('description', $data))      $a->setDescription($data['description'] ?: null);
        if (array_key_exists('category', $data))         $a->setCategory($data['category'] ?: null);
        if (array_key_exists('price', $data))            $a->setPrice($this->parseInt($data['price'], 'prix'));
        if (array_key_exists('hasSpecialPrice', $data))  $a->setHasSpecialPrice((bool) $data['hasSpecialPrice']);
        if (array_key_exists('specialPriceNote', $data)) $a->setSpecialPriceNote($data['specialPriceNote'] ?: null);

        return null;
    }

    /** Activités du voyage triées par date puis créneau. */
    private function planning(Trip $trip): array
    {
        $activities = $this->em->getRepository(Activity::class)->findBy(['trip' => $trip]);
        usort($activities, fn(Activity $a, Activity $b) => [$a->sortKey(), $a->getId()] <=> [$b->sortKey(), $b->getId()]);

        return array_map([$this, 'serialize'], $activities);
    }

    /** Voyage visible par l'utilisateur (créateur ou membre du groupe) : il peut en modifier le planning */
    private function findOwnedTrip(int $tripId): ?Trip
    {
        return $this->access->findVisible($tripId, $this->currentUser());
    }

    /** Prévient les autres membres du groupe (au plus une fois toutes les 10 min par auteur) */
    private function notifyPlanningChange(Trip $trip): void
    {
        $me = $this->currentUser();
        $this->access->notifyGroup($trip, $me, 'trip_update', sprintf(
            '%s a modifié le planning de « %s »',
            UserPresenter::public($me)['displayName'], $trip->getTitle() ?: $trip->getDestination(),
        ), throttle: true);
    }

    private function currentUser(): User
    {
        /** @var User $me */
        $me = $this->getUser();
        return $me;
    }

    private function serialize(Activity $a): array
    {
        $place = $a->getPlace();

        return [
            'id'               => $a->getId(),
            'date'             => $a->getDate()->format('Y-m-d'),
            'slot'             => $a->getSlot(),
            'title'            => $a->getTitle(),
            'description'      => $a->getDescription(),
            'category'         => $a->getCategory(),
            'price'            => $a->getPrice(),
            'hasSpecialPrice'  => $a->hasSpecialPrice(),
            'specialPriceNote' => $a->getSpecialPriceNote(),
            'isAuto'           => $a->isAuto(),
            'place'            => $place ? [
                'id'        => $place->getId(),
                'name'      => $place->getName(),
                'latitude'  => $place->getLatitude(),
                'longitude' => $place->getLongitude(),
            ] : null,
        ];
    }
}
