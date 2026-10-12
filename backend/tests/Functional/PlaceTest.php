<?php

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;

final class PlaceTest extends ApiTestCase
{
    public function testCreateFilterAndLikePlace(): void
    {
        $token = $this->registerAndLogin();

        [$code, $data] = $this->json('POST', '/api/places', [
            'name' => 'Mercado Juárez', 'address' => 'Av. Juárez 1000, Monterrey',
            'latitude' => 25.67, 'longitude' => -100.31, 'tags' => ['marche'], 'averagePrice' => 12,
        ], $token);
        self::assertSame(201, $code);
        $place = $data['place'];
        self::assertSame('Av. Juárez 1000, Monterrey', $place['address']);

        $this->json('POST', '/api/places', ['name' => 'Bar', 'latitude' => 25.6, 'longitude' => -100.3, 'tags' => ['bar']], $token);

        [, $filtered] = $this->json('GET', '/api/places?tags=marche', null, $token);
        self::assertSame(['Mercado Juárez'], array_column($filtered['places'], 'name'));

        [$code, $like] = $this->json('POST', "/api/places/{$place['id']}/like", null, $token);
        self::assertSame(200, $code);
        self::assertTrue($like['liked']);
        self::assertSame(1, $like['likesCount']);

        [, $unlike] = $this->json('POST', "/api/places/{$place['id']}/like", null, $token);
        self::assertFalse($unlike['liked']);
        self::assertSame(0, $unlike['likesCount']);
    }

    public function testRejectsInvalidPlaces(): void
    {
        $token = $this->registerAndLogin();

        [$code] = $this->json('POST', '/api/places', ['name' => 'X', 'latitude' => 120, 'longitude' => 12], $token);
        self::assertSame(422, $code, 'Latitude hors limites');

        [$code] = $this->json('POST', '/api/places', ['name' => 'X', 'latitude' => 'nord', 'longitude' => 12], $token);
        self::assertSame(400, $code, 'Latitude non numérique');

        [$code] = $this->json('POST', '/api/places', ['name' => 'X', 'latitude' => 41, 'longitude' => 12, 'averagePrice' => -3], $token);
        self::assertSame(422, $code, 'Prix moyen négatif');
    }
}
