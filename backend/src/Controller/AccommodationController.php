<?php

namespace App\Controller;

use App\Entity\Accommodation;
use App\Entity\Trip;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Validator\ValidatorInterface;

#[Route('/api/trips/{tripId}/accommodations', name: 'api_accommodations_')]
class AccommodationController extends AbstractController
{
    public function __construct(private EntityManagerInterface $em) {}

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
        if ($data['checkOut'] <= $data['checkIn']) {
            return $this->json(['message' => 'La date de départ doit être après la date d\'arrivée.'], 400);
        }

        $accommodation = (new Accommodation())
            ->setTrip($trip)
            ->setName($data['name'] ?? '')
            ->setType($data['type'] ?? 'hotel')
            ->setCheckIn(new \DateTimeImmutable($data['checkIn']))
            ->setCheckOut(new \DateTimeImmutable($data['checkOut']))
            ->setPrice(isset($data['price']) && $data['price'] !== '' ? (int) $data['price'] : null)
            ->setHasSpecialPrice((bool) ($data['hasSpecialPrice'] ?? false))
            ->setSpecialPriceNote($data['specialPriceNote'] ?? null)
            ->setLink($data['link'] ?? null);

        $errors = $validator->validate($accommodation);
        if (count($errors) > 0) {
            $messages = [];
            foreach ($errors as $e) {
                $messages[$e->getPropertyPath()] = $e->getMessage();
            }
            return $this->json(['message' => 'Données invalides.', 'errors' => $messages], 422);
        }

        $this->em->persist($accommodation);
        $this->em->flush();

        return $this->json($this->serialize($accommodation), 201);
    }

    /* ── Update ───────────────────────────────── */
    #[Route('/{id}', methods: ['PATCH'])]
    public function update(int $tripId, int $id, Request $req): JsonResponse
    {
        $trip = $this->findOwnedTrip($tripId);
        if (!$trip) return $this->json(['message' => 'Voyage introuvable.'], 404);

        $accommodation = $this->em->getRepository(Accommodation::class)->findOneBy(['id' => $id, 'trip' => $trip]);
        if (!$accommodation) return $this->json(['message' => 'Logement introuvable.'], 404);

        $data = json_decode($req->getContent(), true) ?? [];

        if (array_key_exists('name', $data))             $accommodation->setName($data['name']);
        if (array_key_exists('type', $data))             $accommodation->setType($data['type']);
        if (array_key_exists('checkIn', $data))          $accommodation->setCheckIn(new \DateTimeImmutable($data['checkIn']));
        if (array_key_exists('checkOut', $data))         $accommodation->setCheckOut(new \DateTimeImmutable($data['checkOut']));
        if (array_key_exists('price', $data))            $accommodation->setPrice($data['price'] !== null && $data['price'] !== '' ? (int) $data['price'] : null);
        if (array_key_exists('hasSpecialPrice', $data))  $accommodation->setHasSpecialPrice((bool) $data['hasSpecialPrice']);
        if (array_key_exists('specialPriceNote', $data)) $accommodation->setSpecialPriceNote($data['specialPriceNote']);
        if (array_key_exists('link', $data))             $accommodation->setLink($data['link']);

        if ($accommodation->getCheckOut() <= $accommodation->getCheckIn()) {
            return $this->json(['message' => 'La date de départ doit être après la date d\'arrivée.'], 400);
        }

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
        $this->em->flush();

        return $this->json(null, 204);
    }

    /* ── Helpers ──────────────────────────────── */

    private function findOwnedTrip(int $tripId): ?Trip
    {
        /** @var User $me */
        $me   = $this->getUser();
        $trip = $this->em->getRepository(Trip::class)->find($tripId);
        if (!$trip || $trip->getUser()->getId() !== $me->getId()) return null;
        return $trip;
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
