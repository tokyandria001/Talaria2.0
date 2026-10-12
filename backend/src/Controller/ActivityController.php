<?php

namespace App\Controller;

use App\Entity\Activity;
use App\Entity\Place;
use App\Entity\Trip;
use App\Entity\User;
use App\Service\PlanningGenerator;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Validator\ValidatorInterface;

#[Route('/api/trips/{tripId}/activities', name: 'api_activities_')]
class ActivityController extends AbstractController
{
    public function __construct(private EntityManagerInterface $em) {}

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
        $this->em->flush();

        return $this->json(null, 204);
    }

    /* ── Helpers ──────────────────────────────── */

    /** Applique les champs présents dans $data. Retourne une réponse d'erreur si invalide. */
    private function apply(Activity $a, array $data): ?JsonResponse
    {
        if (array_key_exists('date', $data)) {
            try {
                $date = (new \DateTimeImmutable($data['date']))->setTime(0, 0);
            } catch (\Exception) {
                return $this->json(['message' => 'Date invalide.'], 400);
            }
            $trip = $a->getTrip();
            if ($date < $trip->getStartDate() || $date > $trip->getEndDate()) {
                return $this->json(['message' => 'La date doit être comprise dans les dates du voyage.'], 400);
            }
            $a->setDate($date);
        }

        if (array_key_exists('placeId', $data)) {
            $place = $data['placeId'] ? $this->em->find(Place::class, (int) $data['placeId']) : null;
            if ($data['placeId'] && !$place) return $this->json(['message' => 'Lieu introuvable.'], 404);
            $a->setPlace($place);
        }

        if (array_key_exists('slot', $data))             $a->setSlot((string) $data['slot']);
        if (array_key_exists('title', $data))            $a->setTitle(trim((string) $data['title']));
        if (array_key_exists('description', $data))      $a->setDescription($data['description'] ?: null);
        if (array_key_exists('category', $data))         $a->setCategory($data['category'] ?: null);
        if (array_key_exists('price', $data))            $a->setPrice($data['price'] !== null && $data['price'] !== '' ? (int) $data['price'] : null);
        if (array_key_exists('hasSpecialPrice', $data))  $a->setHasSpecialPrice((bool) $data['hasSpecialPrice']);
        if (array_key_exists('specialPriceNote', $data)) $a->setSpecialPriceNote($data['specialPriceNote'] ?: null);

        return null;
    }

    private function validationError(iterable $errors): JsonResponse
    {
        $messages = [];
        foreach ($errors as $e) {
            $messages[$e->getPropertyPath()] = $e->getMessage();
        }
        return $this->json(['message' => 'Données invalides.', 'errors' => $messages], 422);
    }

    /** Activités du voyage triées par date puis créneau. */
    private function planning(Trip $trip): array
    {
        $activities = $this->em->getRepository(Activity::class)->findBy(['trip' => $trip]);
        usort($activities, fn(Activity $a, Activity $b) => [$a->sortKey(), $a->getId()] <=> [$b->sortKey(), $b->getId()]);

        return array_map([$this, 'serialize'], $activities);
    }

    private function findOwnedTrip(int $tripId): ?Trip
    {
        /** @var User $me */
        $me   = $this->getUser();
        $trip = $this->em->getRepository(Trip::class)->find($tripId);
        if (!$trip || $trip->getUser()->getId() !== $me->getId()) return null;
        return $trip;
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
