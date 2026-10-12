<?php

namespace App\Controller;

use App\Entity\Accommodation;
use App\Entity\Trip;
use App\Entity\User;
use App\Service\TripAccess;
use App\Service\UserPresenter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Validator\ValidatorInterface;

#[Route('/api/trips/{tripId}/accommodations', name: 'api_accommodations_')]
class AccommodationController extends AbstractController
{
    use ApiInputTrait;

    public function __construct(
        private EntityManagerInterface $em,
        private TripAccess $access,
    ) {}

    /* ── List ─────────────────────────────────── */
    #[Route('', methods: ['GET'])]
    public function list(int $tripId): JsonResponse
    {
        $trip = $this->findOwnedTrip($tripId);
        if (!$trip) return $this->json(['message' => 'Voyage introuvable.'], 404);

        $accommodations = $this->em->getRepository(Accommodation::class)->findBy(
            ['trip' => $trip],
            ['checkIn' => 'ASC'],
        );

        return $this->json(array_map([$this, 'serialize'], $accommodations));
    }

    /* ── Create ───────────────────────────────── */
    #[Route('', methods: ['POST'])]
    public function create(int $tripId, Request $req, ValidatorInterface $validator): JsonResponse
    {
        $trip = $this->findOwnedTrip($tripId);
        if (!$trip) return $this->json(['message' => 'Voyage introuvable.'], 404);

        $data = json_decode($req->getContent(), true) ?? [];

        if (empty($data['checkIn']) || empty($data['checkOut'])) {
            return $this->json(['message' => 'Dates d\'arrivée et de départ requises.'], 400);
        }

        $accommodation = (new Accommodation())->setTrip($trip)->setName('');
        $this->apply($accommodation, $data);

        $errors = $validator->validate($accommodation);
        if (count($errors) > 0) return $this->validationError($errors);

        $this->em->persist($accommodation);
        $this->notifyPlanningChange($trip);
        $this->em->flush();

        return $this->json($this->serialize($accommodation), 201);
    }

    /* ── Update ───────────────────────────────── */
    #[Route('/{id}', methods: ['PATCH'])]
    public function update(int $tripId, int $id, Request $req, ValidatorInterface $validator): JsonResponse
    {
        $trip = $this->findOwnedTrip($tripId);
        if (!$trip) return $this->json(['message' => 'Voyage introuvable.'], 404);

        $accommodation = $this->em->getRepository(Accommodation::class)->findOneBy(['id' => $id, 'trip' => $trip]);
        if (!$accommodation) return $this->json(['message' => 'Logement introuvable.'], 404);

        $this->apply($accommodation, json_decode($req->getContent(), true) ?? []);

        $errors = $validator->validate($accommodation);
        if (count($errors) > 0) {
            $this->em->refresh($accommodation); // annule les modifications invalides
            return $this->validationError($errors);
        }

        $this->notifyPlanningChange($trip);
        $this->em->flush();

        return $this->json($this->serialize($accommodation));
    }

    /* ── Delete ───────────────────────────────── */
    #[Route('/{id}', methods: ['DELETE'])]
    public function delete(int $tripId, int $id): JsonResponse
    {
        $trip = $this->findOwnedTrip($tripId);
        if (!$trip) return $this->json(['message' => 'Voyage introuvable.'], 404);

        $accommodation = $this->em->getRepository(Accommodation::class)->findOneBy(['id' => $id, 'trip' => $trip]);
        if (!$accommodation) return $this->json(['message' => 'Logement introuvable.'], 404);

        $this->em->remove($accommodation);
        $this->notifyPlanningChange($trip);
        $this->em->flush();

        return $this->json(null, 204);
    }

    /* ── Helpers ──────────────────────────────── */

    /** Applique les champs présents dans $data (valeurs mal formées → 400) */
    private function apply(Accommodation $a, array $data): void
    {
        $text = fn(string $k) => isset($data[$k]) && $data[$k] !== '' ? trim((string) $data[$k]) : null;

        if (array_key_exists('name', $data))             $a->setName((string) $text('name'));
        if (array_key_exists('type', $data))             $a->setType((string) $data['type']);
        if (array_key_exists('checkIn', $data))          $a->setCheckIn($this->parseDate($data['checkIn'], 'date d\'arrivée'));
        if (array_key_exists('checkOut', $data))         $a->setCheckOut($this->parseDate($data['checkOut'], 'date de départ'));
        if (array_key_exists('price', $data))            $a->setPrice($this->parseInt($data['price'], 'prix'));
        if (array_key_exists('hasSpecialPrice', $data))  $a->setHasSpecialPrice((bool) $data['hasSpecialPrice']);
        if (array_key_exists('specialPriceNote', $data)) $a->setSpecialPriceNote($text('specialPriceNote'));
        if (array_key_exists('link', $data))             $a->setLink($text('link'));
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

    private function serialize(Accommodation $a): array
    {
        return [
            'id'               => $a->getId(),
            'name'             => $a->getName(),
            'type'             => $a->getType(),
            'checkIn'          => $a->getCheckIn()->format('Y-m-d'),
            'checkOut'         => $a->getCheckOut()->format('Y-m-d'),
            'price'            => $a->getPrice(),
            'hasSpecialPrice'  => $a->hasSpecialPrice(),
            'specialPriceNote' => $a->getSpecialPriceNote(),
            'link'             => $a->getLink(),
            'createdAt'        => $a->getCreatedAt()->format('Y-m-d'),
        ];
    }
}
