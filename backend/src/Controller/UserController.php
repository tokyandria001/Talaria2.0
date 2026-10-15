<?php

namespace App\Controller;

use App\Entity\Article;
use App\Entity\BlockedUser;
use App\Entity\GroupMember;
use App\Entity\Trip;
use App\Entity\User;
use App\Repository\FriendshipRepository;
use App\Service\Blocking;
use App\Service\TripAccess;
use App\Service\UserPresenter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Profil d'un autre voyageur (maquette 36) et blocage.
 *
 * Profil privé (paramètre « Profil public » désactivé) : seuls ses amis voient sa bio,
 * ses centres d'intérêt et ses chiffres ; les autres voient son nom et sa photo.
 */
#[Route('/api/users/{id}', name: 'api_user_', requirements: ['id' => '\d+'])]
class UserController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        private FriendshipRepository $friendships,
        private Blocking $blocking,
        private TripAccess $access,
    ) {}

    #[Route('', name: 'profile', methods: ['GET'])]
    public function profile(int $id): JsonResponse
    {
        $me = $this->me();
        $user = $this->em->find(User::class, $id);
        if (!$user || $user->getDeletionRequestedAt() || $this->blocking->between($me, $user)) {
            return $this->json(['message' => 'Utilisateur introuvable.'], 404);
        }

        $self = $user->getId() === $me->getId();
        $friendship = $self ? null : $this->friendships->findBetween($me, $user);
        $relation = match (true) {
            $self                                                  => 'self',
            $friendship === null                                   => 'none',
            $friendship->isAccepted()                              => 'friends',
            $friendship->getRequester()->getId() === $me->getId()  => 'request_sent',
            default                                                => 'request_received',
        };
        $visible = $self || $relation === 'friends' || $user->isProfilePublic();

        $profile = UserPresenter::public($user) + [
            'relation'   => $relation,
            'requestId'  => $friendship && !$friendship->isAccepted() ? $friendship->getId() : null,
            'isPrivate'  => !$visible,
            'memberSince' => $user->getCreatedAt()?->format('Y'),
            'coverPhoto'  => $user->getCoverPhoto(),
        ];
        if (!$visible) return $this->json($profile);

        // Voyages en commun : visibles par les deux (créés par l'un, ou dans un groupe des deux)
        $mine = $this->visibleTrips($me);
        $theirs = array_flip(array_map(fn (Trip $t) => $t->getId(), $this->visibleTrips($user)));
        $together = $self ? [] : array_values(array_filter($mine, fn (Trip $t) => isset($theirs[$t->getId()])));
        $today = (new \DateTimeImmutable('today'))->format('Y-m-d');
        $next = current(array_filter($together, fn (Trip $t) => $t->getEndDate()->format('Y-m-d') >= $today)) ?: null;

        return $this->json($profile + [
            'bio'          => $user->getBio(),
            'activityTags' => $user->getActivityTags(),
            'stats' => [
                'trips'    => count($theirs),
                'articles' => $this->em->getRepository(Article::class)->count(['author' => $user]),
                'friends'  => count($this->friendships->findFriendshipsOf($user)),
                'tripsTogether' => count($together),
                'referrals' => $this->em->getRepository(User::class)->count(['referredBy' => $user]),
            ],
            'tripsTogether' => array_map(fn (Trip $t) => $this->tripSummary($t), array_reverse($together)),
            'nextTripTogether' => $next ? $this->tripSummary($next) : null,
        ]);
    }

    /** Bloquer : l'amitié et les demandes en cours entre les deux personnes sont supprimées */
    #[Route('/block', name: 'block', methods: ['POST'])]
    public function block(int $id): JsonResponse
    {
        $me = $this->me();
        $user = $this->em->find(User::class, $id);
        if (!$user) return $this->json(['message' => 'Utilisateur introuvable.'], 404);
        if ($user->getId() === $me->getId()) return $this->json(['message' => 'Vous ne pouvez pas vous bloquer vous-même.'], 400);

        if (!$this->em->getRepository(BlockedUser::class)->findOneBy(['blocker' => $me, 'blocked' => $user])) {
            $this->em->persist((new BlockedUser())->setBlocker($me)->setBlocked($user));
        }
        if ($friendship = $this->friendships->findBetween($me, $user)) {
            $this->em->remove($friendship);
        }
        $this->em->flush();

        return $this->json(['blocked' => true]);
    }

    #[Route('/block', name: 'unblock', methods: ['DELETE'])]
    public function unblock(int $id): JsonResponse
    {
        $me = $this->me();
        $user = $this->em->find(User::class, $id);
        $block = $user ? $this->em->getRepository(BlockedUser::class)->findOneBy(['blocker' => $me, 'blocked' => $user]) : null;
        if ($block) {
            $this->em->remove($block);
            $this->em->flush();
        }

        return $this->json(['blocked' => false]);
    }

    /* ── Helpers ─────────────────────────────── */

    /** @return Trip[] voyages visibles par $user (créés par lui, ou dans un de ses groupes), par date */
    private function visibleTrips(User $user): array
    {
        return $this->em->getRepository(Trip::class)->createQueryBuilder('t')
            ->leftJoin('t.group', 'g')
            ->leftJoin('g.members', 'm', 'WITH', 'm.user = :u AND m.status = :active')
            ->where('t.user = :u OR m.id IS NOT NULL')
            ->setParameter('u', $user)
            ->setParameter('active', GroupMember::STATUS_ACTIVE)
            ->orderBy('t.startDate', 'ASC')->addOrderBy('t.id', 'ASC')
            ->getQuery()->getResult();
    }

    private function tripSummary(Trip $t): array
    {
        return [
            'id'          => $t->getId(),
            'title'       => $t->getTitle(),
            'destination' => $t->getDestination(),
            'startDate'   => $t->getStartDate()->format('Y-m-d'),
            'endDate'     => $t->getEndDate()->format('Y-m-d'),
            'participantsCount' => count($this->access->participants($t)),
        ];
    }

    private function me(): User
    {
        /** @var User $me */
        $me = $this->getUser();
        return $me;
    }
}
