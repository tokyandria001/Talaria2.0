<?php

namespace App\Controller;

use App\Entity\User;
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
    #[Route('', name: 'get', methods: ['GET'])]
    public function get(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        return $this->json(['user' => $this->serializeUser($user)]);
    }

    #[Route('', name: 'update', methods: ['PUT', 'PATCH'])]
    public function update(
        Request $request,
        EntityManagerInterface $em,
        ValidatorInterface $validator,
    ): JsonResponse {
        /** @var User $user */
        $user = $this->getUser();
        $data = json_decode($request->getContent(), true) ?? [];

        if (isset($data['firstName'])) $user->setFirstName($data['firstName']);
        if (isset($data['lastName'])) $user->setLastName($data['lastName']);
        if (array_key_exists('username', $data)) $user->setPseudo($data['username'] ?: null);
        if (array_key_exists('averageBudget', $data)) $user->setAverageBudget($data['averageBudget']);
        if (isset($data['activityTags']) && is_array($data['activityTags'])) $user->setActivityTags($data['activityTags']);
        if (isset($data['travelStyle'])) $user->setTravelStyle($data['travelStyle']);
        if (isset($data['travelPace'])) $user->setTravelPace($data['travelPace']);
        if (isset($data['favoriteTransport'])) $user->setFavoriteTransport($data['favoriteTransport']);
        if (isset($data['interests']) && is_array($data['interests'])) $user->setInterests($data['interests']);

        $errors = $validator->validate($user);
        if (count($errors) > 0) {
            $messages = [];
            foreach ($errors as $error) {
                $messages[$error->getPropertyPath()] = $error->getMessage();
            }
            return $this->json(['message' => 'Données invalides.', 'errors' => $messages], 422);
        }

        $em->flush();

        return $this->json(['user' => $this->serializeUser($user)]);
    }

    #[Route('/picture', name: 'picture', methods: ['POST'])]
    public function uploadPicture(
        Request $request,
        EntityManagerInterface $em,
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

        $publicPath = '/uploads/avatars/' . $filename;
        $user->setProfilePicture($publicPath);
        $em->flush();

        return $this->json(['profilePicture' => $publicPath]);
    }

    #[Route('/password', name: 'password', methods: ['PUT'])]
    public function changePassword(
        Request $request,
        UserPasswordHasherInterface $hasher,
        EntityManagerInterface $em,
    ): JsonResponse {
        /** @var User $user */
        $user = $this->getUser();
        $data = json_decode($request->getContent(), true) ?? [];

        if (empty($data['currentPassword']) || empty($data['newPassword'])) {
            return $this->json(['message' => 'Mot de passe actuel et nouveau requis.'], 400);
        }

        if (!$hasher->isPasswordValid($user, $data['currentPassword'])) {
            return $this->json(['message' => 'Mot de passe actuel incorrect.'], 401);
        }

        if (strlen($data['newPassword']) < 8) {
            return $this->json(['message' => 'Le nouveau mot de passe doit faire au moins 8 caractères.'], 422);
        }

        $user->setPassword($hasher->hashPassword($user, $data['newPassword']));
        $em->flush();

        return $this->json(['message' => 'Mot de passe modifié avec succès.']);
    }

    private function serializeUser(User $user): array
    {
        return [
            'id' => $user->getId(),
            'email' => $user->getEmail(),
            'firstName' => $user->getFirstName(),
            'lastName' => $user->getLastName(),
            'username' => $user->getPseudo(),
            'profilePicture' => $user->getProfilePicture(),
            'averageBudget' => $user->getAverageBudget(),
            'activityTags' => $user->getActivityTags(),
            'travelStyle' => $user->getTravelStyle(),
            'travelPace' => $user->getTravelPace(),
            'favoriteTransport' => $user->getFavoriteTransport(),
            'interests' => $user->getInterests(),
            'createdAt' => $user->getCreatedAt()?->format(\DateTimeInterface::ATOM),
        ];
    }
}
