<?php

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Console\Tester\CommandTester;

/** Parrainage : lien ?invite=<pseudo>, compteurs, liste des filleuls, export */
final class ReferralTest extends ApiTestCase
{
    private function register(string $email, ?string $invite, ?string $username = null): int
    {
        $body = ['email' => $email, 'password' => 'motdepasse123'] + array_filter(['invite' => $invite, 'username' => $username]);
        [$code] = $this->json('POST', '/api/auth/register', $body, null, '10.1.' . (crc32($email) % 250) . '.1');
        return $code;
    }

    public function testInviteLinkCreditsTheReferrer(): void
    {
        $malo = $this->registerAndLogin('malo@talaria.test');
        $this->json('PATCH', '/api/profile', ['username' => 'Malo'], $malo);

        // Pseudo sans tenir compte des majuscules, avec ou sans @
        self::assertSame(201, $this->register('lea@talaria.test', 'malo'));
        self::assertSame(201, $this->register('tom@talaria.test', '@MALO'));
        // Code inconnu, ou son propre pseudo : inscription acceptée, aucun parrain
        self::assertSame(201, $this->register('zoe@talaria.test', 'inconnu'));
        self::assertSame(201, $this->register('max@talaria.test', 'max.v', 'max.v'));

        [, $me] = $this->json('GET', '/api/auth/me', null, $malo);
        self::assertSame(2, $me['user']['referralsCount']);

        [, $profile] = $this->json('GET', '/api/profile', null, $malo);
        self::assertSame(2, $profile['counts']['referrals']);

        [, $list] = $this->json('GET', '/api/profile/referrals', null, $malo);
        self::assertSame(2, $list['count']);
        self::assertArrayNotHasKey('email', $list['referrals'][0], "Jamais l'email des filleuls");
        self::assertNotNull($list['referrals'][0]['referredAt']);

        // Médaille visible sur le profil public
        $other = $this->registerAndLogin('autre@talaria.test');
        [, $public] = $this->json('GET', "/api/users/{$me['user']['id']}", null, $other);
        self::assertSame(2, $public['stats']['referrals']);

        // Export pour l'équipe data
        $tester = new CommandTester((new Application(static::$kernel))->find('app:export-referrals'));
        $file = tempnam(sys_get_temp_dir(), 'ref') . '.csv';
        $tester->execute(['file' => $file]);
        $lines = array_map(fn (string $l) => str_getcsv($l, ',', '"', ''), file($file, FILE_IGNORE_NEW_LINES));
        self::assertSame(['referrer_id', 'referrer_username', 'referred_id', 'referred_username', 'referred_at'], $lines[0]);
        self::assertCount(3, $lines, 'En-tête + 2 parrainages');
        self::assertSame('Malo', $lines[1][1]);
    }
}
