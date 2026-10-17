<?php

namespace App\Controller;

use App\Entity\Article;
use App\Entity\Comment;
use App\Entity\Expense;
use App\Entity\Friendship;
use App\Entity\GroupMember;
use App\Entity\Place;
use App\Entity\Trip;
use App\Entity\TripMessage;
use App\Entity\User;
use App\Service\Blocking;
use App\Service\ImageMetadataStripper;
use App\Service\ImageUploader;
use App\Service\Referrals;
use App\Service\UsernameSuggester;
use App\Service\SessionTokens;
use App\Service\UserPresenter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Validator\ValidatorInterface;

#[Route('/api/profile', name: 'profile_')]
class ProfileController extends AbstractController
{
    use ApiInputTrait;

    public function __construct(private EntityManagerInterface $em) {}

    #[Route('', name: 'get', methods: ['GET'])]
    public function get(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        $counts = [
            'articles' => $this->em->getRepository(Article::class)->count(['author' => $user]),
            'places'   => $this->em->getRepository(Place::class)->count(['createdBy' => $user]),
            'trips'    => $this->em->getRepository(Trip::class)->count(['user' => $user]),
            'referrals' => $this->em->getRepository(User::class)->count(['referredBy' => $user]),
        ];
        return $this->json(['user' => $this->serializeUser($user), 'counts' => $counts]);
    }

    #[Route('', name: 'update', methods: ['PUT', 'PATCH'])]
    public function update(
        Request $request,
        EntityManagerInterface $em,
        ValidatorInterface $validator,
        UsernameSuggester $usernames,
    ): JsonResponse {
        /** @var User $user */
        $user = $this->getUser();
        $data = json_decode($request->getContent(), true) ?? [];

        if (isset($data['firstName'])) $user->setFirstName($data['firstName']);
        if (isset($data['lastName'])) $user->setLastName($data['lastName']);
        if (array_key_exists('username', $data)) $user->setPseudo($data['username'] ?: null);
        if (array_key_exists('averageBudget', $data)) $user->setAverageBudget($this->parseInt($data['averageBudget'], 'budget moyen'));
        if (isset($data['activityTags']) && is_array($data['activityTags'])) $user->setActivityTags($data['activityTags']);
        if (isset($data['travelStyle'])) $user->setTravelStyle($data['travelStyle']);
        if (isset($data['travelPace'])) $user->setTravelPace($data['travelPace']);
        if (isset($data['favoriteTransport'])) $user->setFavoriteTransport($data['favoriteTransport']);
        if (isset($data['interests']) && is_array($data['interests'])) $user->setInterests($data['interests']);

        // Profil et paramètres (maquettes 27 à 37)
        if (array_key_exists('bio', $data))   $user->setBio(trim((string) $data['bio']) ?: null);
        if (array_key_exists('phone', $data)) $user->setPhone(trim((string) $data['phone']) ?: null);
        foreach (['hasCar' => 'setHasCar', 'hasDrivingLicense' => 'setHasDrivingLicense', 'profilePublic' => 'setProfilePublic'] as $key => $setter) {
            if (array_key_exists($key, $data)) $user->$setter((bool) $data[$key]);
        }
        if (array_key_exists('invitePolicy', $data)) $user->setInvitePolicy((string) $data['invitePolicy']);
        if (isset($data['travelPreferences']) && is_array($data['travelPreferences'])) {
            $user->setTravelPreferences($this->cleanTravelPreferences($data['travelPreferences'], $user->getTravelPreferences()));
        }
        if (isset($data['settings']) && is_array($data['settings'])) {
            $user->setSettings($this->cleanSettings($data['settings'], $user->getSettings()));
        }

        // Onboarding (questions après l'inscription)
        if (array_key_exists('birthYear', $data)) $user->setBirthYear($this->parseInt($data['birthYear'], 'année de naissance'));
        if (array_key_exists('homeCity', $data)) {
            $user->setHomeCity(mb_substr(trim((string) $data['homeCity']), 0, 120) ?: null);
            $user->setHomeLatitude($this->parseFloat($data['homeLatitude'] ?? null, 'latitude'));
            $user->setHomeLongitude($this->parseFloat($data['homeLongitude'] ?? null, 'longitude'));
        }
        if (isset($data['homeHubs']) && is_array($data['homeHubs'])) {
            $user->setHomeHubs(array_slice(array_values(array_unique(array_filter(array_map(
                fn ($h) => is_string($h) ? mb_substr(trim($h), 0, 80) : '', $data['homeHubs']
            )))), 0, 6));
        }
        if (isset($data['travelerTypes']) && is_array($data['travelerTypes'])) {
            $types = array_slice(array_values(array_intersect(User::TRAVELER_TYPES, array_map('strval', $data['travelerTypes']))), 0, 3);
            $user->setTravelerTypes($types);
            // Les styles choisis complètent les centres d'intérêt (remplissage du planning)
            $tags = array_map(fn ($t) => User::TRAVELER_TYPE_TAGS[$t], $types);
            $user->setActivityTags(array_values(array_unique([...$user->getActivityTags(), ...$tags])));
        }
        if (array_key_exists('weekendBudget', $data)) $user->setWeekendBudget($this->parseInt($data['weekendBudget'], 'budget'));
        if (array_key_exists('companions', $data)) $user->setCompanions($data['companions'] ? (string) $data['companions'] : null);
        // « Je préfère ne pas dire » : null (textes neutres)
        if (array_key_exists('gender', $data)) $user->setGender($data['gender'] ? (string) $data['gender'] : null);
        if (isset($data['wishlist']) && is_array($data['wishlist'])) {
            $user->setWishlist(array_slice(array_values(array_unique(array_filter(array_map(
                fn ($w) => is_string($w) ? mb_substr(trim($w), 0, 60) : '', $data['wishlist']
            )))), 0, 30));
        }
        if (!empty($data['completeOnboarding'])) {
            $user->setOnboardedAt($user->getOnboardedAt() ?? new \DateTimeImmutable());
            // Pseudo pas encore choisi (aucun, ou celui tiré de l'email à l'inscription) : un pseudo sur le prénom
            if ($user->getFirstName() && (!$user->getPseudo() || $usernames->isFromEmail($user))) {
                $user->setPseudo($usernames->suggest($user->getFirstName(), $user));
            }
        }

        $errors = $validator->validate($user);
        if (count($errors) > 0) return $this->validationError($errors);

        $em->flush();

        return $this->json(['user' => $this->serializeUser($user)]);
    }

    #[Route('/picture', name: 'picture', methods: ['POST'])]
    public function uploadPicture(
        Request $request,
        EntityManagerInterface $em,
        ImageMetadataStripper $stripper,
    ): JsonResponse {
        /** @var User $user */
        $user = $this->getUser();
        $file = $request->files->get('picture');

        if (!$file) {
            return $this->json(['message' => 'Aucun fichier fourni.'], 400);
        }

        $allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!in_array($file->getMimeType(), $allowed)) {
            return $this->json(['message' => 'Format non supporté. JPEG, PNG, WEBP ou GIF uniquement.'], 415);
        }

        if ($file->getSize() > 5 * 1024 * 1024) {
            return $this->json(['message' => 'Image trop lourde (max 5 Mo).'], 413);
        }

        $uploadsDir = $this->getParameter('kernel.project_dir') . '/public/uploads/avatars';
        if (!is_dir($uploadsDir)) {
            mkdir($uploadsDir, 0755, true);
        }

        // Remove old avatar
        if ($user->getProfilePicture()) {
            $oldPath = $this->getParameter('kernel.project_dir') . '/public' . $user->getProfilePicture();
            if (file_exists($oldPath)) {
                unlink($oldPath);
            }
        }

        $filename = sprintf('%s_%s.%s', $user->getId(), uniqid(), $file->guessExtension());
        $file->move($uploadsDir, $filename);
        // Position GPS, appareil, date... retirés de la photo
        $stripper->strip($uploadsDir . '/' . $filename);

        $publicPath = '/uploads/avatars/' . $filename;
        $user->setProfilePicture($publicPath);
        $em->flush();

        return $this->json(['profilePicture' => $publicPath]);
    }

    /** Photo de couverture du profil (multipart, champ « cover ») ; l'ancienne est supprimée */
    #[Route('/cover', name: 'cover', methods: ['POST'])]
    public function uploadCover(Request $request, ImageUploader $uploader): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        $user->setCoverPhoto($uploader->upload($request->files->get('cover'), 'covers', (string) $user->getId(), $user->getCoverPhoto()));
        $this->em->flush();

        return $this->json(['coverPhoto' => $user->getCoverPhoto()]);
    }

    /** Retirer la photo de couverture (retour à la photo par défaut) */
    #[Route('/cover', name: 'cover_delete', methods: ['DELETE'])]
    public function deleteCover(ImageUploader $uploader): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        $uploader->remove($user->getCoverPhoto());
        $user->setCoverPhoto(null);
        $this->em->flush();

        return $this->json(['coverPhoto' => null]);
    }

    /**
     * Demande de suppression du compte (mot de passe requis) : effective 30 jours plus tard,
     * par la commande app:purge-deleted-accounts. Annulable d'ici là avec POST /restore.
     */
    #[Route('', name: 'delete', methods: ['DELETE'])]
    public function deleteAccount(Request $request, UserPasswordHasherInterface $hasher, SessionTokens $sessions): JsonResponse
    {
        /** @var User $me */
        $me   = $this->getUser();
        $data = json_decode($request->getContent(), true) ?? [];

        // Compte Google sans mot de passe : la session en cours suffit
        if ($me->hasPassword()) {
            if (empty($data['password'])) {
                return $this->json(['message' => 'Mot de passe requis pour confirmer la suppression.'], 400);
            }
            if (!$hasher->isPasswordValid($me, $data['password'])) {
                return $this->json(['message' => 'Mot de passe incorrect.'], 401);
            }
        }

        if (!$me->getDeletionRequestedAt()) {
            $me->setDeletionRequestedAt(new \DateTimeImmutable());
            $this->em->flush();
        }
        $sessions->revokeAll($me);

        return $this->json([
            'message' => sprintf('Votre compte sera supprimé le %s. Reconnectez-vous d\'ici là pour annuler.', $me->getDeletionScheduledFor()->format('d/m/Y')),
            'deletionScheduledFor' => $me->getDeletionScheduledFor()->format('Y-m-d'),
        ]);
    }

    /** Annuler la suppression demandée */
    #[Route('/restore', name: 'restore', methods: ['POST'])]
    public function restore(): JsonResponse
    {
        /** @var User $me */
        $me = $this->getUser();
        $me->setDeletionRequestedAt(null);
        $this->em->flush();

        return $this->json(['user' => $this->serializeUser($me)]);
    }

    /** Export RGPD : toutes les données du compte, dans un fichier JSON téléchargeable */
    #[Route('/export', name: 'export', methods: ['GET'])]
    public function export(): JsonResponse
    {
        /** @var User $me */
        $me = $this->getUser();
        $date = fn (?\DateTimeInterface $d) => $d?->format(\DateTimeInterface::ATOM);

        $friendships = $this->em->createQuery(
            'SELECT f FROM App\Entity\Friendship f WHERE f.requester = :me OR f.addressee = :me',
        )->setParameter('me', $me)->getResult();

        $data = [
            'exportedAt' => $date(new \DateTimeImmutable()),
            'account'    => $this->serializeUser($me) + [
                'referredBy' => $me->getReferredBy() ? UserPresenter::public($me->getReferredBy()) : null,
            ],
            'trips'      => array_map(fn (Trip $t) => [
                'id' => $t->getId(), 'title' => $t->getTitle(), 'destination' => $t->getDestination(),
                'departureCity' => $t->getDepartureCity(),
                'startDate' => $t->getStartDate()->format('Y-m-d'), 'endDate' => $t->getEndDate()->format('Y-m-d'),
                'budget' => $t->getBudget(), 'travelers' => $t->getTravelers(),
            ], $this->em->getRepository(Trip::class)->findBy(['user' => $me])),
            'groups' => array_map(fn (GroupMember $m) => [
                'group' => $m->getGroup()->getName(), 'role' => $m->getRole(), 'status' => $m->getStatus(),
            ], $this->em->getRepository(GroupMember::class)->findBy(['user' => $me])),
            'friends' => array_map(fn (Friendship $f) => [
                'user' => UserPresenter::public($f->otherThan($me)), 'accepted' => $f->isAccepted(),
                'since' => $date($f->getAcceptedAt()),
            ], $friendships),
            'expensesPaid' => array_map(fn (Expense $e) => [
                'trip' => $e->getTrip()->getDestination(), 'label' => $e->getLabel(),
                'amount' => $e->getAmountCents() / 100, 'category' => $e->getCategory(), 'createdAt' => $date($e->getCreatedAt()),
            ], $this->em->getRepository(Expense::class)->findBy(['paidBy' => $me])),
            'messages' => array_map(fn (TripMessage $m) => [
                'trip' => $m->getTrip()->getDestination(), 'body' => $m->getBody(), 'createdAt' => $date($m->getCreatedAt()),
            ], $this->em->getRepository(TripMessage::class)->findBy(['author' => $me])),
            'articles' => array_map(fn (Article $a) => [
                'title' => $a->getTitle(), 'category' => $a->getCategory(), 'content' => $a->getContent(),
            ], $this->em->getRepository(Article::class)->findBy(['author' => $me])),
            'comments' => array_map(fn (Comment $c) => [
                'article' => $c->getArticle()->getTitle(), 'content' => $c->getContent(),
            ], $this->em->getRepository(Comment::class)->findBy(['author' => $me])),
            'places' => array_map(fn (Place $p) => [
                'name' => $p->getName(), 'address' => $p->getAddress(), 'tags' => $p->getTags(),
                'latitude' => $p->getLatitude(), 'longitude' => $p->getLongitude(),
            ], $this->em->getRepository(Place::class)->findBy(['createdBy' => $me])),
        ];

        $response = new JsonResponse($data, 200, [], false);
        $response->setEncodingOptions(JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $response->headers->set('Content-Disposition', sprintf('attachment; filename="talaria-mes-donnees-%s.json"', date('Y-m-d')));

        return $response;
    }

    /** Personnes que j'ai bloquées */
    /** Mes filleuls : les personnes inscrites avec mon lien d'invitation */
    #[Route('/referrals', name: 'referrals', methods: ['GET'])]
    public function referrals(Referrals $referrals): JsonResponse
    {
        /** @var User $me */
        $me = $this->getUser();
        $list = array_map(fn (User $u) => UserPresenter::public($u) + [
            'referredAt' => $u->getReferredAt()?->format(\DateTimeInterface::ATOM),
        ], $referrals->referredBy($me));

        return $this->json(['count' => count($list), 'referrals' => $list]);
    }

    #[Route('/blocked', name: 'blocked', methods: ['GET'])]
    public function blocked(Blocking $blocking): JsonResponse
    {
        /** @var User $me */
        $me = $this->getUser();

        return $this->json(array_map(fn ($b) => UserPresenter::public($b->getBlocked()) + [
            'blockedAt' => $b->getCreatedAt()->format(\DateTimeInterface::ATOM),
        ], $blocking->blockedBy($me)));
    }

    #[Route('/password', name: 'password', methods: ['PUT'])]
    public function changePassword(
        Request $request,
        UserPasswordHasherInterface $hasher,
        EntityManagerInterface $em,
        SessionTokens $sessions,
    ): JsonResponse {
        /** @var User $user */
        $user = $this->getUser();
        $data = json_decode($request->getContent(), true) ?? [];

        // Compte Google sans mot de passe : il en choisit un, sans mot de passe actuel
        if (empty($data['newPassword']) || ($user->hasPassword() && empty($data['currentPassword']))) {
            return $this->json(['message' => 'Mot de passe actuel et nouveau requis.'], 400);
        }

        if ($user->hasPassword() && !$hasher->isPasswordValid($user, $data['currentPassword'])) {
            return $this->json(['message' => 'Mot de passe actuel incorrect.'], 401);
        }

        if (strlen($data['newPassword']) < 8) {
            return $this->json(['message' => 'Le nouveau mot de passe doit faire au moins 8 caractères.'], 422);
        }

        $user->setPassword($hasher->hashPassword($user, $data['newPassword']));
        $user->setPasswordChangedAt(new \DateTimeImmutable());
        $em->flush();

        // Tous les appareils sont déconnectés ; celui qui vient de changer le mot de passe reste connecté
        $sessions->revokeAll($user);

        return $this->json(['message' => 'Mot de passe modifié avec succès.'] + $sessions->issue($user));
    }

    private function serializeUser(User $user): array
    {
        return UserPresenter::self($user);
    }

    /** Préférences de voyage : seules les valeurs connues sont gardées */
    private function cleanTravelPreferences(array $input, array $current): array
    {
        foreach (User::TRAVEL_PREFERENCES as $key => $allowed) {
            if (isset($input[$key]) && is_array($input[$key])) {
                $current[$key] = array_values(array_intersect($allowed, array_map('strval', $input[$key])));
            }
        }
        foreach (['ecoFriendly', 'directFlightsOnly'] as $key) {
            if (array_key_exists($key, $input)) $current[$key] = (bool) $input[$key];
        }
        return $current;
    }

    /** Réglages : seules les clés connues (DEFAULT_SETTINGS) sont gardées, avec leur type */
    private function cleanSettings(array $input, array $current): array
    {
        foreach (User::DEFAULT_SETTINGS['notifications'] as $key => $_) {
            if (isset($input['notifications']) && array_key_exists($key, (array) $input['notifications'])) {
                $current['notifications'][$key] = (bool) $input['notifications'][$key];
            }
        }
        if (array_key_exists('sharePosition', $input)) $current['sharePosition'] = (bool) $input['sharePosition'];
        // Seuls le français et l'euro sont disponibles pour l'instant
        if (($input['language'] ?? null) === 'fr') $current['language'] = 'fr';
        if (($input['currency'] ?? null) === 'EUR') $current['currency'] = 'EUR';

        $r = $input['reimbursements'] ?? null;
        if (is_array($r)) {
            foreach (['remindDebts', 'roundHalfEuro'] as $key) {
                if (array_key_exists($key, $r)) $current['reimbursements'][$key] = (bool) $r[$key];
            }
            if (isset($r['methods']) && is_array($r['methods'])) {
                $current['reimbursements']['methods'] = $this->cleanMethods($r['methods']);
            }
        }
        return $current;
    }

    /**
     * Moyens de remboursement : Lydia (numéro), PayPal (email ou lien), Wero (numéro),
     * virement (titulaire + 4 derniers chiffres de l'IBAN : jamais l'IBAN complet).
     */
    private function cleanMethods(array $methods): array
    {
        $clean = [];
        foreach (array_slice($methods, 0, 5) as $m) {
            if (!is_array($m)) continue;
            $type = (string) ($m['type'] ?? '');
            if (!in_array($type, ['lydia', 'paypal', 'wero', 'virement'], true)) continue;
            $item = ['type' => $type, 'isDefault' => (bool) ($m['isDefault'] ?? false)];
            if ($type === 'virement') {
                // Seuls les 4 derniers chiffres sont gardés, même si l'IBAN entier est saisi
                $last4 = substr(preg_replace('/\D/', '', (string) ($m['ibanLast4'] ?? '')), -4);
                if (strlen($last4) !== 4) throw new \App\Exception\InvalidInputException('Indiquez les 4 derniers chiffres de l\'IBAN.');
                $item['ibanLast4'] = $last4;
                $item['holder'] = mb_substr(trim((string) ($m['holder'] ?? '')), 0, 80) ?: null;
            } else {
                $handle = mb_substr(trim((string) ($m['handle'] ?? '')), 0, 120);
                if ($handle === '') throw new \App\Exception\InvalidInputException('Indiquez le numéro ou l\'adresse du moyen de remboursement.');
                $item['handle'] = $handle;
            }
            $clean[] = $item;
        }
        // Un seul moyen par défaut (le premier coché, sinon le premier)
        $default = array_search(true, array_column($clean, 'isDefault'), true);
        foreach ($clean as $i => &$item) $item['isDefault'] = $i === ($default === false ? 0 : $default);
        return $clean;
    }
}
