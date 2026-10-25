<?php

namespace App\Service;

use App\Entity\User;
use App\Exception\InvalidInputException;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\RateLimiter\RateLimiterFactory;

/**
 * Enregistre une image envoyée par un utilisateur dans public/uploads/<dossier>. Seul passage pour toutes
 * les images (profil, couverture, articles, groupes, lieux) :
 *  - type détecté d'après le contenu du fichier (jamais l'extension ni le type annoncé) : JPEG, PNG, WEBP, GIF ;
 *  - 5 Mo au plus (2 Mo pour un GIF), 8 192 px de côté et 40 mégapixels au plus (photos des téléphones
 *    récents acceptées, images démesurées refusées), 200 images au plus pour une animation ;
 *  - image relue et nettoyée bloc par bloc (métadonnées, blocs inconnus, données cachées retirés) ;
 *  - nom aléatoire et extension d'après le type détecté (le nom envoyé n'est jamais repris) ;
 *  - 30 envois par heure et par utilisateur.
 */
final class ImageUploader
{
    /** Type détecté → extension du fichier enregistré */
    private const TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
    private const MAX_BYTES = 5 * 1024 * 1024;
    private const MAX_GIF_BYTES = 2 * 1024 * 1024;
    private const MAX_SIDE = 8192;
    private const MAX_PIXELS = 40_000_000;
    private const MAX_FRAMES = 200;

    public function __construct(
        #[Autowire('%kernel.project_dir%')] private string $projectDir,
        private ImageMetadataStripper $stripper,
        private RateLimiterFactory $imageUploadLimiter,
        private Security $security,
        private RequestStack $requests,
    ) {}

    /**
     * @return string chemin public (ex. /uploads/groups/12_3f9a….jpg)
     * @throws InvalidInputException image refusée (réponse 400, ou 429 si trop d'envois)
     */
    public function upload(?UploadedFile $file, string $folder, string $prefix, ?string $replacedPath = null): string
    {
        if (!$file || !$file->isValid()) throw new InvalidInputException('Aucun fichier fourni.');

        // Anti-abus : 30 envois par heure et par utilisateur (par adresse IP sans compte)
        $user = $this->security->getUser();
        $key = $user instanceof User ? 'u' . $user->getId() : 'ip' . ($this->requests->getCurrentRequest()?->getClientIp() ?? '');
        if (!$this->imageUploadLimiter->create($key)->consume()->isAccepted()) {
            throw new InvalidInputException('Trop d\'images envoyées. Réessayez dans un moment.', 429);
        }

        $mime = $file->getMimeType(); // détecté d'après le contenu (signature du fichier)
        $ext = self::TYPES[$mime] ?? null;
        if (!$ext) throw new InvalidInputException('Format non supporté. JPEG, PNG, WEBP ou GIF uniquement.');

        $size = $file->getSize();
        if ($size > self::MAX_BYTES) throw new InvalidInputException('Image trop lourde (5 Mo maximum).');
        if ($mime === 'image/gif' && $size > self::MAX_GIF_BYTES) throw new InvalidInputException('GIF trop lourd (2 Mo maximum).');

        $info = @getimagesize($file->getPathname());
        if (!$info || $info['mime'] !== $mime) throw new InvalidInputException('Image illisible ou endommagée.');
        if ($info[0] < 1 || $info[1] < 1 || $info[0] > self::MAX_SIDE || $info[1] > self::MAX_SIDE || $info[0] * $info[1] > self::MAX_PIXELS) {
            throw new InvalidInputException(sprintf('Image trop grande (%d px de côté et %d mégapixels maximum).', self::MAX_SIDE, self::MAX_PIXELS / 1_000_000));
        }

        $clean = $this->stripper->sanitize((string) file_get_contents($file->getPathname()));
        if (!$clean) throw new InvalidInputException('Image illisible ou endommagée.');
        if ($clean['frames'] > self::MAX_FRAMES) {
            throw new InvalidInputException(sprintf('Animation trop longue (%d images maximum).', self::MAX_FRAMES));
        }

        $dir = $this->projectDir . '/public/uploads/' . $folder;
        if (!is_dir($dir)) mkdir($dir, 0775, true);
        $filename = sprintf('%s_%s.%s', preg_replace('/[^a-z0-9]/i', '', $prefix), bin2hex(random_bytes(12)), $ext);
        if (file_put_contents("$dir/$filename", $clean['data']) === false) {
            throw new \RuntimeException("Impossible d'enregistrer l'image.");
        }

        $this->remove($replacedPath);

        return "/uploads/$folder/$filename";
    }

    /** Supprime une ancienne image (uniquement sous /uploads/) */
    public function remove(?string $publicPath): void
    {
        if (!$publicPath || !str_starts_with($publicPath, '/uploads/') || str_contains($publicPath, '..')) return;
        $path = $this->projectDir . '/public' . $publicPath;
        if (is_file($path)) unlink($path);
    }
}
