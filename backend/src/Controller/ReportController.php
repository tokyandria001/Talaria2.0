<?php

namespace App\Controller;

use App\Entity\User;
use App\Exception\InvalidInputException;
use App\Service\Moderation;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Signaler un contenu : { targetType: article|comment|place|user|group, targetId, reason, comment?, photo? }.
 * Motifs : haine, sexuel, violence, harcelement, spam, autre. 20 signalements par heure et par utilisateur.
 */
class ReportController extends AbstractController
{
    #[Route('/api/reports', name: 'api_report_create', methods: ['POST'])]
    public function create(Request $request, Moderation $moderation, RateLimiterFactory $reportLimiter): JsonResponse
    {
        /** @var User $me */
        $me = $this->getUser();
        if (!$reportLimiter->create((string) $me->getId())->consume()->isAccepted()) {
            throw new InvalidInputException('Trop de signalements envoyés. Réessayez dans un moment.', 429);
        }

        $data = json_decode($request->getContent(), true) ?? [];
        $id = $data['targetId'] ?? null;
        if (!is_numeric($id)) throw new InvalidInputException('Contenu signalé manquant (targetId).');

        $moderation->report(
            $me,
            (string) ($data['targetType'] ?? ''),
            (int) $id,
            (string) ($data['reason'] ?? ''),
            isset($data['comment']) && is_string($data['comment']) ? $data['comment'] : null,
            isset($data['photo']) && is_string($data['photo']) ? $data['photo'] : null,
        );

        return $this->json(['message' => 'Merci, ton signalement a été transmis à l\'équipe Talaria.'], 201);
    }
}
