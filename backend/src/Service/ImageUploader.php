<?php

namespace App\Service;

use App\Exception\InvalidInputException;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\File\UploadedFile;

/** Enregistre une image envoyée par l'utilisateur dans public/uploads/<dossier> */
final class ImageUploader
{
    private const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    private const MAX_BYTES = 5 * 1024 * 1024;

    public function __construct(
        #[Autowire('%kernel.project_dir%')] private string $projectDir,
    ) {}

    /**
     * @return string chemin public (ex. /uploads/groups/12_abc.jpg)
     * @throws InvalidInputException format ou taille invalide (réponse 400)
     */
    public function upload(?UploadedFile $file, string $folder, string $prefix, ?string $replacedPath = null): string
    {
        if (!$file) throw new InvalidInputException('Aucun fichier fourni.');
        if (!in_array($file->getMimeType(), self::ALLOWED, true)) {
            throw new InvalidInputException('Format non supporté. JPEG, PNG, WEBP ou GIF uniquement.');
        }
        if ($file->getSize() > self::MAX_BYTES) throw new InvalidInputException('Image trop lourde (max 5 Mo).');

        $dir = $this->projectDir . '/public/uploads/' . $folder;
        if (!is_dir($dir)) mkdir($dir, 0775, true);

        $filename = sprintf('%s_%s.%s', $prefix, bin2hex(random_bytes(6)), $file->guessExtension() ?? 'jpg');
        $file->move($dir, $filename);

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
