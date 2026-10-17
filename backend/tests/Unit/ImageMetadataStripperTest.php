<?php

namespace App\Tests\Unit;

use App\Service\ImageMetadataStripper;
use PHPUnit\Framework\TestCase;

/** Métadonnées retirées des images (GPS, appareil...) sans toucher à l'image elle-même */
final class ImageMetadataStripperTest extends TestCase
{
    private function file(string $bytes): string
    {
        $path = tempnam(sys_get_temp_dir(), 'img');
        file_put_contents($path, $bytes);
        return $path;
    }

    private static function segment(int $marker, string $payload): string
    {
        return "\xFF" . chr($marker) . pack('n', strlen($payload) + 2) . $payload;
    }

    /** Bloc EXIF (big-endian) : orientation + pointeur GPS, suivi d'une fausse position */
    private static function exif(int $orientation): string
    {
        $tiff = "MM\x00\x2A" . pack('N', 8) . pack('n', 2)
            . pack('n', 0x0112) . pack('n', 3) . pack('N', 1) . pack('n', $orientation) . "\0\0"
            . pack('n', 0x8825) . pack('n', 4) . pack('N', 1) . pack('N', 38)
            . pack('N', 0)
            . 'GPS 48.8584N 2.2945E';
        return "Exif\0\0" . $tiff;
    }

    public function testJpegLosesGpsButKeepsOrientationAndImageData(): void
    {
        $tables = self::segment(0xDB, str_repeat("\x01", 65));           // table de quantification
        $scan = self::segment(0xDA, "\x01\x01\x00\x00\x3F\x00") . "DONNEES-IMAGE\xFF\x00suite" . "\xFF\xD9";
        $jpeg = "\xFF\xD8"
            . self::segment(0xE0, "JFIF\0\x01\x01\0\0\x01\0\x01\0\0")
            . self::segment(0xE1, self::exif(6))
            . self::segment(0xE1, 'http://ns.adobe.com/xap/1.0/' . "\0<x:xmpmeta>Paris</x:xmpmeta>")
            . self::segment(0xED, 'Photoshop 3.0 IPTC Auteur')
            . self::segment(0xFE, 'Pris chez moi')
            . $tables . $scan;
        $path = $this->file($jpeg);

        self::assertTrue((new ImageMetadataStripper())->strip($path));
        $out = file_get_contents($path);

        foreach (['GPS 48.8584N', 'xmpmeta', 'IPTC', 'Pris chez moi'] as $leak) {
            self::assertStringNotContainsString($leak, $out, $leak);
        }
        self::assertStringStartsWith("\xFF\xD8", $out);
        self::assertStringContainsString($tables . $scan, $out, 'Tables et données de l\'image intactes');
        self::assertStringContainsString('JFIF', $out);
        // Orientation gardée (6 = tournée de 90°) dans un mini-bloc EXIF
        self::assertStringContainsString(pack('n', 0x0112) . pack('n', 3) . pack('N', 1) . pack('n', 6), $out);

        self::assertFalse((new ImageMetadataStripper())->strip($path), 'Rien de plus à retirer');
    }

    public function testPngLosesTextAndExifChunks(): void
    {
        $chunk = fn (string $type, string $data) => pack('N', strlen($data)) . $type . $data . pack('N', crc32($type . $data));
        $ihdr = $chunk('IHDR', pack('NN', 1, 1) . "\x08\x06\x00\x00\x00");
        $idat = $chunk('IDAT', 'PIXELS');
        $png = "\x89PNG\r\n\x1A\n" . $ihdr . $chunk('tEXt', "Comment\0Pris chez moi") . $chunk('eXIf', 'GPS 48N 2E') . $idat . $chunk('IEND', '');
        $path = $this->file($png);

        self::assertTrue((new ImageMetadataStripper())->strip($path));
        self::assertSame("\x89PNG\r\n\x1A\n" . $ihdr . $idat . $chunk('IEND', ''), file_get_contents($path));
    }

    public function testWebpLosesExifAndXmpChunks(): void
    {
        $chunk = fn (string $type, string $data) => $type . pack('V', strlen($data)) . $data . (strlen($data) % 2 ? "\0" : '');
        $vp8x = $chunk('VP8X', chr(0x08 | 0x04) . "\0\0\0" . "\0\0\0\0\0\0");
        $body = $vp8x . $chunk('VP8L', 'PIXELS') . $chunk('EXIF', 'GPS 48N 2E') . $chunk('XMP ', '<x:xmpmeta/>');
        $path = $this->file('RIFF' . pack('V', 4 + strlen($body)) . 'WEBP' . $body);

        self::assertTrue((new ImageMetadataStripper())->strip($path));
        $out = file_get_contents($path);
        self::assertStringNotContainsString('GPS', $out);
        self::assertStringNotContainsString('xmpmeta', $out);
        self::assertSame(0, ord($out[20]) & 0x0C, 'Indicateurs EXIF / XMP retirés');
        self::assertSame(strlen($out) - 8, unpack('V', substr($out, 4, 4))[1], 'Taille RIFF mise à jour');
        self::assertStringContainsString('VP8L', $out);
    }

    public function testUnknownOrBrokenFilesAreLeftUntouched(): void
    {
        $gif = $this->file("GIF89a\x01\x00\x01\x00");
        $broken = $this->file("\xFF\xD8\xFF\xE1\x00");
        $stripper = new ImageMetadataStripper();
        self::assertFalse($stripper->strip($gif));
        self::assertFalse($stripper->strip($broken));
        self::assertSame("\xFF\xD8\xFF\xE1\x00", file_get_contents($broken));
    }
}
