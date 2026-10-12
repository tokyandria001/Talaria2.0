<?php

namespace App\Security;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Core\Exception\TooManyLoginAttemptsAuthenticationException;
use Symfony\Component\Security\Http\Authentication\AuthenticationFailureHandlerInterface;

/** Réponses JSON en français pour les échecs de connexion (mauvais identifiants, trop d'essais) */
final class JsonLoginFailureHandler implements AuthenticationFailureHandlerInterface
{
    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): JsonResponse
    {
        if ($exception instanceof TooManyLoginAttemptsAuthenticationException) {
            $minutes = max(1, (int) ($exception->getMessageData()['%minutes%'] ?? 1));
            return new JsonResponse([
                'code'    => 429,
                'message' => sprintf('Trop de tentatives de connexion. Réessayez dans %d minute%s.', $minutes, $minutes > 1 ? 's' : ''),
            ], 429, ['Retry-After' => (string) ($minutes * 60)]);
        }

        return new JsonResponse(['code' => 401, 'message' => 'Email ou mot de passe incorrect.'], 401);
    }
}
