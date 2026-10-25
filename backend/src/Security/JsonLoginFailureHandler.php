<?php

namespace App\Security;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Exception\AccountStatusException;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Core\Exception\TooManyLoginAttemptsAuthenticationException;
use Symfony\Component\Security\Http\Authentication\AuthenticationFailureHandlerInterface;

/** Réponses JSON en français pour les échecs de connexion (mauvais identifiants, trop d'essais) */
final class JsonLoginFailureHandler implements AuthenticationFailureHandlerInterface
{
    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): JsonResponse
    {
        // "detail" en plus de "message" : champ lu par le site web app.talaria.world
        if ($exception instanceof TooManyLoginAttemptsAuthenticationException) {
            $minutes = max(1, (int) ($exception->getMessageData()['%minutes%'] ?? 1));
            $message = sprintf('Trop de tentatives de connexion. Réessayez dans %d minute%s.', $minutes, $minutes > 1 ? 's' : '');
            return new JsonResponse(['code' => 429, 'message' => $message, 'detail' => $message], 429, ['Retry-After' => (string) ($minutes * 60)]);
        }

        // Compte suspendu (signalé après la vérification du mot de passe)
        if ($exception instanceof AccountStatusException) {
            $message = $exception->getMessageKey();
            return new JsonResponse(['code' => 403, 'message' => $message, 'detail' => $message], 403);
        }

        $message = 'Email ou mot de passe incorrect.';
        return new JsonResponse(['code' => 401, 'message' => $message, 'detail' => $message], 401);
    }
}
