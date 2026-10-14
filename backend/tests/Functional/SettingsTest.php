<?php

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;
use App\Tests\SocialTestTrait;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\HttpFoundation\File\UploadedFile;

/** Profil et paramètres (maquettes 27 à 37) */
final class SettingsTest extends ApiTestCase
{
    use SocialTestTrait;

    public function testProfilePreferencesAndSettingsAreSavedAndCleaned(): void
    {
        $token = $this->token('alice');
        [$code, $data] = $this->json('PATCH', '/api/profile', [
            'bio' => 'Amoureuse des road trips et des tacos.',
            'phone' => '+33 6 12 34 56 78',
            'hasCar' => true, 'hasDrivingLicense' => true,
            'profilePublic' => false, 'invitePolicy' => 'nobody',
            'travelPreferences' => ['transports' => ['train', 'voiture', 'fusée'], 'diets' => ['vegan'], 'ecoFriendly' => true],
            'settings' => [
                'notifications' => ['votes' => false, 'inconnu' => true],
                'language' => 'en', 'currency' => 'EUR',
                'reimbursements' => ['remindDebts' => false, 'methods' => [
                    ['type' => 'lydia', 'handle' => '06 12 34 56 78'],
                    ['type' => 'virement', 'ibanLast4' => 'FR76 ...4417', 'holder' => 'Alice', 'isDefault' => true],
                    ['type' => 'carte-bancaire', 'handle' => '4970'],
                ]],
            ],
        ], $token);
        self::assertSame(200, $code);
        $u = $data['user'];
        self::assertSame('Amoureuse des road trips et des tacos.', $u['bio']);
        self::assertTrue($u['hasCar']);
        self::assertFalse($u['profilePublic']);
        self::assertSame('nobody', $u['invitePolicy']);
        self::assertSame(['train', 'voiture'], $u['travelPreferences']['transports'], 'Valeurs inconnues ignorées');
        self::assertTrue($u['travelPreferences']['ecoFriendly']);
        self::assertFalse($u['settings']['notifications']['votes']);
        self::assertTrue($u['settings']['notifications']['expenses'], 'Valeur par défaut conservée');
        self::assertArrayNotHasKey('inconnu', $u['settings']['notifications']);
        self::assertSame('fr', $u['settings']['language'], 'Seul le français est disponible');
        $methods = $u['settings']['reimbursements']['methods'];
        self::assertSame(['lydia', 'virement'], array_column($methods, 'type'), 'Type inconnu ignoré');
        self::assertSame('4417', $methods[1]['ibanLast4'], 'Jamais l\'IBAN complet');
        self::assertSame([false, true], array_column($methods, 'isDefault'));

        // Même chose dans /api/auth/me (lu par l'app au démarrage)
        [, $me] = $this->json('GET', '/api/auth/me', null, $token);
        self::assertSame('nobody', $me['user']['invitePolicy']);

        [$code] = $this->json('PATCH', '/api/profile', ['phone' => 'pas un numéro'], $token);
        self::assertSame(422, $code);
        [$code] = $this->json('PATCH', '/api/profile', ['invitePolicy' => 'les-voisins'], $token);
        self::assertSame(422, $code);

        // Changement de mot de passe daté
        [, $changed] = $this->json('PUT', '/api/profile/password', ['currentPassword' => 'motdepasse123', 'newPassword' => 'nouveaumotdepasse'], $token);
        [, $me] = $this->json('GET', '/api/auth/me', null, $token);
        self::assertNotNull($me['user']['passwordChangedAt']);
    }

    public function testNotificationSettingsAndInvitePolicyAreRespected(): void
    {
        $group = $this->groupWith('alice', 'bob');
        $this->json('PATCH', '/api/profile', ['settings' => ['notifications' => ['votes' => false]]], $this->token('bob'));
        [, $trip] = $this->json('POST', '/api/trips', [
            'destination' => 'Lisbonne', 'departureCity' => 'Paris', 'startDate' => '2027-05-01', 'endDate' => '2027-05-04',
            'groupId' => $group['id'],
        ], $this->token('alice'));
        $this->json('POST', "/api/trips/{$trip['id']}/votes", ['title' => 'Tram 28', 'date' => '2027-05-02'], $this->token('alice'));

        [, $notifs] = $this->json('GET', '/api/notifications', null, $this->token('bob'));
        self::assertNotContains('vote', array_column($notifs, 'type'), 'Votes désactivés par Bob');
        self::assertContains('group_trip', array_column($notifs, 'type'), 'Les autres catégories restent actives');

        // « Personne » : impossible d'inviter dans un groupe, même un ami
        $this->befriend('alice', 'chloe');
        $this->json('PATCH', '/api/profile', ['invitePolicy' => 'nobody'], $this->token('chloe'));
        [$code, $error] = $this->json('POST', "/api/groups/{$group['id']}/members", ['userIds' => [$this->user('chloe')['id']]], $this->token('alice'));
        self::assertSame(422, $code);
        self::assertStringContainsString('n\'accepte pas', $error['message']);
    }

    public function testBlockingHidesTheUserEverywhere(): void
    {
        $this->befriend('alice', 'bob');
        $bobId = $this->user('bob')['id'];

        [, $profile] = $this->json('GET', "/api/users/$bobId", null, $this->token('alice'));
        self::assertSame('friends', $profile['relation']);

        [$code] = $this->json('POST', "/api/users/$bobId/block", null, $this->token('alice'));
        self::assertSame(200, $code);
        [, $friends] = $this->json('GET', '/api/friends', null, $this->token('alice'));
        self::assertSame([], $friends, 'L\'amitié est retirée');
        [, $blocked] = $this->json('GET', '/api/profile/blocked', null, $this->token('alice'));
        self::assertSame([$bobId], array_column($blocked, 'id'));

        // Dans les deux sens : profil, recherche, demande d'ami
        [$code] = $this->json('GET', '/api/users/' . $this->user('alice')['id'], null, $this->token('bob'));
        self::assertSame(404, $code);
        [, $found] = $this->json('GET', '/api/users/search?q=alice', null, $this->token('bob'));
        self::assertSame([], $found);
        [$code] = $this->json('POST', '/api/friends/requests', ['userId' => $this->user('alice')['id']], $this->token('bob'));
        self::assertSame(404, $code);

        $this->json('DELETE', "/api/users/$bobId/block", null, $this->token('alice'));
        [$code] = $this->json('GET', '/api/users/' . $this->user('alice')['id'], null, $this->token('bob'));
        self::assertSame(200, $code);
    }

    public function testPublicProfileShowsTripsTogetherAndRespectsPrivacy(): void
    {
        $group = $this->groupWith('alice', 'bob');
        [, $trip] = $this->json('POST', '/api/trips', [
            'destination' => 'Monterrey', 'departureCity' => 'Paris', 'startDate' => '2099-07-19', 'endDate' => '2099-07-27',
            'groupId' => $group['id'],
        ], $this->token('bob'));
        $this->json('PATCH', '/api/profile', ['bio' => 'Toujours partant', 'activityTags' => ['sport']], $this->token('bob'));

        [, $profile] = $this->json('GET', '/api/users/' . $this->user('bob')['id'], null, $this->token('alice'));
        self::assertSame('Toujours partant', $profile['bio']);
        self::assertSame(1, $profile['stats']['tripsTogether']);
        self::assertSame($trip['id'], $profile['nextTripTogether']['id']);
        self::assertSame(2, $profile['nextTripTogether']['participantsCount']);

        // Profil privé : un inconnu ne voit que le nom et la photo
        $this->json('PATCH', '/api/profile', ['profilePublic' => false], $this->token('bob'));
        [, $stranger] = $this->json('GET', '/api/users/' . $this->user('bob')['id'], null, $this->token('chloe'));
        self::assertTrue($stranger['isPrivate']);
        self::assertArrayNotHasKey('bio', $stranger);
        self::assertSame('Bob', $stranger['firstName']);
    }

    public function testAccountDeletionIsDeferredAndCancelable(): void
    {
        $token = $this->token('alice');
        [$code] = $this->json('DELETE', '/api/profile', ['password' => 'faux'], $token);
        self::assertSame(401, $code);

        [$code, $data] = $this->json('DELETE', '/api/profile', ['password' => 'motdepasse123'], $token);
        self::assertSame(200, $code);
        self::assertSame((new \DateTimeImmutable('+30 days'))->format('Y-m-d'), $data['deletionScheduledFor']);

        // Pendant le délai : absent de la recherche ; se reconnecter annule la suppression
        [, $found] = $this->json('GET', '/api/users/search?q=alice', null, $this->token('bob'));
        self::assertSame([], $found);
        [$code, $login] = $this->json('POST', '/api/auth/login', ['username' => 'alice@talaria.test', 'password' => 'motdepasse123']);
        self::assertSame(200, $code);
        self::assertTrue($login['deletionCanceled']);
        [, $me] = $this->json('GET', '/api/auth/me', null, $token);
        self::assertNull($me['user']['deletionScheduledFor']);

        // Purge : seulement après 30 jours
        $this->json('DELETE', '/api/profile', ['password' => 'motdepasse123'], $token);
        $purge = new CommandTester((new Application(static::$kernel))->find('app:purge-deleted-accounts'));
        $purge->execute([]);
        self::assertStringContainsString('0 compte(s) supprimé(s)', $purge->getDisplay());

        $em = static::getContainer()->get(EntityManagerInterface::class);
        $em->getConnection()->executeStatement(
            'UPDATE user SET deletion_requested_at = :d WHERE email = :e',
            ['d' => (new \DateTimeImmutable('-31 days'))->format('Y-m-d H:i:s'), 'e' => 'alice@talaria.test'],
        );
        $purge->execute([]);
        self::assertStringContainsString('1 compte(s) supprimé(s)', $purge->getDisplay());
        [$code] = $this->json('POST', '/api/auth/login', ['username' => 'alice@talaria.test', 'password' => 'motdepasse123']);
        self::assertSame(401, $code);
    }

    public function testCoverPhotoCanBeChangedAndRemoved(): void
    {
        $token = $this->token('alice');
        $file = sys_get_temp_dir() . '/talaria-cover.png';
        file_put_contents($file, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='));
        $this->client->request('POST', '/api/profile/cover', [], ['cover' => new UploadedFile($file, 'cover.png', 'image/png', null, true)], [
            'HTTP_AUTHORIZATION' => "Bearer $token",
        ]);
        self::assertSame(200, $this->client->getResponse()->getStatusCode(), $this->client->getResponse()->getContent());
        $cover = json_decode($this->client->getResponse()->getContent(), true)['coverPhoto'];
        self::assertStringStartsWith('/uploads/covers/', $cover);

        [, $me] = $this->json('GET', '/api/auth/me', null, $token);
        self::assertSame($cover, $me['user']['coverPhoto']);
        [, $public] = $this->json('GET', '/api/users/' . $this->user('alice')['id'], null, $this->token('bob'));
        self::assertSame($cover, $public['coverPhoto'], 'Visible sur le profil public');

        [, $removed] = $this->json('DELETE', '/api/profile/cover', null, $token);
        self::assertNull($removed['coverPhoto']);
        self::assertFileDoesNotExist(static::getContainer()->getParameter('kernel.project_dir') . '/public' . $cover);
    }

    public function testDataExport(): void
    {
        $token = $this->token('alice');
        $this->json('POST', '/api/trips', ['destination' => 'Rome', 'departureCity' => 'Paris', 'startDate' => '2027-03-01', 'endDate' => '2027-03-03'], $token);

        $this->client->request('GET', '/api/profile/export', [], [], ['HTTP_AUTHORIZATION' => "Bearer $token"]);
        $response = $this->client->getResponse();
        self::assertSame(200, $response->getStatusCode());
        self::assertStringContainsString('attachment; filename="talaria-mes-donnees-', $response->headers->get('Content-Disposition'));
        $export = json_decode($response->getContent(), true);
        self::assertSame('alice@talaria.test', $export['account']['email']);
        self::assertSame(['Rome'], array_column($export['trips'], 'destination'));
    }
}
