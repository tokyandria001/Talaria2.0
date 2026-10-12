<?php

namespace App\Controller;

use App\Entity\Friendship;
use App\Entity\Notification;
use App\Entity\User;
use App\Repository\FriendshipRepository;
use App\Service\UserPresenter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/** Phase 7 — amis : recherche d'utilisateurs, demandes, liste d'amis */
class FriendController extends AbstractController
{
    use ApiInputTrait;

    public function __construct(
        private EntityManagerInterface $em,
        private FriendshipRepository $friendships,
    ) {}

    /* ── Liste d'amis ─────────────────────────── */
    #[Route('/api/friends', name: 'api_friends_list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $me = $this->me();

        return $this->json(array_map(fn (Friendship $f) => [
            'friendshipId' => $f->getId(),
            'since'        => $f->getAcceptedAt()?->format('Y-m-d'),
            'user'         => UserPresenter::public($f->otherThan($me)),
        ], $this->friendships->findFriendshipsOf($me)));
    }

    /* ── Demandes en attente (reçues / envoyées) ─ */
    #[Route('/api/friends/requests', name: 'api_friends_requests', methods: ['GET'])]
    public function requests(): JsonResponse
    {
        $me = $this->me();
        $present = fn (Friendship $f) => [
            'id'        => $f->getId(),
            'createdAt' => $f->getCreatedAt()->format(\DateTimeInterface::ATOM),
            'user'      => UserPresenter::public($f->otherThan($me)),
        ];

        return $this->json([
            'received' => array_map($present, $this->friendships->findReceivedRequests($me)),
            'sent'     => array_map($present, $this->friendships->findSentRequests($me)),
        ]);
    }

    /* ── Envoyer une demande ──────────────────── */
    #[Route('/api/friends/requests', name: 'api_friends_request_send', methods: ['POST'])]
    public function send(Request $req): JsonResponse
    {
        $me   = $this->me();
        $data = json_decode($req->getContent(), true) ?? [];
        $userId = $this->parseInt($data['userId'] ?? null, 'utilisateur');

        $other = $userId ? $this->em->find(User::class, $userId) : null;
        if (!$other) return $this->json(['message' => 'Utilisateur introuvable.'], 404);
        if ($other->getId() === $me->getId()) {
            return $this->json(['message' => 'Vous ne pouvez pas vous ajouter vous-même.'], 400);
        }

        $existing = $this->friendships->findBetween($me, $other);
        if ($existing?->isAccepted()) {
            return $this->json(['message' => 'Vous êtes déjà amis.'], 409);
        }
        if ($existing && $existing->getRequester()->getId() === $me->getId()) {
            return $this->json(['message' => 'Demande déjà envoyée.'], 409);
        }

        // L'autre personne nous avait déjà envoyé une demande : on l'accepte directement
        if ($existing) {
            $existing->accept();
            $this->notify($other, $me, 'friend_accept', $this->name($me) . ' a accepté votre demande d\'ami');
            $this->em->flush();
            return $this->json(['status' => 'friends', 'friendshipId' => $existing->getId()], 200);
        }

        $friendship = (new Friendship())->setRequester($me)->setAddressee($other);
        $this->em->persist($friendship);
        $this->notify($other, $me, 'friend_request', $this->name($me) . ' vous a envoyé une demande d\'ami');
        $this->em->flush();

        return $this->json(['status' => 'request_sent', 'requestId' => $friendship->getId()], 201);
    }

    /* ── Accepter une demande reçue ───────────── */
    #[Route('/api/friends/requests/{id}/accept', name: 'api_friends_request_accept', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function accept(int $id): JsonResponse
    {
        $me = $this->me();
        $request = $this->receivedRequest($id, $me);
        if (!$request) return $this->json(['message' => 'Demande introuvable.'], 404);

        $request->accept();
        $this->notify($request->getRequester(), $me, 'friend_accept', $this->name($me) . ' a accepté votre demande d\'ami');
        $this->em->flush();

        return $this->json(['status' => 'friends', 'friendshipId' => $request->getId()]);
    }

    /* ── Refuser une demande reçue ────────────── */
    #[Route('/api/friends/requests/{id}/decline', name: 'api_friends_request_decline', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function decline(int $id): JsonResponse
    {
        $request = $this->receivedRequest($id, $this->me());
        if (!$request) return $this->json(['message' => 'Demande introuvable.'], 404);

        $this->em->remove($request);
        $this->em->flush();

        return $this->json(null, 204);
    }

    /* ── Annuler une demande envoyée ──────────── */
    #[Route('/api/friends/requests/{id}', name: 'api_friends_request_cancel', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function cancel(int $id): JsonResponse
    {
        $request = $this->friendships->find($id);
        if (!$request || $request->isAccepted() || $request->getRequester()->getId() !== $this->me()->getId()) {
            return $this->json(['message' => 'Demande introuvable.'], 404);
        }

        $this->em->remove($request);
        $this->em->flush();

        return $this->json(null, 204);
    }

    /* ── Retirer un ami ───────────────────────── */
    #[Route('/api/friends/{userId}', name: 'api_friends_remove', methods: ['DELETE'], requirements: ['userId' => '\d+'])]
    public function remove(int $userId): JsonResponse
    {
        $me = $this->me();
        $other = $this->em->find(User::class, $userId);
        $friendship = $other ? $this->friendships->findBetween($me, $other) : null;
        if (!$friendship?->isAccepted()) return $this->json(['message' => 'Cet utilisateur n\'est pas dans vos amis.'], 404);

        $this->em->remove($friendship);
        $this->em->flush();

        return $this->json(null, 204);
    }

    /* ── Recherche d'utilisateurs ─────────────── */
    #[Route('/api/users/search', name: 'api_users_search', methods: ['GET'])]
    public function search(Request $req): JsonResponse
    {
        $me = $this->me();
        $q  = trim((string) $req->query->get('q', ''));
        if (mb_strlen($q) < 2) return $this->json([]);

        // Pseudo / prénom / nom (partiel), ou email exact — l'email n'est jamais renvoyé
        $like = '%' . addcslashes(mb_strtolower($q), '%_') . '%';
        $users = $this->em->getRepository(User::class)->createQueryBuilder('u')
            ->where('u.id != :me')
            ->andWhere('LOWER(u.username) LIKE :like OR LOWER(u.firstName) LIKE :like OR LOWER(u.lastName) LIKE :like
                        OR LOWER(CONCAT(CONCAT(COALESCE(u.firstName, \'\'), \' \'), COALESCE(u.lastName, \'\'))) LIKE :like
                        OR LOWER(u.email) = :email')
            ->setParameter('me', $me->getId())
            ->setParameter('like', $like)
            ->setParameter('email', mb_strtolower($q))
            ->orderBy('u.firstName', 'ASC')
            ->setMaxResults(20)
            ->getQuery()->getResult();

        $relations = $this->friendships->findRelationsWith($me, array_map(fn (User $u) => $u->getId(), $users));

        return $this->json(array_map(function (User $u) use ($me, $relations) {
            $f = $relations[$u->getId()] ?? null;
            $relation = match (true) {
                $f === null                                     => 'none',
                $f->isAccepted()                                => 'friends',
                $f->getRequester()->getId() === $me->getId()    => 'request_sent',
                default                                         => 'request_received',
            };
            return UserPresenter::public($u) + ['relation' => $relation, 'requestId' => $f && !$f->isAccepted() ? $f->getId() : null];
        }, $users));
    }

    /* ── Helpers ──────────────────────────────── */

    private function me(): User
    {
        /** @var User $me */
        $me = $this->getUser();
        return $me;
    }

    private function receivedRequest(int $id, User $me): ?Friendship
    {
        $f = $this->friendships->find($id);
        return $f && !$f->isAccepted() && $f->getAddressee()->getId() === $me->getId() ? $f : null;
    }

    private function name(User $u): string
    {
        return UserPresenter::public($u)['displayName'];
    }

    private function notify(User $recipient, User $from, string $type, string $message): void
    {
        $this->em->persist((new Notification())
            ->setRecipient($recipient)
            ->setFromUser($from)
            ->setType($type)
            ->setMessage($message));
    }
}
