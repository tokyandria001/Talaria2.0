<?php

namespace App\Controller;

use App\Entity\GroupMember;
use App\Entity\TravelGroup;
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

#[Route('/api/trips', name: 'api_trips_')]
class TripController extends AbstractController
{
    use ApiInputTrait;

    public function __construct(
        private EntityManagerInterface $em,
        private TripAccess $access,
    ) {}

    /* ── Liste : mes voyages + ceux de mes groupes ── */
    #[Route('', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $me = $this->me();
        $trips = $this->em->getRepository(Trip::class)->createQueryBuilder('t')
            ->leftJoin('t.group', 'g')
            ->leftJoin('g.members', 'm', 'WITH', 'm.user = :me AND m.status = :active')
            ->where('t.user = :me OR m.id IS NOT NULL')
            ->setParameter('me', $me)
            ->setParameter('active', GroupMember::STATUS_ACTIVE)
            ->orderBy('t.startDate', 'ASC')->addOrderBy('t.id', 'ASC')
            ->getQuery()->getResult();

        return $this->json(array_map(fn (Trip $t) => $this->serialize($t, $me), $trips));
    }

    /* ── Create ───────────────────────────────── */
    #[Route('', methods: ['POST'])]
    public function create(Request $req, ValidatorInterface $validator): JsonResponse
    {
        $me   = $this->me();
        $data = json_decode($req->getContent(), true) ?? [];

        if (empty($data['destination']) || empty($data['departureCity']) ||
            empty($data['startDate'])   || empty($data['endDate'])) {
            return $this->json(['message' => 'Champs obligatoires manquants.'], 400);
        }

        $trip = (new Trip())->setUser($me);
        $this->apply($trip, $data);
        if ($error = $this->applyGroup($trip, $data, $me)) return $error;

        $errors = $validator->validate($trip);
        if (count($errors) > 0) return $this->validationError($errors);

        $this->em->persist($trip);
        $this->notifyNewGroupTrip($trip, $me);
        $this->em->flush();

        return $this->json($this->serialize($trip, $me), 201);
    }

    /* ── Get one ──────────────────────────────── */
    #[Route('/{id}', methods: ['GET'])]
    public function get(int $id): JsonResponse
    {
        $me = $this->me();
        $trip = $this->access->findVisible($id, $me);
        if (!$trip) return $this->json(['message' => 'Voyage introuvable.'], 404);

        return $this->json($this->serialize($trip, $me));
    }

    /* ── Update ───────────────────────────────── */
    #[Route('/{id}', methods: ['PATCH'])]
    public function update(int $id, Request $req, ValidatorInterface $validator): JsonResponse
    {
        $me = $this->me();
        $trip = $this->access->findVisible($id, $me);
        if (!$trip) return $this->json(['message' => 'Voyage introuvable.'], 404);
        if (!$this->access->canManage($trip, $me)) return $this->forbidden();

        $data = json_decode($req->getContent(), true) ?? [];
        $this->apply($trip, $data);
        $previousGroup = $trip->getGroup();
        if ($error = $this->applyGroup($trip, $data, $me)) {
            $this->em->refresh($trip);
            return $error;
        }

        $errors = $validator->validate($trip);
        if (count($errors) > 0) {
            $this->em->refresh($trip); // annule les modifications invalides
            return $this->validationError($errors);
        }

        if ($trip->getGroup() && $trip->getGroup() !== $previousGroup) $this->notifyNewGroupTrip($trip, $me);
        $this->em->flush();

        return $this->json($this->serialize($trip, $me));
    }

    /* ── Delete ───────────────────────────────── */
    #[Route('/{id}', methods: ['DELETE'])]
    public function delete(int $id): JsonResponse
    {
        $me = $this->me();
        $trip = $this->access->findVisible($id, $me);
        if (!$trip) return $this->json(['message' => 'Voyage introuvable.'], 404);
        if (!$this->access->canManage($trip, $me)) return $this->forbidden();

        // Notifications liées au voyage supprimées explicitement (pas seulement via ON DELETE CASCADE)
        $this->em->createQuery('DELETE FROM App\Entity\Notification n WHERE n.trip = :t')
            ->setParameter('t', $trip)->execute();
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

    /** Rattache le voyage à un groupe (groupId) ou le rend perso (groupId: null) */
    private function applyGroup(Trip $trip, array $data, User $me): ?JsonResponse
    {
        if (!array_key_exists('groupId', $data)) return null;

        $groupId = $this->parseInt($data['groupId'], 'groupe');
        if (!$groupId) { $trip->setGroup(null); return null; }

        $group = $this->em->find(TravelGroup::class, $groupId);
        if (!$group || !$this->access->isActiveMember($group, $me)) {
            return $this->json(['message' => 'Vous ne faites pas partie de ce groupe.'], 403);
        }
        $trip->setGroup($group);
        return null;
    }

    private function notifyNewGroupTrip(Trip $trip, User $me): void
    {
        if (!$trip->getGroup()) return;
        $this->access->notifyGroup($trip, $me, 'group_trip', sprintf(
            '%s a ajouté le voyage « %s » au groupe « %s »',
            UserPresenter::public($me)['displayName'], $trip->getTitle() ?: $trip->getDestination(), $trip->getGroup()->getName(),
        ));
    }

    private function me(): User
    {
        /** @var User $me */
        $me = $this->getUser();
        return $me;
    }

    private function forbidden(): JsonResponse
    {
        return $this->json(['message' => 'Seuls le créateur du voyage et l\'organisateur du groupe peuvent modifier ces informations.'], 403);
    }

    private function serialize(Trip $t, User $me): array
    {
        $group = $t->getGroup();

        return [
            'group'            => $group ? ['id' => $group->getId(), 'name' => $group->getName()] : null,
            'createdBy'        => UserPresenter::public($t->getUser()),
            'permissions'      => ['canManage' => $this->access->canManage($t, $me)],
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
