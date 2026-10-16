<?php

namespace App\Controller;

use App\Entity\User;
use App\Service\GoogleTokenVerifier;
use App\Service\Referrals;
use App\Service\UserPresenter;
use App\Service\UsernameSuggester;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Security\Http\Authentication\AuthenticationSuccessHandler;
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
        Referrals $referrals,
        UsernameSuggester $usernames,
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
            return $this->json($this->error($existing->hasPassword()
                ? 'Un compte existe déjà avec cet email.'
                : 'Un compte existe déjà avec cet email : connecte-toi avec Google.'), 409);
        }

        $user = new User();
        $user->setEmail($data['email']);
        $user->setFirstName($data['firstName'] ?? null);
        $user->setLastName($data['lastName'] ?? null);
        // Pseudo facultatif (champ "username" du site web)
        $user->setPseudo(!empty($data['username']) ? trim((string) $data['username']) : null);
        // Sans pseudo choisi : un pseudo libre d'après le prénom ou l'email (il sert de code de parrainage)
        $usernames->ensure($user);
        $user->setPassword($hasher->hashPassword($user, $data['password']));
        // Lien d'invitation (?invite=<pseudo du parrain>) : facultatif, ignoré s'il ne correspond à personne
        $referrals->apply($user, $data['invite'] ?? null);

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

    /**
     * Connexion ou inscription avec Google : { idToken } (jeton obtenu par l'app ou le site auprès de Google).
     * Compte retrouvé par son identifiant Google, sinon par son email (il est alors lié à Google),
     * sinon créé sans mot de passe. Réponse identique à /api/auth/login, plus « isNewUser ».
     */
    #[Route('/google', name: 'google', methods: ['POST'])]
    public function google(
        Request $request,
        GoogleTokenVerifier $verifier,
        EntityManagerInterface $em,
        RateLimiterFactory $registrationLimiter,
        AuthenticationSuccessHandler $success,
        Referrals $referrals,
        UsernameSuggester $usernames,
    ): JsonResponse {
        $data = json_decode($request->getContent(), true) ?? [];
        $idToken = is_string($data['idToken'] ?? null) ? $data['idToken'] : '';
        if ($idToken === '') {
            return $this->json($this->error('Jeton Google requis (idToken).'), 400);
        }

        try {
            $claims = $verifier->verify($idToken);
        } catch (\RuntimeException $e) {
            return $this->json($this->error('Connexion Google refusée.', $e->getMessage()), 401);
        }

        $repo = $em->getRepository(User::class);
        $user = $repo->findOneBy(['googleId' => $claims['sub']]) ?? $repo->findOneBy(['email' => $claims['email']]);
        $isNew = $user === null;

        if ($isNew) {
            // Même limite que l'inscription classique : 5 comptes par heure et par IP
            $limit = $registrationLimiter->create($request->getClientIp() ?? 'unknown')->consume();
            if (!$limit->isAccepted()) {
                return $this->json($this->error('Trop d\'inscriptions depuis cette adresse. Réessayez plus tard.'), 429);
            }
            $picture = $claims['picture'] ?? null;
            $user = (new User())
                ->setEmail($claims['email'])
                ->setFirstName(isset($claims['given_name']) ? mb_substr($claims['given_name'], 0, 100) : null)
                ->setLastName(isset($claims['family_name']) ? mb_substr($claims['family_name'], 0, 100) : null)
                ->setProfilePicture(is_string($picture) && strlen($picture) <= 255 ? $picture : null);
            $referrals->apply($user, $data['invite'] ?? null);
            $usernames->ensure($user);
            $em->persist($user);
        } elseif ($user->getGoogleId() !== null && $user->getGoogleId() !== $claims['sub']) {
            return $this->json($this->error('Cet email est déjà lié à un autre compte Google.'), 409);
        }
        // Email vérifié par Google : le compte existant est lié à ce compte Google
        $user->setGoogleId($claims['sub']);
        $em->flush();

        // Même réponse que /api/auth/login (jeton, jeton de renouvellement, utilisateur)
        $response = $success->handleAuthenticationSuccess($user);
        $body = json_decode((string) $response->getContent(), true) + ['isNewUser' => $isNew];

        return $this->json($body, $isNew ? 201 : 200);
    }

    #[Route('/me', name: 'me', methods: ['GET'])]
    public function me(Referrals $referrals): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['message' => 'Non authentifié.'], 401);
        }

        return $this->json(['user' => $this->serializeUser($user) + ['referralsCount' => $referrals->count($user)]]);
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
