<?php

namespace App\Service;

/**
 * Retire les métadonnées des images envoyées par les utilisateurs (position GPS, modèle de téléphone,
 * date, auteur...), sans recompresser l'image et sans extension PHP (ni GD ni Imagick) :
 *  - JPEG : blocs EXIF, XMP, IPTC, commentaires et blocs des fabricants retirés ; seule l'orientation est
 *    gardée (mini-bloc EXIF recréé) pour que la photo reste dans le bon sens ; profil de couleur conservé ;
 *  - PNG : blocs eXIf, tEXt, zTXt, iTXt et tIME retirés ;
 *  - WEBP : blocs EXIF et XMP retirés.
 * Les GIF sont laissés tels quels (pas de position GPS dans ce format).
 */
final class ImageMetadataStripper
{
    /**
     * Nettoie le fichier sur place. Retourne true s'il a été modifié.
     * Un fichier illisible est laissé tel quel (l'envoi n'échoue jamais pour ça).
     */
    public function strip(string $path): bool
    {
        $data = @file_get_contents($path);
        if ($data === false || $data === '') return false;

        $clean = match (true) {
            str_starts_with($data, "\xFF\xD8\xFF")                                           => $this->jpeg($data),
            str_starts_with($data, "\x89PNG\r\n\x1A\n")                                     => $this->png($data),
            str_starts_with($data, 'RIFF') && substr($data, 8, 4) === 'WEBP'                => $this->webp($data),
            default                                                                          => null,
        };
        if ($clean === null || $clean === $data) return false;

        // Écriture atomique : le fichier n'est jamais à moitié écrit
        $tmp = $path . '.tmp';
        if (@file_put_contents($tmp, $clean) === false) return false;
        if (!@rename($tmp, $path)) {
            @unlink($tmp);
            return false;
        }
        return true;
    }

    /* ── JPEG ─────────────────────────── */

    private function jpeg(string $data): ?string
    {
        $len = strlen($data);
        $out = "\xFF\xD8";
        $orientation = null;
        $afterApp0 = 2; // position du mini-bloc d'orientation (après l'en-tête JFIF s'il existe)
        $pos = 2;

        while ($pos < $len) {
            if ($data[$pos] !== "\xFF") return null;
            while ($pos < $len && $data[$pos] === "\xFF") $pos++; // octets de remplissage
            if ($pos >= $len) return null;
            $marker = ord($data[$pos]);
            $start = $pos - 1;
            $pos++;

            // Début des données de l'image (SOS) ou fin : le reste est recopié tel quel
            if ($marker === 0xDA || $marker === 0xD9) {
                $out .= substr($data, $start);
                break;
            }
            // Marqueurs sans longueur
            if (($marker >= 0xD0 && $marker <= 0xD7) || $marker === 0x01) {
                $out .= substr($data, $start, 2);
                continue;
            }
            if ($pos + 2 > $len) return null;
            $segLen = unpack('n', substr($data, $pos, 2))[1];
            if ($segLen < 2 || $pos + $segLen > $len) return null;
            $payload = substr($data, $pos + 2, $segLen - 2);
            $segment = substr($data, $start, $segLen + 2);
            $pos += $segLen;

            if ($marker === 0xE1 && str_starts_with($payload, "Exif\0\0")) {
                $orientation ??= $this->exifOrientation(substr($payload, 6));
                continue; // EXIF (GPS, appareil, date...) retiré
            }
            $keep = match (true) {
                $marker === 0xE0                                            => true,  // JFIF
                $marker === 0xE2 && str_starts_with($payload, "ICC_PROFILE\0") => true, // profil de couleur
                $marker === 0xEE && str_starts_with($payload, 'Adobe')        => true,  // conversion des couleurs
                $marker >= 0xE1 && $marker <= 0xEF                           => false, // XMP, IPTC, fabricants...
                $marker === 0xFE                                            => false, // commentaire
                default                                                     => true,  // tables de l'image
            };
            if (!$keep) continue;
            $out .= $segment;
            if ($marker === 0xE0 && $afterApp0 === 2) $afterApp0 = strlen($out);
        }

        if ($orientation !== null && $orientation !== 1) {
            $out = substr($out, 0, $afterApp0) . $this->orientationSegment($orientation) . substr($out, $afterApp0);
        }
        return $out;
    }

    /** Orientation (1 à 8) lue dans l'IFD0 d'un bloc EXIF (en-tête TIFF), sinon null */
    private function exifOrientation(string $tiff): ?int
    {
        if (strlen($tiff) < 8) return null;
        $le = substr($tiff, 0, 2) === 'II';
        if (!$le && substr($tiff, 0, 2) !== 'MM') return null;
        $u16 = fn (int $o) => $o + 2 <= strlen($tiff) ? unpack($le ? 'v' : 'n', substr($tiff, $o, 2))[1] : null;
        $u32 = fn (int $o) => $o + 4 <= strlen($tiff) ? unpack($le ? 'V' : 'N', substr($tiff, $o, 4))[1] : null;

        $ifd = $u32(4);
        $count = $ifd !== null ? $u16($ifd) : null;
        if ($count === null) return null;
        for ($i = 0; $i < min($count, 200); $i++) {
            $entry = $ifd + 2 + $i * 12;
            if ($u16($entry) === 0x0112) {
                $value = $u16($entry + 8);
                return $value !== null && $value >= 1 && $value <= 8 ? $value : null;
            }
        }
        return null;
    }

    /** Mini-bloc EXIF ne contenant que l'orientation */
    private function orientationSegment(int $orientation): string
    {
        $tiff = "MM\x00\x2A" . pack('N', 8)
            . pack('n', 1)                                                  // 1 entrée
            . pack('n', 0x0112) . pack('n', 3) . pack('N', 1) . pack('n', $orientation) . "\0\0"
            . pack('N', 0);                                                 // pas d'IFD suivant
        $payload = "Exif\0\0" . $tiff;
        return "\xFF\xE1" . pack('n', strlen($payload) + 2) . $payload;
    }

    /* ── PNG ─────────────────────────── */

    private const PNG_DROPPED = ['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'];

    private function png(string $data): ?string
    {
        $len = strlen($data);
        $out = substr($data, 0, 8);
        $pos = 8;
        while ($pos + 12 <= $len) {
            $chunkLen = unpack('N', substr($data, $pos, 4))[1];
            $type = substr($data, $pos + 4, 4);
            $total = 12 + $chunkLen;
            if ($pos + $total > $len) return null;
            if (!in_array($type, self::PNG_DROPPED, true)) $out .= substr($data, $pos, $total);
            $pos += $total;
            if ($type === 'IEND') break;
        }
        return $out;
    }

    /* ── WEBP ─────────────────────────── */

    private function webp(string $data): ?string
    {
        $len = strlen($data);
        $chunks = '';
        $pos = 12;
        while ($pos + 8 <= $len) {
            $type = substr($data, $pos, 4);
            $size = unpack('V', substr($data, $pos + 4, 4))[1];
            $total = 8 + $size + ($size % 2); // blocs alignés sur 2 octets
            if ($pos + 8 + $size > $len) return null;
            $chunk = substr($data, $pos, min($total, $len - $pos));
            $pos += $total;

            if ($type === 'EXIF' || $type === 'XMP ') continue;
            // En-tête étendu : indicateurs EXIF (0x08) et XMP (0x04) remis à zéro
            if ($type === 'VP8X' && strlen($chunk) > 8) $chunk[8] = chr(ord($chunk[8]) & ~0x0C);
            $chunks .= $chunk;
        }
        return 'RIFF' . pack('V', 4 + strlen($chunks)) . 'WEBP' . $chunks;
    }
}
