<?php

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;

/** Sécurité des images envoyées : type réel, tailles, contenu caché, nom de fichier, limite d'envois */
final class ImageUploadTest extends ApiTestCase
{
    private const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    /** @var list<string> */
    private array $stored = [];

    protected function tearDown(): void
    {
        foreach ($this->stored as $path) @unlink(dirname(__DIR__, 2) . '/public' . $path);
        parent::tearDown();
    }

    /** Envoie une photo de profil ; renvoie [code, réponse] */
    private function send(string $token, string $bytes, string $clientName, string $clientType = 'image/png'): array
    {
        $file = tempnam(sys_get_temp_dir(), 'up');
        file_put_contents($file, $bytes);
        $this->client->request('POST', '/api/profile/picture', [], ['picture' => new UploadedFile($file, $clientName, $clientType, null, true)], [
            'HTTP_AUTHORIZATION' => "Bearer $token",
        ]);
        $response = $this->client->getResponse();
        $data = json_decode((string) $response->getContent(), true);
        if (isset($data['profilePicture'])) $this->stored[] = $data['profilePicture'];
        return [$response->getStatusCode(), $data];
    }

    private static function png(int $width, int $height): string
    {
        $chunk = fn (string $type, string $data) => pack('N', strlen($data)) . $type . $data . pack('N', crc32($type . $data));
        return "\x89PNG\r\n\x1A\n" . $chunk('IHDR', pack('NN', $width, $height) . "\x08\x06\x00\x00\x00")
            . $chunk('IDAT', gzcompress(str_repeat("\0\0\0\0\0", 1))) . $chunk('IEND', '');
    }

    /** GIF de 1 px avec $frames images */
    private static function gif(int $frames): string
    {
        $frame = "\x2C\0\0\0\0\x01\0\x01\0\0" . "\x02\x02\x4C\x01\x00";
        return "GIF89a\x01\x00\x01\x00\x00\x00\x00" . str_repeat($frame, $frames) . "\x3B";
    }

    public function testOnlyRealImagesAreAccepted(): void
    {
        $token = $this->registerAndLogin();

        // Le type annoncé et l'extension ne comptent pas : seul le contenu compte
        [$code] = $this->send($token, '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>', 'photo.png');
        self::assertSame(400, $code, 'SVG refusé');
        [$code] = $this->send($token, '<html><script>alert(1)</script></html>', 'photo.jpg', 'image/jpeg');
        self::assertSame(400, $code, 'HTML refusé');
        [$code] = $this->send($token, "%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n", 'photo.png');
        self::assertSame(400, $code, 'PDF refusé');

        // Dimensions et animations
        [$code, $data] = $this->send($token, self::png(5000, 10), 'grande.png');
        self::assertSame(400, $code);
        self::assertStringContainsString('4096', $data['message']);
        [$code, $data] = $this->send($token, self::gif(201), 'bombe.gif', 'image/gif');
        self::assertSame(400, $code, 'GIF « bombe » refusé');
        self::assertStringContainsString('200', $data['message']);

        // GIF animé raisonnable : accepté, enregistré en .gif
        [$code, $data] = $this->send($token, self::gif(10), 'anim.gif', 'image/gif');
        self::assertSame(200, $code);
        self::assertStringEndsWith('.gif', $data['profilePicture']);
    }

    public function testHiddenContentIsRemovedAndNameIsRandom(): void
    {
        $token = $this->registerAndLogin();

        // Image « polyglotte » : un vrai PNG suivi de code PHP
        [$code, $data] = $this->send($token, base64_decode(self::PNG_1PX) . '<?php system($_GET["c"]); ?>', 'shell.php');
        self::assertSame(200, $code);
        $path = $data['profilePicture'];
        self::assertMatchesRegularExpression('#^/uploads/avatars/\d+_[0-9a-f]{24}\.png$#', $path, 'Nom aléatoire, extension d\'après le contenu');
        $stored = (string) file_get_contents(dirname(__DIR__, 2) . '/public' . $path);
        self::assertStringNotContainsString('<?php', $stored, 'Rien après la fin de l\'image');
        self::assertStringEndsWith("IEND\xAE\x42\x60\x82", $stored);
    }

    public function testUploadsAreLimitedPerHour(): void
    {
        $token = $this->registerAndLogin();
        for ($i = 0; $i < 30; $i++) {
            [$code] = $this->send($token, base64_decode(self::PNG_1PX), "p$i.png");
            self::assertSame(200, $code, "Envoi n° " . ($i + 1));
        }
        [$code, $data] = $this->send($token, base64_decode(self::PNG_1PX), 'trop.png');
        self::assertSame(429, $code);
        self::assertStringContainsString('Trop d\'images', $data['message']);
    }
}
