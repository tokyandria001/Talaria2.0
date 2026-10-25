<?php

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;

/** Prix moyens des carburants du jour (flux officiel), arrondis, valeur par défaut si manquante */
final class FuelPriceTest extends ApiTestCase
{
    public function testTodayFuelPrices(): void
    {
        static::getContainer()->get('cache.app')->clear();
        $token = $this->registerAndLogin();

        [$code, $data] = $this->json('GET', '/api/fuel-prices', null, $token);
        self::assertSame(200, $code);
        self::assertSame(2.376, $data['prices']['gazole']);
        self::assertSame(2.142, $data['prices']['e10']);
        self::assertEquals(1.0, $data['prices']['gplc'], 'Prix absent : valeur par défaut');
        self::assertSame(9812, $data['stations']);
        self::assertSame('prix-carburants.gouv.fr', $data['source']);
        self::assertFalse($data['estimated']);
    }
}
