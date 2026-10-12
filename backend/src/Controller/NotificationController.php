<?php

namespace App\Controller;

use App\Entity\Notification;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/notifications', name: 'api_notif_')]
class NotificationController extends AbstractController
{
    public function __construct(private EntityManagerInterface $em) {}

    /* ── Liste (20 dernières) ─────────────────── */
    #[Route('', methods: ['GET'])]
    public function list(): JsonResponse
    {
        /** @var User $me */
        $me = $this->getUser();

        $notifs = $this->em->getRepository(Notification::class)
            ->findBy(['recipient' => $me], ['createdAt' => 'DESC'], 20);

        return $this->json(array_map(fn($n) => $this->serialize($n), $notifs));
    }

    /* ── Nombre non lus ───────────────────────── */
    #[Route('/unread-count', methods: ['GET'])]
    public function unreadCount(): JsonResponse
    {
        /** @var User $me */
        $me = $this->getUser();

        $count = $this->em->getRepository(Notification::class)
            ->count(['recipient' => $me, 'isRead' => false]);

        return $this->json(['count' => $count]);
    }

    /* ── Marquer une notif comme lue ──────────── */
    #[Route('/{id}/read', methods: ['POST'])]
    public function markRead(int $id): JsonResponse
    {
        /** @var User $me */
        $me    = $this->getUser();
        $notif = $this->em->find(Notification::class, $id);

        if (!$notif || $notif->getRecipient()->getId() !== $me->getId()) {
            return $this->json(['message' => 'Introuvable.'], 404);
        }

        $notif->setIsRead(true);
        $this->em->flush();

        return $this->json(['ok' => true]);
    }

    /* ── Tout marquer comme lu ────────────────── */
    #[Route('/read-all', methods: ['POST'])]
    public function readAll(): JsonResponse
    {
        /** @var User $me */
        $me = $this->getUser();

        $this->em->createQueryBuilder()
            ->update(Notification::class, 'n')
            ->set('n.isRead', ':true')
            ->where('n.recipient = :me')
            ->andWhere('n.isRead = :false')
            ->setParameter('true',  true)
            ->setParameter('false', false)
            ->setParameter('me',    $me)
            ->getQuery()
            ->execute();

        return $this->json(['ok' => true]);
    }

    /* ── Helper ───────────────────────────────── */
    private function serialize(Notification $n): array
    {
        $from = $n->getFromUser();
        $article = $n->getArticle();

        return [
            'id'        => $n->getId(),
            'type'      => $n->getType(),
            'message'   => $n->getMessage(),
            'isRead'    => $n->isRead(),
            'createdAt' => $n->getCreatedAt()->format('c'),
            'fromUser'  => $from ? [
                'id'        => $from->getId(),
                'firstName' => $from->getFirstName() ?? '',
                'lastName'  => $from->getLastName()  ?? '',
            ] : null,
            'article' => $article ? [
                'id'    => $article->getId(),
                'title' => $article->getTitle(),
            ] : null,
            'group' => $n->getGroup() ? [
                'id'   => $n->getGroup()->getId(),
                'name' => $n->getGroup()->getName(),
            ] : null,
        ];
    }
}
