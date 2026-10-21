<?php

namespace App\Service;

/**
 * Nettoie les images envoyées par les utilisateurs, sans recompresser l'image et sans extension PHP
 * (ni GD ni Imagick) : chaque format est relu bloc par bloc et seuls les blocs nécessaires à l'image
 * sont recopiés. Tout le reste disparaît : métadonnées (position GPS, appareil, date, auteur), blocs
 * privés ou inconnus, et données ajoutées après la fin de l'image (fichiers « polyglottes »).
 *  - JPEG : tables, données de l'image, en-tête JFIF, profil de couleur ; orientation gardée (mini-bloc EXIF) ;
 *  - PNG : blocs standard de l'image (et de l'animation APNG), rien après IEND ;
 *  - WEBP : blocs de l'image et de l'animation, rien au-delà de la taille annoncée ;
 *  - GIF : images, palettes, contrôle d'animation et boucle ; commentaires et autres extensions retirés.
 */
final class ImageMetadataStripper
{
    /**
     * Nettoie un fichier déjà enregistré, sur place. Retourne true s'il a été modifié.
     * Un fichier illisible est laissé tel quel (nettoyage des anciennes images).
     */
    public function strip(string $path): bool
    {
        $data = @file_get_contents($path);
        if ($data === false || $data === '') return false;

        $clean = $this->sanitize($data)['data'] ?? null;
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

    /**
     * Image nettoyée et nombre d'images qu'elle contient (animations), ou null si le fichier n'est pas
     * une image JPEG, PNG, WEBP ou GIF bien formée.
     *
     * @return array{data: string, frames: int}|null
     */
    public function sanitize(string $data): ?array
    {
        return match (true) {
            str_starts_with($data, "\xFF\xD8\xFF")                            => $this->wrap($this->jpeg($data), 1),
            str_starts_with($data, "\x89PNG\r\n\x1A\n")                      => $this->png($data),
            str_starts_with($data, 'RIFF') && substr($data, 8, 4) === 'WEBP' => $this->webp($data),
            str_starts_with($data, 'GIF87a') || str_starts_with($data, 'GIF89a') => $this->gif($data),
            default                                                           => null,
        };
    }

    /** @return array{data: string, frames: int}|null */
    private function wrap(?string $data, int $frames): ?array
    {
        return $data === null ? null : ['data' => $data, 'frames' => $frames];
    }

    /* ── JPEG ─────────────────────────── */

    private function jpeg(string $data): ?string
    {
        $len = strlen($data);
        $out = "\xFF\xD8";
        $orientation = null;
        $afterApp0 = 2; // position du mini-bloc d'orientation (après l'en-tête JFIF s'il existe)
        $pos = 2;
        $ended = false;

        while ($pos < $len) {
            if ($data[$pos] !== "\xFF") return null;
            while ($pos < $len && $data[$pos] === "\xFF") $pos++; // octets de remplissage
            if ($pos >= $len) return null;
            $marker = ord($data[$pos]);
            $pos++;

            if ($marker === 0xD9) { // fin de l'image : ce qui suit est ignoré
                $out .= "\xFF\xD9";
                $ended = true;
                break;
            }
            // Marqueurs sans longueur
            if (($marker >= 0xD0 && $marker <= 0xD7) || $marker === 0x01) {
                $out .= "\xFF" . chr($marker);
                continue;
            }
            if ($pos + 2 > $len) return null;
            $segLen = unpack('n', substr($data, $pos, 2))[1];
            if ($segLen < 2 || $pos + $segLen > $len) return null;
            $payload = substr($data, $pos + 2, $segLen - 2);
            $segment = "\xFF" . chr($marker) . substr($data, $pos, $segLen);
            $pos += $segLen;

            if ($marker === 0xDA) {
                // Début d'un balayage : en-tête, puis données compressées jusqu'au prochain marqueur
                // (FF 00 et FF D0-D7 font partie des données)
                $start = $pos;
                while ($pos + 1 < $len) {
                    if ($data[$pos] === "\xFF") {
                        $next = ord($data[$pos + 1]);
                        if ($next !== 0x00 && ($next < 0xD0 || $next > 0xD7)) break;
                    }
                    $pos++;
                }
                $out .= $segment . substr($data, $start, $pos - $start);
                continue;
            }
            if ($marker === 0xE1 && str_starts_with($payload, "Exif\0\0")) {
                $orientation ??= $this->exifOrientation(substr($payload, 6));
                continue; // EXIF (GPS, appareil, date...) retiré
            }
            $keep = match (true) {
                $marker === 0xE0                                                => true,  // JFIF
                $marker === 0xE2 && str_starts_with($payload, "ICC_PROFILE\0")  => true,  // profil de couleur
                $marker === 0xEE && str_starts_with($payload, 'Adobe')          => true,  // conversion des couleurs
                $marker >= 0xE1 && $marker <= 0xEF                              => false, // XMP, IPTC, fabricants...
                $marker === 0xFE                                                => false, // commentaire
                // Tables et en-têtes de l'image (quantification, Huffman, dimensions, intervalle de reprise)
                $marker === 0xDB || $marker === 0xC4 || $marker === 0xDD || $marker === 0xCC
                    || ($marker >= 0xC0 && $marker <= 0xCF)                     => true,
                default                                                         => false,
            };
            if (!$keep) continue;
            $out .= $segment;
            if ($marker === 0xE0 && $afterApp0 === 2) $afterApp0 = strlen($out);
        }
        if (!$ended) $out .= "\xFF\xD9"; // fichier tronqué : on referme l'image

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

    /** Blocs gardés : image, palette, transparence, couleurs, densité, animation (APNG) */
    private const PNG_KEPT = ['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'pHYs', 'bKGD', 'acTL', 'fcTL', 'fdAT'];

    /** @return array{data: string, frames: int}|null */
    private function png(string $data): ?array
    {
        $len = strlen($data);
        $out = substr($data, 0, 8);
        $pos = 8;
        $frames = 0;
        $ended = false;
        while ($pos + 12 <= $len) {
            $chunkLen = unpack('N', substr($data, $pos, 4))[1];
            $type = substr($data, $pos + 4, 4);
            $total = 12 + $chunkLen;
            if ($pos + $total > $len) return null;
            if (in_array($type, self::PNG_KEPT, true)) $out .= substr($data, $pos, $total);
            if ($type === 'fcTL') $frames++;
            $pos += $total;
            if ($type === 'IEND') { $ended = true; break; } // rien après la fin de l'image
        }
        return $ended && str_contains($out, 'IHDR') ? ['data' => $out, 'frames' => max(1, $frames)] : null;
    }

    /* ── WEBP ─────────────────────────── */

    /** Blocs gardés : image (avec ou sans perte), transparence, animation, profil de couleur */
    private const WEBP_KEPT = ['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF', 'ICCP'];

    /** @return array{data: string, frames: int}|null */
    private function webp(string $data): ?array
    {
        // Rien au-delà de la taille annoncée dans l'en-tête RIFF
        $declared = unpack('V', substr($data, 4, 4))[1] + 8;
        $len = min(strlen($data), $declared);
        $chunks = '';
        $frames = 0;
        $pos = 12;
        while ($pos + 8 <= $len) {
            $type = substr($data, $pos, 4);
            $size = unpack('V', substr($data, $pos + 4, 4))[1];
            $total = 8 + $size + ($size % 2); // blocs alignés sur 2 octets
            if ($pos + 8 + $size > $len) return null;
            $chunk = substr($data, $pos, min($total, $len - $pos));
            $pos += $total;

            if (!in_array($type, self::WEBP_KEPT, true)) continue;
            // En-tête étendu : indicateurs EXIF (0x08) et XMP (0x04) remis à zéro
            if ($type === 'VP8X' && strlen($chunk) > 8) $chunk[8] = chr(ord($chunk[8]) & ~0x0C);
            if ($type === 'ANMF') $frames++;
            $chunks .= $chunk;
        }
        if ($chunks === '') return null;
        return ['data' => 'RIFF' . pack('V', 4 + strlen($chunks)) . 'WEBP' . $chunks, 'frames' => max(1, $frames)];
    }

    /* ── GIF ─────────────────────────── */

    /** @return array{data: string, frames: int}|null */
    private function gif(string $data): ?array
    {
        $len = strlen($data);
        if ($len < 13) return null;
        $flags = ord($data[10]);
        $pos = 13 + (($flags & 0x80) ? 3 * (2 << ($flags & 0x07)) : 0); // palette globale
        if ($pos > $len) return null;
        $out = substr($data, 0, $pos);
        $frames = 0;

        while ($pos < $len) {
            $byte = ord($data[$pos]);
            if ($byte === 0x3B) { // fin du fichier : ce qui suit est ignoré
                return ['data' => $out . "\x3B", 'frames' => max(1, $frames)];
            }
            if ($byte === 0x2C) { // image
                if ($pos + 10 > $len) return null;
                $local = ord($data[$pos + 9]);
                $end = $pos + 10 + (($local & 0x80) ? 3 * (2 << ($local & 0x07)) : 0) + 1; // + taille de code LZW
                $end = $this->skipSubBlocks($data, $end);
                if ($end === null) return null;
                $out .= substr($data, $pos, $end - $pos);
                $frames++;
                $pos = $end;
                continue;
            }
            if ($byte === 0x21) { // extension
                if ($pos + 2 > $len) return null;
                $label = ord($data[$pos + 1]);
                $end = $this->skipSubBlocks($data, $pos + 2);
                if ($end === null) return null;
                $block = substr($data, $pos, $end - $pos);
                // Gardés : contrôle d'animation (délai, transparence) et boucle (NETSCAPE2.0 / ANIMEXTS1.0)
                $keep = $label === 0xF9
                    || ($label === 0xFF && (str_starts_with(substr($block, 3), 'NETSCAPE2.0') || str_starts_with(substr($block, 3), 'ANIMEXTS1.0')));
                if ($keep) $out .= $block;
                $pos = $end;
                continue;
            }
            return null; // bloc inconnu : fichier invalide
        }
        return ['data' => $out . "\x3B", 'frames' => max(1, $frames)]; // fichier tronqué : on le referme
    }

    /** Position après une suite de sous-blocs GIF (longueur, données…, terminée par 0), null si tronquée */
    private function skipSubBlocks(string $data, int $pos): ?int
    {
        $len = strlen($data);
        while ($pos < $len) {
            $size = ord($data[$pos]);
            $pos += 1 + $size;
            if ($size === 0) return $pos <= $len ? $pos : null;
        }
        return null;
    }
}
