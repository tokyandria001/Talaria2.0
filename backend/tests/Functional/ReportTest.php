<?php

namespace App\Tests\Functional;

use App\Entity\User;
use App\Tests\ApiTestCase;
use App\Tests\Mock\PhotonMockResponseFactory;
use Doctrine\ORM\EntityManagerInterface;

/** Signalements : alerte aux administrateurs, masquage automatique, décisions, suspension de compte */
final class ReportTest extends ApiTestCase
{
    private function makeAdmin(string $email): void
    {
        $em = static::getContainer()->get(EntityManagerInterface::class);
        $user = $em->getRepository(User::class)->findOneBy(['email' => $email]);
        $user->setAdmin(true);
        $em->flush();
    }

    private function article(string $token): int
    {
        [$code, $a] = $this->json('POST', '/api/articles', ['title' => 'Mon voyage', 'content' => 'Un récit.', 'category' => 'Conseils'], $token);
        self::assertSame(201, $code);
        return $a['id'] ?? $a['article']['id'];
    }

    public function testReportsNotifyAdminsAndHideContentAfterThreeReporters(): void
    {
        $admin = $this->registerAndLogin('admin@talaria.test');
        $this->makeAdmin('admin@talaria.test');
        $author = $this->registerAndLogin('auteur@talaria.test');
        $articleId = $this->article($author);
        $readers = array_map(fn ($i) => $this->registerAndLogin("lecteur$i@talaria.test"), [1, 2, 3]);

        $before = count(PhotonMockResponseFactory::$webhooks);
        [$code, $data] = $this->json('POST', '/api/reports', ['targetType' => 'article', 'targetId' => $articleId, 'reason' => 'haine', 'comment' => 'Propos racistes'], $readers[0]);
        self::assertSame(201, $code);
        self::assertStringContainsString('Merci', $data['message']);

        // L'administrateur est prévenu (notification et webhook, sans nom ni email)
        [, $notifs] = $this->json('GET', '/api/notifications', null, $admin);
        self::assertSame('report', $notifs[0]['type']);
        self::assertStringContainsString('article « Mon voyage »', $notifs[0]['message']);
        [$headers, $body] = array_slice(PhotonMockResponseFactory::$webhooks, $before)[0];
        self::assertSame('report.created', $headers['x-talaria-event']);
        self::assertStringNotContainsString('@talaria.test', $body);

        // Un seul signalement en cours par personne
        [$code] = $this->json('POST', '/api/reports', ['targetType' => 'article', 'targetId' => $articleId, 'reason' => 'spam'], $readers[0]);
        self::assertSame(409, $code);

        // 3 personnes différentes : l'article est masqué pour les autres, visible par son auteur et l'administrateur
        foreach ([1, 2] as $i) {
            $this->json('POST', '/api/reports', ['targetType' => 'article', 'targetId' => $articleId, 'reason' => 'haine'], $readers[$i]);
        }
        [, $list] = $this->json('GET', '/api/articles', null, $readers[0]);
        self::assertNotContains($articleId, array_column($list['articles'], 'id'));
        [$code] = $this->json('GET', "/api/articles/$articleId", null, $readers[0]);
        self::assertSame(404, $code);
        [$code] = $this->json('GET', "/api/articles/$articleId", null, $author);
        self::assertSame(200, $code, 'Visible par son auteur');

        // Tableau des signalements (administrateurs seulement)
        [$code] = $this->json('GET', '/api/admin/reports', null, $readers[0]);
        self::assertSame(403, $code);
        [, $reports] = $this->json('GET', '/api/admin/reports', null, $admin);
        self::assertSame(1, $reports['count']);
        self::assertSame(3, $reports['items'][0]['reportsCount']);
        self::assertSame(['haine' => 3], $reports['items'][0]['reasons']);
        self::assertTrue($reports['items'][0]['hidden']);
        self::assertSame('Mon voyage', $reports['items'][0]['preview']['label']);

        // Classé sans suite : l'article réapparaît
        [$code] = $this->json('POST', '/api/admin/reports/resolve', ['targetType' => 'article', 'targetId' => $articleId, 'action' => 'dismiss'], $admin);
        self::assertSame(200, $code);
        [$code] = $this->json('GET', "/api/articles/$articleId", null, $readers[0]);
        self::assertSame(200, $code);
        [, $reports] = $this->json('GET', '/api/admin/reports', null, $admin);
        self::assertSame(0, $reports['count']);
    }

    public function testAdminRemovesContentAndSuspendsAccounts(): void
    {
        $admin = $this->registerAndLogin('admin@talaria.test');
        $this->makeAdmin('admin@talaria.test');
        $troll = $this->registerAndLogin('troll@talaria.test');
        $reader = $this->registerAndLogin('lecteur@talaria.test');
        [, $place] = $this->json('POST', '/api/places', ['name' => 'Lieu douteux', 'latitude' => 45.76, 'longitude' => 4.83, 'tags' => ['bar']], $troll);
        $placeId = $place['place']['id'];

        // Motif ou contenu invalides, se signaler soi-même
        [$code] = $this->json('POST', '/api/reports', ['targetType' => 'place', 'targetId' => $placeId, 'reason' => 'nul'], $reader);
        self::assertSame(400, $code);
        [$code] = $this->json('POST', '/api/reports', ['targetType' => 'place', 'targetId' => 999999, 'reason' => 'spam'], $reader);
        self::assertSame(404, $code);
        [, $me] = $this->json('GET', '/api/auth/me', null, $reader);
        [$code] = $this->json('POST', '/api/reports', ['targetType' => 'user', 'targetId' => $me['user']['id'], 'reason' => 'spam'], $reader);
        self::assertSame(400, $code);

        // Contenu retiré par l'administrateur
        $this->json('POST', '/api/reports', ['targetType' => 'place', 'targetId' => $placeId, 'reason' => 'sexuel'], $reader);
        [$code] = $this->json('POST', '/api/admin/reports/resolve', ['targetType' => 'place', 'targetId' => $placeId, 'action' => 'remove'], $reader);
        self::assertSame(403, $code, 'Réservé aux administrateurs');
        [$code] = $this->json('POST', '/api/admin/reports/resolve', ['targetType' => 'place', 'targetId' => $placeId, 'action' => 'remove'], $admin);
        self::assertSame(200, $code);
        [$code] = $this->json('GET', "/api/places/$placeId", null, $admin);
        self::assertSame(404, $code, 'Lieu supprimé');

        // Compte suspendu : connexion et sessions refusées, puis rétabli
        [, $trollMe] = $this->json('GET', '/api/auth/me', null, $troll);
        $trollId = $trollMe['user']['id'];
        [$code] = $this->json('POST', "/api/admin/users/$trollId/suspend", ['suspended' => true], $admin);
        self::assertSame(200, $code);
        [$code, $login] = $this->json('POST', '/api/auth/login', ['username' => 'troll@talaria.test', 'password' => 'motdepasse123']);
        self::assertSame(403, $code);
        self::assertStringContainsString('suspendu', $login['message']);
        [$code] = $this->json('POST', '/api/auth/login', ['username' => 'troll@talaria.test', 'password' => 'mauvais']);
        self::assertSame(401, $code, 'Mauvais mot de passe : on ne révèle pas la suspension');
        [$code] = $this->json('GET', '/api/auth/me', null, $troll);
        self::assertSame(401, $code, 'Session en cours refusée');

        $this->json('POST', "/api/admin/users/$trollId/suspend", ['suspended' => false], $admin);
        [$code] = $this->json('POST', '/api/auth/login', ['username' => 'troll@talaria.test', 'password' => 'motdepasse123']);
        self::assertSame(200, $code);
    }
}
