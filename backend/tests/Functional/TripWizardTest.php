<?php

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;
use App\Tests\SocialTestTrait;

/** Assistant « Créer un voyage » (maquettes 17-20) et écran groupe (13) */
final class TripWizardTest extends ApiTestCase
{
    use SocialTestTrait;

    public function testWizardFieldsBudgetPerPersonAndTicketCost(): void
    {
        [$code, $trip] = $this->json('POST', '/api/trips', [
            'destination' => 'Monterrey', 'departureCity' => 'Paris (CDG)',
            'startDate' => '2027-07-19', 'endDate' => '2027-07-27',
            'travelers' => 5, 'budget' => 4750, 'transportMode' => 'avion',
            'transportPricePerPerson' => 290, 'eachBooksOwnTransport' => false, 'splitCostsEqually' => true,
            'wishedActivities' => ['plongee', 'excursions'],
        ], $this->token('alice'));

        self::assertSame(201, $code, json_encode($trip));
        self::assertSame(950, $trip['budgetPerPerson']);
        self::assertSame(['plongee', 'excursions'], $trip['wishedActivities']);
        self::assertSame(1450, $trip['computedTotalCost'], '290 € × 5 voyageurs');
        self::assertTrue($trip['splitCostsEqually']);

        [$code] = $this->json('POST', '/api/trips', [
            'destination' => 'X', 'departureCity' => 'Y', 'startDate' => '2027-07-19', 'endDate' => '2027-07-20',
            'wishedActivities' => ['parachute'],
        ], $this->token('alice'));
        self::assertSame(422, $code, 'Activité souhaitée inconnue');

        // Logement de l'étape 3 : nouveaux types + adresse
        [$code, $accom] = $this->json('POST', "/api/trips/{$trip['id']}/accommodations", [
            'name' => 'Loft lumineux', 'type' => 'habitant', 'checkIn' => '2027-07-19', 'checkOut' => '2027-07-27',
            'price' => 900, 'address' => 'Calle Morelos 812, Barrio Antiguo',
        ], $this->token('alice'));
        self::assertSame(201, $code, json_encode($accom));
        self::assertSame('Calle Morelos 812, Barrio Antiguo', $accom['address']);
    }

    public function testWishedActivitiesGuideThePlanning(): void
    {
        $alice = $this->token('alice');
        $this->json('POST', '/api/places', ['name' => 'Musée', 'latitude' => 25.67, 'longitude' => -100.31, 'tags' => ['musee'], 'averagePrice' => 10], $alice);
        $this->json('POST', '/api/places', ['name' => 'Cerro de la Silla', 'latitude' => 25.63, 'longitude' => -100.23, 'tags' => ['nature'], 'averagePrice' => 0], $alice);

        [, $trip] = $this->json('POST', '/api/trips', [
            'destination' => 'Monterrey', 'departureCity' => 'Paris', 'startDate' => '2027-07-19', 'endDate' => '2027-07-21',
            'wishedActivities' => ['randonnee'],
        ], $alice);

        [, $data] = $this->json('POST', "/api/trips/{$trip['id']}/activities/generate", ['lat' => 25.67, 'lng' => -100.31], $alice);
        $mornings = array_values(array_filter($data['activities'], fn ($a) => $a['slot'] === 'matin'));

        self::assertSame('Cerro de la Silla', $mornings[0]['title'], 'La randonnée (nature) passe en premier');
        self::assertSame('Musée', $mornings[1]['title']);
        self::assertSame('Randonnée', $mornings[2]['title'], 'Plus de lieux : activité générique liée au souhait');
    }

    public function testGroupScreenShowsStatsAndRecentActivity(): void
    {
        $group = $this->groupWith('alice', 'bob');
        [, $trip] = $this->json('POST', '/api/trips', [
            'destination' => 'Monterrey', 'departureCity' => 'Paris', 'startDate' => '2027-07-19', 'endDate' => '2027-07-21',
            'budget' => 4200, 'groupId' => $group['id'],
        ], $this->token('bob'));
        $this->json('POST', "/api/trips/{$trip['id']}/activities", ['date' => '2027-07-20', 'title' => 'Mercado Juárez'], $this->token('bob'));

        [, $detail] = $this->json('GET', "/api/groups/{$group['id']}", null, $this->token('alice'));

        self::assertSame(4200, $detail['stats']['budget']);
        self::assertSame(1, $detail['stats']['activitiesCount']);
        $messages = array_column($detail['activity'], 'message');
        self::assertStringContainsString('« Mercado Juárez » au planning', $messages[0]);
        self::assertStringContainsString('a ajouté le voyage', $messages[1]);
        self::assertContains('Bob a rejoint « Monterrey 2026 »', $messages);
        self::assertContains('Alice a créé le groupe', $messages);
    }
}
