<?php

namespace App\Controller;

use App\Service\SessionTokens;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Déconnexion d'un appareil : son jeton de renouvellement est supprimé.
 * Publique (le jeton d'accès peut déjà avoir expiré) : le jeton de renouvellement sert de preuve.
 *
 * Le renouvellement lui-même (POST /api/token/refresh) est géré par gesdinet/jwt-refresh-token-bundle.
 */
class TokenController extends AbstractController
{
    #[Route('/api/token/revoke', name: 'api_token_revoke', methods: ['POST'])]
    public function revoke(Request $request, SessionTokens $sessions): JsonResponse
    {
        $data = json_decode($request->getContent(), true) ?? [];
        $token = is_string($data['refresh_token'] ?? null) ? $data['refresh_token'] : '';

        return $this->json(['revoked' => $token !== '' && $sessions->revoke($token)]);
    }
}
