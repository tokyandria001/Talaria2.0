<?php

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;

/** Onboarding après l'inscription : 7 questions, pseudo proposé, gares et aéroports proches */
final class OnboardingTest extends ApiTestCase
{
    public function testAnswersAreSavedAndUsernameIsSuggested(): void
    {
        $token = $this->registerAndLogin();

        [$code, $data] = $this->json('PATCH', '/api/profile', [
            'firstName' => 'Alec', 'birthYear' => 2002,
            'homeCity' => 'Angers', 'homeLatitude' => 47.47, 'homeLongitude' => -0.55,
            'homeHubs' => ['Angers Saint-Laud', 'Aéroport Nantes-Atlantique', 'Angers Saint-Laud'],
            'travelerTypes' => ['aventurier', 'foodie', 'pirate', 'culture', 'nature'],
            'weekendBudget' => 250, 'companions' => 'amis', 'wishlist' => ['paris', 'islande'],
            'completeOnboarding' => true,
        ], $token);

        self::assertSame(200, $code);
        $user = $data['user'];
        self::assertSame('alec', $user['username'], 'Pseudo proposé à partir du prénom');

        // Accord des textes : « Elle », « Il », ou neutre (null) ; rien d'autre n'est accepté
        [, $data] = $this->json('PATCH', '/api/profile', ['gender' => 'feminin'], $token);
        self::assertSame('feminin', $data['user']['gender']);
        [$code] = $this->json('PATCH', '/api/profile', ['gender' => 'autre'], $token);
        self::assertSame(422, $code);
        [, $data] = $this->json('PATCH', '/api/profile', ['gender' => null], $token);
        self::assertNull($data['user']['gender']);
        self::assertSame(2002, $user['birthYear']);
        self::assertSame(['Angers Saint-Laud', 'Aéroport Nantes-Atlantique'], $user['homeHubs']);
        self::assertSame(['aventurier', 'foodie', 'culture'], $user['travelerTypes'], 'Valeurs connues, 3 au plus');
        self::assertSame(['aventure', 'gastronomie', 'culture'], $user['activityTags'], 'Les styles remplissent les centres d\'intérêt');
        self::assertSame('amis', $user['companions']);
        self::assertNotNull($user['onboardedAt']);

        // Un second Alec reçoit un autre pseudo
        $other = $this->registerAndLogin('alec2@talaria.test');
        [, $data] = $this->json('PATCH', '/api/profile', ['firstName' => 'Alec', 'completeOnboarding' => true], $other);
        self::assertMatchesRegularExpression('/^alec\.\d+$/', $data['user']['username']);

        [$code] = $this->json('PATCH', '/api/profile', ['companions' => 'pirates'], $token);
        self::assertSame(422, $code);
    }

    public function testNearbyStationsAndAirports(): void
    {
        $token = $this->registerAndLogin();

        [$code, $data] = $this->json('GET', '/api/geo/hubs?city=Angers&lat=47.47&lon=-0.55', null, $token);
        self::assertSame(200, $code);
        self::assertSame(
            [['Angers Saint-Laud', 'train'], ["Aéroport d'Angers-Loire", 'avion'], ['Aéroport Nantes-Atlantique', 'avion']],
            array_map(fn ($h) => [$h['name'], $h['kind']], $data['hubs']),
            'Métro et lieux lointains écartés, du plus proche au plus loin'
        );

        [$code] = $this->json('GET', '/api/geo/hubs?city=Angers', null, $token);
        self::assertSame(400, $code);
    }
}
