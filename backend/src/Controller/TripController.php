<?php

namespace App\Controller;

use App\Entity\Trip;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Validator\ValidatorInterface;

#[Route('/api/trips', name: 'api_trips_')]
class TripController extends AbstractController
{
    use ApiInputTrait;

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
    public function create(Request $req, ValidatorInterface $validator): JsonResponse
    {
        /** @var User $me */
        $me   = $this->getUser();
        $data = json_decode($req->getContent(), true) ?? [];

        if (empty($data['destination']) || empty($data['departureCity']) ||
            empty($data['startDate'])   || empty($data['endDate'])) {
            return $this->json(['message' => 'Champs obligatoires manquants.'], 400);
        }

        $trip = (new Trip())->setUser($me);
        $this->apply($trip, $data);

        $errors = $validator->validate($trip);
        if (count($errors) > 0) return $this->validationError($errors);

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
    public function update(int $id, Request $req, ValidatorInterface $validator): JsonResponse
    {
        $trip = $this->findOwned($id);
        if (!$trip) return $this->json(['message' => 'Voyage introuvable.'], 404);

        $this->apply($trip, json_decode($req->getContent(), true) ?? []);

        $errors = $validator->validate($trip);
        if (count($errors) > 0) {
            $this->em->refresh($trip); // annule les modifications invalides
            return $this->validationError($errors);
        }

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

    /** Applique les champs présents dans $data (valeurs mal formées → 400) */
    private function apply(Trip $trip, array $data): void
    {
        $text = fn(string $k) => isset($data[$k]) && $data[$k] !== '' ? trim((string) $data[$k]) : null;

        if (array_key_exists('title', $data))             $trip->setTitle($text('title'));
        if (array_key_exists('destination', $data))       $trip->setDestination((string) $text('destination'));
        if (array_key_exists('departureCity', $data))     $trip->setDepartureCity((string) $text('departureCity'));
        if (array_key_exists('startDate', $data))         $trip->setStartDate($this->parseDate($data['startDate'], 'date de départ'));
        if (array_key_exists('endDate', $data))           $trip->setEndDate($this->parseDate($data['endDate'], 'date de retour'));
        if (array_key_exists('travelers', $data))         $trip->setTravelers($this->parseInt($data['travelers'], 'nombre de voyageurs') ?? 1);
        if (array_key_exists('budget', $data))            $trip->setBudget($this->parseInt($data['budget'], 'budget'));
        if (array_key_exists('transportMode', $data))     $trip->setTransportMode((string) $data['transportMode']);
        if (array_key_exists('distanceKm', $data))        $trip->setDistanceKm($this->parseInt($data['distanceKm'], 'distance'));
        if (array_key_exists('fuelPricePerLiter', $data)) $trip->setFuelPricePerLiter($this->parseDecimal($data['fuelPricePerLiter'], 'prix du carburant'));
        if (array_key_exists('fuelConsumption', $data))   $trip->setFuelConsumption($this->parseDecimal($data['fuelConsumption'], 'consommation'));
        if (array_key_exists('tollCost', $data))          $trip->setTollCost($this->parseInt($data['tollCost'], 'péages'));
        if (array_key_exists('needsRental', $data))       $trip->setNeedsRental((bool) $data['needsRental']);
        if (array_key_exists('rentalLink', $data))        $trip->setRentalLink($text('rentalLink'));
        if (array_key_exists('rentalCost', $data))        $trip->setRentalCost($this->parseInt($data['rentalCost'], 'coût de location'));
        if (array_key_exists('bookingLinks', $data))      $trip->setBookingLinks(is_array($data['bookingLinks']) ? array_values($data['bookingLinks']) : []);
    }

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
