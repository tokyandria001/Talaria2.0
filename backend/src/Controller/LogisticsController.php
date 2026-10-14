<?php

namespace App\Controller;

use App\Entity\Accommodation;
use App\Entity\AccommodationReaction;
use App\Entity\Expense;
use App\Entity\TransportOption;
use App\Entity\Trip;
use App\Entity\User;
use App\Service\TravelerSettings;
use App\Service\TripAccess;
use App\Service\UserPresenter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * Onglet « Logistique » d'un voyage : réglages de chaque voyageur, hébergements proposés au groupe
 * (avis 👍/👎, réservation par le créateur ou l'organisateur → dépense partagée), et trajets de chacun
 * (chacun part d'où il veut, en compare plusieurs et choisit le sien → dépense personnelle).
 */
#[Route('/api/trips/{tripId}', name: 'api_logistics_', requirements: ['tripId' => '\d+'])]
class LogisticsController extends AbstractController
{
    use ApiInputTrait;

    public function __construct(
        private EntityManagerInterface $em,
        private TripAccess $access,
        private TravelerSettings $travelers,
    ) {}

    #[Route('/logistics', name: 'view', methods: ['GET'])]
    public function view(int $tripId): JsonResponse
    {
        $trip = $this->trip($tripId);
        if (!$trip) return $this->notFound();
        return $this->json($this->logistics($trip));
    }

    /* ── Mes réglages pour ce voyage ──────────── */

    /** { budget: €|null, dependents: nombre de personnes rattachées } */
    #[Route('/traveler', name: 'traveler', methods: ['PATCH'])]
    public function updateTraveler(int $tripId, Request $req, ValidatorInterface $validator): JsonResponse
    {
        $me = $this->me();
        $trip = $this->trip($tripId);
        if (!$trip) return $this->notFound();

        $data = json_decode($req->getContent(), true) ?? [];
        $traveler = $this->travelers->for($trip, $me);
        if (array_key_exists('budget', $data)) $traveler->setBudget($this->parseInt($data['budget'], 'budget'));
        if (array_key_exists('dependents', $data)) $traveler->setDependents($this->parseInt($data['dependents'], 'personnes rattachées') ?? 0);

        $errors = $validator->validate($traveler);
        if (count($errors) > 0) return $this->validationError($errors);

        $this->em->persist($traveler);
        $this->em->flush();

        return $this->json($this->logistics($trip));
    }

    /* ── Hébergements ─────────────────────────── */

    /** Mon avis : { liked: true | false | null (retirer) } */
    #[Route('/accommodations/{id}/reaction', name: 'accommodation_reaction', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function react(int $tripId, int $id, Request $req): JsonResponse
    {
        $me = $this->me();
        [$trip, $accommodation] = $this->accommodation($tripId, $id);
        if (!$accommodation) return $this->notFound();

        $data = json_decode($req->getContent(), true) ?? [];
        $liked = $data['liked'] ?? null;
        if ($liked !== null && !is_bool($liked)) return $this->json(['message' => 'Avis invalide (liked : true, false ou null).'], 400);

        $repo = $this->em->getRepository(AccommodationReaction::class);
        $reaction = $repo->findOneBy(['accommodation' => $accommodation, 'user' => $me]);
        if ($liked === null) {
            if ($reaction) $this->em->remove($reaction);
        } else {
            $reaction ??= (new AccommodationReaction())->setAccommodation($accommodation)->setUser($me);
            $this->em->persist($reaction->setLiked($liked));
        }
        $this->em->flush();

        return $this->json($this->logistics($trip));
    }

    /**
     * Valider la réservation (créateur du voyage ou organisateur du groupe) : une dépense « logement »
     * partagée entre les participants est créée, les autres hébergements aux mêmes dates ne sont pas retenus.
     */
    #[Route('/accommodations/{id}/book', name: 'accommodation_book', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function book(int $tripId, int $id): JsonResponse
    {
        $me = $this->me();
        [$trip, $accommodation] = $this->accommodation($tripId, $id);
        if (!$accommodation) return $this->notFound();
        if (!$this->access->canManage($trip, $me)) {
            return $this->json(['message' => 'Seuls le créateur du voyage et l\'organisateur du groupe valident une réservation.'], 403);
        }
        if ($accommodation->getStatus() === Accommodation::STATUS_BOOKED) return $this->json($this->logistics($trip));
        if (!$accommodation->getPrice()) {
            return $this->json(['message' => 'Indiquez le prix de l\'hébergement avant de valider la réservation.'], 422);
        }

        $accommodation->setStatus(Accommodation::STATUS_BOOKED);
        foreach ($this->overlapping($accommodation) as $other) {
            if ($other->getStatus() === Accommodation::STATUS_PROPOSED) $other->setStatus(Accommodation::STATUS_REJECTED);
        }

        $expense = (new Expense())->setTrip($trip)->setCreatedBy($me)->setPaidBy($me)
            ->setCategory('logement')
            ->setLabel(mb_substr('Logement · ' . $accommodation->getName(), 0, 120))
            ->setAmountCents($accommodation->getPrice() * 100)
            ->setParticipants($this->access->participants($trip))
            ->setAccommodation($accommodation);
        $this->em->persist($expense);

        $this->access->notifyGroup($trip, $me, 'expense', sprintf(
            '%s a réservé « %s » · %s',
            UserPresenter::public($me)['displayName'], $accommodation->getName(), number_format($accommodation->getPrice(), 0, ',', ' ') . ' €',
        ));
        $this->em->flush();

        return $this->json($this->logistics($trip));
    }

    /** Annuler la réservation : la dépense liée est retirée, les hébergements écartés redeviennent des propositions */
    #[Route('/accommodations/{id}/unbook', name: 'accommodation_unbook', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function unbook(int $tripId, int $id): JsonResponse
    {
        $me = $this->me();
        [$trip, $accommodation] = $this->accommodation($tripId, $id);
        if (!$accommodation) return $this->notFound();
        if (!$this->access->canManage($trip, $me)) {
            return $this->json(['message' => 'Seuls le créateur du voyage et l\'organisateur du groupe annulent une réservation.'], 403);
        }

        $accommodation->setStatus(Accommodation::STATUS_PROPOSED);
        foreach ($this->overlapping($accommodation) as $other) {
            if ($other->getStatus() === Accommodation::STATUS_REJECTED) $other->setStatus(Accommodation::STATUS_PROPOSED);
        }
        foreach ($this->em->getRepository(Expense::class)->findBy(['accommodation' => $accommodation]) as $e) $this->em->remove($e);
        $this->em->flush();

        return $this->json($this->logistics($trip));
    }

    /* ── Trajets de chacun ────────────────────── */

    #[Route('/transports', name: 'transport_create', methods: ['POST'])]
    public function createTransport(int $tripId, Request $req, ValidatorInterface $validator): JsonResponse
    {
        $me = $this->me();
        $trip = $this->trip($tripId);
        if (!$trip) return $this->notFound();

        $option = (new TransportOption())->setTrip($trip)->setUser($me);
        $this->applyTransport($option, json_decode($req->getContent(), true) ?? []);
        $errors = $validator->validate($option);
        if (count($errors) > 0) return $this->validationError($errors);

        $this->em->persist($option);
        $this->em->flush();

        return $this->json($this->logistics($trip), 201);
    }

    #[Route('/transports/{id}', name: 'transport_update', methods: ['PATCH'], requirements: ['id' => '\d+'])]
    public function updateTransport(int $tripId, int $id, Request $req, ValidatorInterface $validator): JsonResponse
    {
        [$trip, $option, $error] = $this->ownTransport($tripId, $id);
        if ($error) return $error;

        $this->applyTransport($option, json_decode($req->getContent(), true) ?? []);
        $errors = $validator->validate($option);
        if (count($errors) > 0) {
            $this->em->refresh($option);
            return $this->validationError($errors);
        }
        // Trajet déjà choisi : la dépense suit le nouveau prix
        if ($option->isChosen()) {
            if (!$option->getPrice()) return $this->json(['message' => 'Un trajet choisi doit avoir un prix.'], 422);
            foreach ($this->em->getRepository(Expense::class)->findBy(['transportOption' => $option]) as $e) {
                $e->setAmountCents($option->getPrice() * 100)->setLabel($this->transportLabel($option));
            }
        }
        $this->em->flush();

        return $this->json($this->logistics($trip));
    }

    #[Route('/transports/{id}', name: 'transport_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function deleteTransport(int $tripId, int $id): JsonResponse
    {
        [$trip, $option, $error] = $this->ownTransport($tripId, $id);
        if ($error) return $error;

        foreach ($this->em->getRepository(Expense::class)->findBy(['transportOption' => $option]) as $e) $this->em->remove($e);
        $this->em->remove($option);
        $this->em->flush();

        return $this->json($this->logistics($trip));
    }

    /** Choisir ce trajet : il devient ma dépense personnelle (et remplace mon choix précédent) */
    #[Route('/transports/{id}/choose', name: 'transport_choose', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function chooseTransport(int $tripId, int $id): JsonResponse
    {
        $me = $this->me();
        [$trip, $option, $error] = $this->ownTransport($tripId, $id);
        if ($error) return $error;
        if (!$option->getPrice() && $option->getPrice() !== 0) {
            return $this->json(['message' => 'Indiquez le prix du trajet avant de le choisir.'], 422);
        }

        foreach ($this->em->getRepository(TransportOption::class)->findBy(['trip' => $trip, 'user' => $me]) as $other) {
            if ($other->isChosen()) {
                $other->setChosen(false);
                foreach ($this->em->getRepository(Expense::class)->findBy(['transportOption' => $other]) as $e) $this->em->remove($e);
            }
        }
        $option->setChosen(true);
        if ($option->getPrice() > 0) {
            $this->em->persist((new Expense())->setTrip($trip)->setCreatedBy($me)->setPaidBy($me)
                ->setCategory('transport')
                ->setLabel($this->transportLabel($option))
                ->setAmountCents($option->getPrice() * 100)
                ->setParticipants([$me])
                ->setTransportOption($option));
        }
        $this->em->flush();

        return $this->json($this->logistics($trip));
    }

    #[Route('/transports/{id}/unchoose', name: 'transport_unchoose', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function unchooseTransport(int $tripId, int $id): JsonResponse
    {
        [$trip, $option, $error] = $this->ownTransport($tripId, $id);
        if ($error) return $error;

        $option->setChosen(false);
        foreach ($this->em->getRepository(Expense::class)->findBy(['transportOption' => $option]) as $e) $this->em->remove($e);
        $this->em->flush();

        return $this->json($this->logistics($trip));
    }

    /* ── Vue ─────────────────────────────────── */

    private function logistics(Trip $trip): array
    {
        $me = $this->me();
        $travelers = $this->travelers->all($trip);
        $canManage = $this->access->canManage($trip, $me);

        $accommodations = $this->em->getRepository(Accommodation::class)->findBy(['trip' => $trip], ['checkIn' => 'ASC', 'id' => 'ASC']);
        $reactions = [];
        if ($accommodations) {
            foreach ($this->em->getRepository(AccommodationReaction::class)->findBy(['accommodation' => $accommodations], ['id' => 'ASC']) as $r) {
                $reactions[$r->getAccommodation()->getId()][] = $r;
            }
        }
        $rank = [Accommodation::STATUS_BOOKED => 0, Accommodation::STATUS_PROPOSED => 1, Accommodation::STATUS_REJECTED => 2];
        usort($accommodations, fn (Accommodation $a, Accommodation $b) => [$rank[$a->getStatus()] ?? 1, $a->getCheckIn()] <=> [$rank[$b->getStatus()] ?? 1, $b->getCheckIn()]);

        $options = [];
        foreach ($this->em->getRepository(TransportOption::class)->findBy(['trip' => $trip], ['id' => 'ASC']) as $o) {
            $options[$o->getUser()->getId()][] = $o;
        }

        return [
            'canManage' => $canManage,
            'me' => [
                'budget'     => ($travelers[$me->getId()] ?? null)?->getBudget(),
                'dependents' => ($travelers[$me->getId()] ?? null)?->getDependents() ?? 0,
            ],
            'travelersCount' => array_sum(array_map(fn ($t) => $t->getHeads(), $travelers)),
            'accommodations' => array_map(function (Accommodation $a) use ($reactions, $me, $canManage) {
                $list = $reactions[$a->getId()] ?? [];
                $mine = current(array_filter($list, fn ($r) => $r->getUser()->getId() === $me->getId())) ?: null;
                return [
                    'id'         => $a->getId(),
                    'name'       => $a->getName(),
                    'type'       => $a->getType(),
                    'checkIn'    => $a->getCheckIn()->format('Y-m-d'),
                    'checkOut'   => $a->getCheckOut()->format('Y-m-d'),
                    'price'      => $a->getPrice(),
                    'link'       => $a->getLink(),
                    'address'    => $a->getAddress(),
                    'status'     => $a->getStatus(),
                    'proposedBy' => $a->getProposedBy() ? UserPresenter::public($a->getProposedBy()) : null,
                    'suggested'  => $a->isSuggested(),
                    'likes'      => array_values(array_map(fn ($r) => UserPresenter::public($r->getUser()), array_filter($list, fn ($r) => $r->isLiked()))),
                    'dislikes'   => array_values(array_map(fn ($r) => UserPresenter::public($r->getUser()), array_filter($list, fn ($r) => !$r->isLiked()))),
                    'myReaction' => $mine ? ($mine->isLiked() ? 'like' : 'dislike') : null,
                    'canBook'    => $canManage,
                ];
            }, $accommodations),
            // Une ligne par participant : ses réglages et ses trajets envisagés
            'travelers' => array_values(array_map(fn ($t) => [
                'user'       => UserPresenter::public($t->getUser()),
                'dependents' => $t->getDependents(),
                'heads'      => $t->getHeads(),
                'budget'     => $t->getBudget(),
                'isMe'       => $t->getUser()->getId() === $me->getId(),
                'transports' => array_map(fn (TransportOption $o) => [
                    'id'            => $o->getId(),
                    'mode'          => $o->getMode(),
                    'departureCity' => $o->getDepartureCity(),
                    'departureLatitude'  => $o->getDepartureLatitude(),
                    'departureLongitude' => $o->getDepartureLongitude(),
                    'price'         => $o->getPrice(),
                    'link'          => $o->getLink(),
                    'note'          => $o->getNote(),
                    'chosen'        => $o->isChosen(),
                ], $options[$t->getUser()->getId()] ?? []),
            ], $travelers)),
        ];
    }

    /* ── Helpers ─────────────────────────────── */

    private function applyTransport(TransportOption $o, array $data): void
    {
        $text = fn (string $k) => isset($data[$k]) && $data[$k] !== '' ? trim((string) $data[$k]) : null;
        if (array_key_exists('mode', $data))               $o->setMode((string) $data['mode']);
        if (array_key_exists('departureCity', $data))      $o->setDepartureCity((string) $text('departureCity'));
        if (array_key_exists('departureLatitude', $data))  $o->setDepartureLatitude($this->parseFloat($data['departureLatitude'], 'latitude'));
        if (array_key_exists('departureLongitude', $data)) $o->setDepartureLongitude($this->parseFloat($data['departureLongitude'], 'longitude'));
        if (array_key_exists('price', $data))              $o->setPrice($this->parseInt($data['price'], 'prix'));
        if (array_key_exists('link', $data))               $o->setLink($text('link'));
        if (array_key_exists('note', $data))               $o->setNote($text('note'));
    }

    private function transportLabel(TransportOption $o): string
    {
        $modes = ['avion' => 'Avion', 'train' => 'Train', 'bus' => 'Bus', 'voiture' => 'Voiture', 'covoiturage' => 'Covoiturage', 'autre' => 'Trajet'];
        return mb_substr(sprintf('%s · depuis %s', $modes[$o->getMode()] ?? 'Trajet', $o->getDepartureCity()), 0, 120);
    }

    /** @return Accommodation[] autres hébergements du voyage dont les dates chevauchent celles de $a */
    private function overlapping(Accommodation $a): array
    {
        return array_filter(
            $this->em->getRepository(Accommodation::class)->findBy(['trip' => $a->getTrip()]),
            fn (Accommodation $o) => $o->getId() !== $a->getId() && $o->getCheckIn() < $a->getCheckOut() && $o->getCheckOut() > $a->getCheckIn(),
        );
    }

    /** @return array{0: ?Trip, 1: ?Accommodation} */
    private function accommodation(int $tripId, int $id): array
    {
        $trip = $this->trip($tripId);
        $a = $trip ? $this->em->getRepository(Accommodation::class)->findOneBy(['id' => $id, 'trip' => $trip]) : null;
        return [$trip, $a];
    }

    /** Trajet d'un participant : lui seul le modifie ; @return array{0: ?Trip, 1: ?TransportOption, 2: ?JsonResponse} */
    private function ownTransport(int $tripId, int $id): array
    {
        $trip = $this->trip($tripId);
        $option = $trip ? $this->em->getRepository(TransportOption::class)->findOneBy(['id' => $id, 'trip' => $trip]) : null;
        if (!$option) return [$trip, null, $this->notFound()];
        if ($option->getUser()->getId() !== $this->me()->getId()) {
            return [$trip, $option, $this->json(['message' => 'Chacun gère ses propres trajets.'], 403)];
        }
        return [$trip, $option, null];
    }

    private function trip(int $tripId): ?Trip
    {
        return $this->access->findVisible($tripId, $this->me());
    }

    private function me(): User
    {
        /** @var User $me */
        $me = $this->getUser();
        return $me;
    }

    private function notFound(): JsonResponse
    {
        return $this->json(['message' => 'Introuvable.'], 404);
    }
}
