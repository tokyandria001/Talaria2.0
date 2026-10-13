<?php

namespace App\Controller;

use App\Entity\Activity;
use App\Entity\ActivityVote;
use App\Entity\Place;
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

/**
 * Phase 9 — votes du groupe sur des activités proposées.
 *
 * Une proposition est une activité « en vote » : elle n'apparaît pas dans le planning tant qu'elle
 * n'est pas validée. Chaque participant vote « Je participe » ou « Pas pour moi » (modifiable tant
 * que le vote est ouvert). L'activité est validée dès que plus de la moitié des participants
 * participent, refusée dès que ce n'est plus possible ; à la clôture, la majorité des votants l'emporte.
 */
#[Route('/api/trips/{tripId}/votes', name: 'api_votes_', requirements: ['tripId' => '\d+'])]
class VoteController extends AbstractController
{
    use ApiInputTrait;

    public function __construct(
        private EntityManagerInterface $em,
        private TripAccess $access,
    ) {}

    #[Route('', name: 'list', methods: ['GET'])]
    public function list(int $tripId): JsonResponse
    {
        $trip = $this->access->findVisible($tripId, $this->me());
        if (!$trip) return $this->notFound();

        // Votes arrivés à leur date de clôture : résultat à la majorité des votants
        $changed = false;
        foreach ($this->proposals($trip) as $activity) {
            $changed = $this->resolve($activity, $trip) || $changed;
        }
        if ($changed) $this->em->flush();

        return $this->json($this->view($trip));
    }

    /** Proposer une activité au vote (mêmes champs qu'une activité ; date obligatoire, dans le voyage) */
    #[Route('', name: 'create', methods: ['POST'])]
    public function create(int $tripId, Request $req, ValidatorInterface $validator): JsonResponse
    {
        $me = $this->me();
        $trip = $this->access->findVisible($tripId, $me);
        if (!$trip) return $this->notFound();

        $data = json_decode($req->getContent(), true) ?? [];
        if (empty($data['date'])) return $this->json(['message' => 'La date de l\'activité est requise.'], 400);
        $date = $this->parseDate($data['date'], 'date');
        if ($date < $trip->getStartDate() || $date > $trip->getEndDate()) {
            return $this->json(['message' => 'La date doit être comprise dans les dates du voyage.'], 400);
        }

        $activity = (new Activity())->setTrip($trip)->setDate($date)
            ->setTitle(trim((string) ($data['title'] ?? '')))
            ->setDescription(!empty($data['description']) ? (string) $data['description'] : null)
            ->setCategory(!empty($data['category']) ? (string) $data['category'] : null)
            ->setPrice($this->parseInt($data['price'] ?? null, 'prix'))
            ->setVoteStatus(Activity::VOTE_OPEN)
            ->setProposedBy($me)
            ->setVoteDeadline($this->deadlineFor($date));
        if (!empty($data['slot'])) $activity->setSlot((string) $data['slot']);
        if (!empty($data['time'])) $activity->setTime($this->parseTime($data['time']));
        if (!empty($data['placeId'])) {
            $place = $this->em->find(Place::class, $this->parseInt($data['placeId'], 'lieu'));
            if (!$place) return $this->json(['message' => 'Lieu introuvable.'], 404);
            $activity->setPlace($place);
            if ($activity->getTitle() === '') $activity->setTitle($place->getName());
        }
        if ($activity->getPrice() === null) $activity->setPrice(Activity::defaultPriceFor($activity->getCategory()));

        $errors = $validator->validate($activity);
        if (count($errors) > 0) return $this->validationError($errors);

        $this->em->persist($activity);
        // La personne qui propose participe
        $this->em->persist((new ActivityVote())->setActivity($activity)->setUser($me)->setParticipates(true));
        $this->access->notifyGroup($trip, $me, 'vote', sprintf(
            '%s propose « %s » au vote',
            UserPresenter::public($me)['displayName'], $activity->getTitle(),
        ));
        $this->em->flush();

        if ($this->resolve($activity, $trip)) $this->em->flush();

        return $this->json($this->view($trip), 201);
    }

    /** Voter : { participates: true } « Je participe », { participates: false } « Pas pour moi » */
    #[Route('/{activityId}', name: 'vote', methods: ['POST'], requirements: ['activityId' => '\d+'])]
    public function vote(int $tripId, int $activityId, Request $req): JsonResponse
    {
        $me = $this->me();
        $trip = $this->access->findVisible($tripId, $me);
        $activity = $trip ? $this->findProposal($trip, $activityId) : null;
        if (!$activity) return $this->notFound();

        if ($this->resolve($activity, $trip)) $this->em->flush();
        if ($activity->getVoteStatus() !== Activity::VOTE_OPEN) {
            return $this->json(['message' => 'Le vote est terminé.'], 409);
        }

        $data = json_decode($req->getContent(), true) ?? [];
        if (!isset($data['participates']) || !is_bool($data['participates'])) {
            return $this->json(['message' => 'Indiquez si vous participez (participates : true ou false).'], 400);
        }

        $vote = $this->em->getRepository(ActivityVote::class)->findOneBy(['activity' => $activity, 'user' => $me])
            ?? (new ActivityVote())->setActivity($activity)->setUser($me);
        $vote->setParticipates($data['participates']);
        $this->em->persist($vote);
        $this->em->flush();

        if ($this->resolve($activity, $trip)) $this->em->flush();

        return $this->json($this->view($trip));
    }

    /** Retirer une proposition encore ouverte : la personne qui l'a proposée, ou un gestionnaire du voyage */
    #[Route('/{activityId}', name: 'delete', methods: ['DELETE'], requirements: ['activityId' => '\d+'])]
    public function delete(int $tripId, int $activityId): JsonResponse
    {
        $me = $this->me();
        $trip = $this->access->findVisible($tripId, $me);
        $activity = $trip ? $this->findProposal($trip, $activityId) : null;
        if (!$activity) return $this->notFound();

        if ($activity->getProposedBy()?->getId() !== $me->getId() && !$this->access->canManage($trip, $me)) {
            return $this->json(['message' => 'Seule la personne qui a proposé l\'activité (ou l\'organisateur) peut la retirer.'], 403);
        }
        if ($activity->getVoteStatus() !== Activity::VOTE_OPEN) {
            return $this->json(['message' => 'Le vote est terminé.'], 409);
        }

        $this->em->remove($activity);
        $this->em->flush();

        return $this->json($this->view($trip));
    }

    /* ── Règles du vote ───────────────────────── */

    /** Clôture : la veille de l'activité, jamais avant aujourd'hui */
    private function deadlineFor(\DateTimeImmutable $date): \DateTimeImmutable
    {
        $today = new \DateTimeImmutable('today');
        $eve = $date->modify('-1 day');
        return $eve < $today ? $today : $eve;
    }

    /**
     * Met à jour le statut d'une proposition ouverte. Retourne true s'il a changé.
     * Majorité des participants → validée ; majorité devenue impossible → refusée ;
     * date de clôture passée → majorité des votants (égalité : refusée).
     */
    private function resolve(Activity $activity, Trip $trip): bool
    {
        if ($activity->getVoteStatus() !== Activity::VOTE_OPEN) return false;

        [$yes, $no] = $this->counts($activity);
        $total = count($this->access->participants($trip));
        $closed = $activity->getVoteDeadline() && $activity->getVoteDeadline() < new \DateTimeImmutable('today');

        $status = match (true) {
            $yes * 2 > $total            => Activity::VOTE_VALIDATED,
            ($total - $no) * 2 <= $total => Activity::VOTE_REJECTED,
            $closed                      => $yes > $no ? Activity::VOTE_VALIDATED : Activity::VOTE_REJECTED,
            default                      => null,
        };
        if (!$status) return false;

        $activity->setVoteStatus($status);
        $actor = $activity->getProposedBy() ?? $trip->getUser();
        $this->access->notifyGroup($trip, $actor, 'vote_result', $status === Activity::VOTE_VALIDATED
            ? sprintf('« %s » est validée : elle rejoint le planning', $activity->getTitle())
            : sprintf('« %s » n\'a pas été retenue', $activity->getTitle()));

        return true;
    }

    /** @return array{0: int, 1: int} [Je participe, Pas pour moi] */
    private function counts(Activity $activity): array
    {
        $yes = $no = 0;
        foreach ($this->em->getRepository(ActivityVote::class)->findBy(['activity' => $activity]) as $v) {
            $v->participates() ? $yes++ : $no++;
        }
        return [$yes, $no];
    }

    /* ── Vue ─────────────────────────────────── */

    /** @return Activity[] propositions du voyage : ouvertes d'abord, puis validées, puis refusées, par date */
    private function proposals(Trip $trip): array
    {
        $activities = $this->em->getRepository(Activity::class)->createQueryBuilder('a')
            ->where('a.trip = :t AND a.voteStatus IS NOT NULL')->setParameter('t', $trip)
            ->getQuery()->getResult();
        $rank = [Activity::VOTE_OPEN => 0, Activity::VOTE_VALIDATED => 1, Activity::VOTE_REJECTED => 2];
        usort($activities, fn (Activity $a, Activity $b) =>
            [$rank[$a->getVoteStatus()], $a->sortKey(), $a->getId()] <=> [$rank[$b->getVoteStatus()], $b->sortKey(), $b->getId()]);
        return $activities;
    }

    private function view(Trip $trip): array
    {
        $me = $this->me();
        $proposals = $this->proposals($trip);
        $participants = count($this->access->participants($trip));

        $votes = [];
        foreach ($this->em->getRepository(ActivityVote::class)->findBy(['activity' => $proposals ?: [0]]) as $v) {
            $votes[$v->getActivity()->getId()][] = $v;
        }

        $open = array_filter($proposals, fn (Activity $a) => $a->getVoteStatus() === Activity::VOTE_OPEN);
        $deadlines = array_filter(array_map(fn (Activity $a) => $a->getVoteDeadline()?->format('Y-m-d'), $open));

        return [
            'summary' => [
                'open'      => count($open),
                'validated' => count(array_filter($proposals, fn (Activity $a) => $a->getVoteStatus() === Activity::VOTE_VALIDATED)),
                'rejected'  => count(array_filter($proposals, fn (Activity $a) => $a->getVoteStatus() === Activity::VOTE_REJECTED)),
                'closesOn'  => $deadlines ? min($deadlines) : null,
                'participantsCount' => $participants,
            ],
            'votes' => array_map(function (Activity $a) use ($votes, $participants, $me, $trip) {
                $list = $votes[$a->getId()] ?? [];
                $yes = count(array_filter($list, fn (ActivityVote $v) => $v->participates()));
                $mine = current(array_filter($list, fn (ActivityVote $v) => $v->getUser()->getId() === $me->getId())) ?: null;
                $place = $a->getPlace();
                return [
                    'id'          => $a->getId(),
                    'title'       => $a->getTitle(),
                    'description' => $a->getDescription(),
                    'date'        => $a->getDate()->format('Y-m-d'),
                    'time'        => $a->getTime()?->format('H:i'),
                    'slot'        => $a->getSlot(),
                    'category'    => $a->getCategory(),
                    'price'       => $a->getPrice(),
                    'place'       => $place ? [
                        'id' => $place->getId(), 'name' => $place->getName(),
                        'address' => $place->getAddress(), 'photo' => $place->getPhotos()[0] ?? null,
                    ] : null,
                    'status'      => $a->getVoteStatus(),
                    'deadline'    => $a->getVoteDeadline()?->format('Y-m-d'),
                    'proposedBy'  => $a->getProposedBy() ? UserPresenter::public($a->getProposedBy()) : null,
                    'yes'         => $yes,
                    'no'          => count($list) - $yes,
                    'votesCount'  => count($list),
                    'participantsCount' => $participants,
                    // Note sur 5 : part des votants qui participent
                    'rating'      => $list ? round($yes / count($list) * 5, 1) : null,
                    'myVote'      => $mine ? ($mine->participates() ? 'yes' : 'no') : null,
                    'canDelete'   => $a->getVoteStatus() === Activity::VOTE_OPEN
                        && ($a->getProposedBy()?->getId() === $me->getId() || $this->access->canManage($trip, $me)),
                ];
            }, $proposals),
        ];
    }

    /* ── Helpers ─────────────────────────────── */

    private function findProposal(Trip $trip, int $id): ?Activity
    {
        $activity = $this->em->getRepository(Activity::class)->findOneBy(['id' => $id, 'trip' => $trip]);
        return $activity?->getVoteStatus() !== null ? $activity : null;
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
