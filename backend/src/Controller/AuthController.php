<?php

namespace App\Controller;

use App\Entity\User;
use App\Service\UserPresenter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Validator\ValidatorInterface;

#[Route('/api/auth', name: 'auth_')]
class AuthController extends AbstractController
{
    #[Route('/register', name: 'register', methods: ['POST'])]
    public function register(
        Request $request,
        UserPasswordHasherInterface $hasher,
        EntityManagerInterface $em,
        ValidatorInterface $validator,
        RateLimiterFactory $registrationLimiter,
    ): JsonResponse {
        // Anti-création de comptes en masse : 5 inscriptions par heure et par IP
        $limit = $registrationLimiter->create($request->getClientIp() ?? 'unknown')->consume();
        if (!$limit->isAccepted()) {
            $minutes = max(1, (int) ceil(($limit->getRetryAfter()->getTimestamp() - time()) / 60));
            return $this->json(
                $this->error(sprintf('Trop d\'inscriptions depuis cette adresse. Réessayez dans %d minute%s.', $minutes, $minutes > 1 ? 's' : '')),
                429,
                ['Retry-After' => (string) ($minutes * 60)],
            );
        }

        $data = json_decode($request->getContent(), true);

        if (!isset($data['email'], $data['password'])) {
            return $this->json($this->error('Email et mot de passe requis.'), 400);
        }

        $existing = $em->getRepository(User::class)->findOneBy(['email' => $data['email']]);
        if ($existing) {
            return $this->json($this->error('Un compte existe déjà avec cet email.'), 409);
        }

        $user = new User();
        $user->setEmail($data['email']);
        $user->setFirstName($data['firstName'] ?? null);
        $user->setLastName($data['lastName'] ?? null);
        // Pseudo facultatif (champ "username" du site web)
        $user->setPseudo(!empty($data['username']) ? trim((string) $data['username']) : null);
        $user->setPassword($hasher->hashPassword($user, $data['password']));

        $errors = $validator->validate($user);
        if (count($errors) > 0) {
            $messages = [];
            foreach ($errors as $error) {
                $messages[$error->getPropertyPath()] = $error->getMessage();
            }
            return $this->json(['errors' => $messages] + $this->error('Données invalides.', implode(' ', $messages)), 422);
        }

        $em->persist($user);
        $em->flush();

        return $this->json([
            'message' => 'Compte créé avec succès.',
            'user' => $this->serializeUser($user),
        ], 201);
    }

    #[Route('/me', name: 'me', methods: ['GET'])]
    public function me(): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['message' => 'Non authentifié.'], 401);
        }

        return $this->json(['user' => $this->serializeUser($user)]);
    }

    /** Erreur au format { message, detail } : "detail" est le champ lu par le site web app.talaria.world */
    private function error(string $message, ?string $detail = null): array
    {
        return ['message' => $message, 'detail' => $detail ?? $message];
    }

    private function serializeUser(User $user): array
    {
        return UserPresenter::self($user);
    }
}
