<?php

namespace App\Controller;

use App\Entity\User;
use App\Exception\InvalidInputException;
use App\Service\Moderation;
use App\Service\SessionTokens;
use App\Service\UserPresenter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Administration (rôle ROLE_ADMIN, vérifié par security.yaml sur tout /api/admin) : signalements et comptes.
 */
#[Route('/api/admin', name: 'api_admin_')]
class AdminController extends AbstractController
{
    public function __construct(private Moderation $moderation, private EntityManagerInterface $em) {}

    /** Signalements en cours, regroupés par contenu, les plus signalés d'abord */
    #[Route('/reports', name: 'reports', methods: ['GET'])]
    public function reports(): JsonResponse
    {
        $items = $this->moderation->openReports();
        return $this->json(['count' => count($items), 'items' => $items]);
    }

    /** Décision : { targetType, targetId, action: dismiss|remove, photo? } */
    #[Route('/reports/resolve', name: 'reports_resolve', methods: ['POST'])]
    public function resolve(Request $request): JsonResponse
    {
        /** @var User $me */
        $me = $this->getUser();
        $data = json_decode($request->getContent(), true) ?? [];
        if (!is_numeric($data['targetId'] ?? null)) throw new InvalidInputException('Contenu manquant (targetId).');

        $this->moderation->resolve($me, (string) ($data['targetType'] ?? ''), (int) $data['targetId'],
            (string) ($data['action'] ?? ''), isset($data['photo']) && is_string($data['photo']) ? $data['photo'] : null);

        return $this->json(['ok' => true]);
    }

    /** Suspendre ou rétablir un compte : { suspended: true|false }. Les sessions du compte suspendu sont fermées. */
    #[Route('/users/{id}/suspend', name: 'user_suspend', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function suspend(int $id, Request $request, SessionTokens $sessions): JsonResponse
    {
        /** @var User $me */
        $me = $this->getUser();
        $user = $this->em->find(User::class, $id);
        if (!$user) return $this->json(['message' => 'Utilisateur introuvable.'], 404);
        if ($user === $me) throw new InvalidInputException('Impossible de suspendre ton propre compte.');

        $data = json_decode($request->getContent(), true) ?? [];
        $suspended = ($data['suspended'] ?? true) !== false;
        $user->setSuspended($suspended);
        $this->em->flush();
        if ($suspended) $sessions->revokeAll($user);

        return $this->json(['user' => UserPresenter::public($user) + ['suspended' => $user->isSuspended()]]);
    }
}
