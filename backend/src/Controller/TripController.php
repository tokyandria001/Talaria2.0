<?php

namespace App\Controller;

use App\Entity\Trip;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/trips', name: 'api_trips_')]
class TripController extends AbstractController
{
    public function __construct(private EntityManagerInterface $em) {}

    /* ── List (mine) ──────────────────────────── */
    #[Route('', methods: ['GET'])]
    public function list(): JsonResponse
    {
        /** @var User $me */
        $me = $this->getUser();
        $trips = $this->em->getRepository(Trip::class)->findBy(
            ['user' => $me],
            ['startDate' => 'ASC'],
        );

        return $this->json(array_map(fn($t) => $this->serialize($t), $trips));
    }

    /* ── Create ───────────────────────────────── */
    #[Route('', methods: ['POST'])]
    public function create(Request $req): JsonResponse
    {
        /** @var User $me */
        $me   = $this->getUser();
        $data = json_decode($req->getContent(), true) ?? [];

        if (empty($data['destination']) || empty($data['departureCity']) ||
            empty($data['startDate'])   || empty($data['endDate'])) {
            return $this->json(['message' => 'Champs obligatoires manquants.'], 400);
        }

        $trip = (new Trip())
            ->setUser($me)
            ->setDestination($data['destination'])
            ->setDepartureCity($data['departureCity'])
            ->setStartDate(new \DateTimeImmutable($data['startDate']))
            ->setEndDate(new \DateTimeImmutable($data['endDate']))
            ->setTravelers((int) ($data['travelers'] ?? 1))
            ->setTransportMode($data['transportMode'] ?? 'avion')
            ->setNeedsRental((bool) ($data['needsRental'] ?? false));

        if (!empty($data['title']))         $trip->setTitle($data['title']);
        if (isset($data['budget']))         $trip->setBudget((int) $data['budget']);
        if (isset($data['distanceKm']))     $trip->setDistanceKm((int) $data['distanceKm']);
        if (isset($data['fuelPricePerLiter'])) $trip->setFuelPricePerLiter((string) $data['fuelPricePerLiter']);
        if (isset($data['fuelConsumption']))   $trip->setFuelConsumption((string) $data['fuelConsumption']);
        if (isset($data['tollCost']))       $trip->setTollCost((int) $data['tollCost']);
        if (isset($data['rentalLink']))     $trip->setRentalLink($data['rentalLink']);
        if (isset($data['rentalCost']))     $trip->setRentalCost((int) $data['rentalCost']);
        if (isset($data['bookingLinks']))   $trip->setBookingLinks($data['bookingLinks']);

        $this->em->persist($trip);
        $this->em->flush();

        return $this->json($this->serialize($trip), 201);
    }

    /* ── Get one ──────────────────────────────── */
    #[Route('/{id}', methods: ['GET'])]
    public function get(int $id): JsonResponse
    {
        $trip = $this->findOwned($id);
        if (!$trip) return $this->json(['message' => 'Voyage introuvable.'], 404);

        return $this->json($this->serialize($trip));
    }

    /* ── Update ───────────────────────────────── */
    #[Route('/{id}', methods: ['PATCH'])]
    public function update(int $id, Request $req): JsonResponse
    {
        $trip = $this->findOwned($id);
        if (!$trip) return $this->json(['message' => 'Voyage introuvable.'], 404);

        $data = json_decode($req->getContent(), true) ?? [];

        if (array_key_exists('title', $data))          $trip->setTitle($data['title']);
        if (array_key_exists('destination', $data))    $trip->setDestination($data['destination']);
        if (array_key_exists('departureCity', $data))  $trip->setDepartureCity($data['departureCity']);
        if (array_key_exists('startDate', $data))      $trip->setStartDate(new \DateTimeImmutable($data['startDate']));
        if (array_key_exists('endDate', $data))        $trip->setEndDate(new \DateTimeImmutable($data['endDate']));
        if (array_key_exists('travelers', $data))      $trip->setTravelers((int) $data['travelers']);
        if (array_key_exists('budget', $data))         $trip->setBudget($data['budget'] !== null ? (int) $data['budget'] : null);
        if (array_key_exists('transportMode', $data))  $trip->setTransportMode($data['transportMode']);
        if (array_key_exists('distanceKm', $data))     $trip->setDistanceKm($data['distanceKm'] !== null ? (int) $data['distanceKm'] : null);
        if (array_key_exists('fuelPricePerLiter', $data)) $trip->setFuelPricePerLiter($data['fuelPricePerLiter'] !== null ? (string) $data['fuelPricePerLiter'] : null);
        if (array_key_exists('fuelConsumption', $data))   $trip->setFuelConsumption($data['fuelConsumption'] !== null ? (string) $data['fuelConsumption'] : null);
        if (array_key_exists('tollCost', $data))       $trip->setTollCost($data['tollCost'] !== null ? (int) $data['tollCost'] : null);
        if (array_key_exists('needsRental', $data))    $trip->setNeedsRental((bool) $data['needsRental']);
        if (array_key_exists('rentalLink', $data))     $trip->setRentalLink($data['rentalLink']);
        if (array_key_exists('rentalCost', $data))     $trip->setRentalCost($data['rentalCost'] !== null ? (int) $data['rentalCost'] : null);
        if (array_key_exists('bookingLinks', $data))   $trip->setBookingLinks($data['bookingLinks']);

        $this->em->flush();

        return $this->json($this->serialize($trip));
    }

    /* ── Delete ───────────────────────────────── */
    #[Route('/{id}', methods: ['DELETE'])]
    public function delete(int $id): JsonResponse
    {
        $trip = $this->findOwned($id);
        if (!$trip) return $this->json(['message' => 'Voyage introuvable.'], 404);

        $this->em->remove($trip);
        $this->em->flush();

        return $this->json(null, 204);
    }

    /* ── Helpers ──────────────────────────────── */

    private function findOwned(int $id): ?Trip
    {
        /** @var User $me */
        $me   = $this->getUser();
        $trip = $this->em->getRepository(Trip::class)->find($id);
        if (!$trip || $trip->getUser()->getId() !== $me->getId()) return null;
        return $trip;
    }

    private function serialize(Trip $t): array
    {
        return [
            'id'               => $t->getId(),
            'title'            => $t->getTitle(),
            'destination'      => $t->getDestination(),
            'departureCity'    => $t->getDepartureCity(),
            'startDate'        => $t->getStartDate()->format('Y-m-d'),
            'endDate'          => $t->getEndDate()->format('Y-m-d'),
            'travelers'        => $t->getTravelers(),
            'budget'           => $t->getBudget(),
            'transportMode'    => $t->getTransportMode(),
            'distanceKm'       => $t->getDistanceKm(),
            'fuelPricePerLiter'=> $t->getFuelPricePerLiter() !== null ? (float) $t->getFuelPricePerLiter() : null,
            'fuelConsumption'  => $t->getFuelConsumption() !== null ? (float) $t->getFuelConsumption() : null,
            'tollCost'         => $t->getTollCost(),
            'computedFuelCost' => $t->computedFuelCost(),
            'computedTotalCost'=> $t->computedTotalCost(),
            'needsRental'      => $t->isNeedsRental(),
            'rentalLink'       => $t->getRentalLink(),
            'rentalCost'       => $t->getRentalCost(),
            'bookingLinks'     => $t->getBookingLinks(),
            'createdAt'        => $t->getCreatedAt()->format('Y-m-d'),
        ];
    }
}
