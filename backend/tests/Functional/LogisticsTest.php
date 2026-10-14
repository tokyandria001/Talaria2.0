<?php

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;
use App\Tests\SocialTestTrait;

/** Onglet Logistique : réglages par voyageur, hébergements proposés et réservés, trajets de chacun */
final class LogisticsTest extends ApiTestCase
{
    use SocialTestTrait;

    /** Voyage de groupe créé par Alice (organisatrice), avec Bob */
    private function groupTrip(): array
    {
        $group = $this->groupWith('alice', 'bob');
        [, $trip] = $this->json('POST', '/api/trips', [
            'destination' => 'Lisbonne', 'departureCity' => 'Paris', 'startDate' => '2027-05-01', 'endDate' => '2027-05-05',
            'groupId' => $group['id'],
        ], $this->token('alice'));
        return $trip;
    }

    public function testDependentsWeighSharesAndPersonalBudgetsAddUp(): void
    {
        $trip = $this->groupTrip();
        $base = "/api/trips/{$trip['id']}";

        // Bob part avec 2 enfants et un budget de 900 € ; Alice seule, 500 €
        [$code, $log] = $this->json('PATCH', "$base/traveler", ['budget' => 900, 'dependents' => 2], $this->token('bob'));
        self::assertSame(200, $code);
        self::assertSame(['budget' => 900, 'dependents' => 2], $log['me']);
        self::assertSame(4, $log['travelersCount']);
        $this->json('PATCH', "$base/traveler", ['budget' => 500], $this->token('alice'));
        [$code] = $this->json('PATCH', "$base/traveler", ['dependents' => 50], $this->token('bob'));
        self::assertSame(422, $code);

        // Dépense commune de 400 € : 1 part pour Alice, 3 pour Bob
        $this->json('POST', "$base/expenses", ['label' => 'Courses', 'amount' => 400, 'category' => 'repas'], $this->token('alice'));
        // Activité à 20 €/pers dans le planning
        $this->json('POST', "$base/activities", ['date' => '2027-05-02', 'time' => '10:00', 'title' => 'Tram 28', 'price' => 20], $this->token('alice'));

        [, $budget] = $this->json('GET', "$base/budget", null, $this->token('bob'));
        $shares = array_column(array_map(fn ($b) => ['n' => $b['user']['firstName'], 's' => $b['share']], $budget['balances']), 's', 'n');
        self::assertEquals(['Alice' => 100, 'Bob' => 300], $shares);
        self::assertEquals(1400, $budget['summary']['budget'], 'Somme des budgets personnels');
        self::assertSame('personal', $budget['summary']['budgetSource']);
        self::assertSame(4, $budget['summary']['travelersCount']);
        self::assertEquals(80, $budget['summary']['plannedActivities'], '20 € × 4 voyageurs');
        self::assertEquals(['heads' => 3, 'budget' => 900, 'share' => 300, 'planned' => 60, 'remaining' => 540], $budget['summary']['me']);
    }

    public function testAccommodationsAreProposedLikedAndBooked(): void
    {
        $trip = $this->groupTrip();
        $base = "/api/trips/{$trip['id']}";

        [, $loft] = $this->json('POST', "$base/accommodations", ['name' => 'Loft Alfama', 'checkIn' => '2027-05-01', 'checkOut' => '2027-05-05', 'price' => 600], $this->token('bob'));
        [, $hotel] = $this->json('POST', "$base/accommodations", ['name' => 'Hôtel Baixa', 'checkIn' => '2027-05-02', 'checkOut' => '2027-05-04', 'price' => 450], $this->token('alice'));
        self::assertSame('proposed', $loft['status']);
        self::assertSame('Bob', $loft['proposedBy']['firstName']);

        // Avis : qui aime quoi
        $this->json('POST', "$base/accommodations/{$loft['id']}/reaction", ['liked' => true], $this->token('alice'));
        [, $log] = $this->json('POST', "$base/accommodations/{$loft['id']}/reaction", ['liked' => false], $this->token('bob'));
        $item = current(array_filter($log['accommodations'], fn ($a) => $a['id'] === $loft['id']));
        self::assertSame(['Alice'], array_column($item['likes'], 'firstName'));
        self::assertSame(['Bob'], array_column($item['dislikes'], 'firstName'));
        self::assertSame('dislike', $item['myReaction']);
        [, $log] = $this->json('POST', "$base/accommodations/{$loft['id']}/reaction", ['liked' => null], $this->token('bob'));
        $item = current(array_filter($log['accommodations'], fn ($a) => $a['id'] === $loft['id']));
        self::assertSame([], $item['dislikes'], 'Avis retiré');

        // Seule l'organisatrice valide ; la réservation crée une dépense partagée et écarte l'autre hébergement
        [$code] = $this->json('POST', "$base/accommodations/{$loft['id']}/book", null, $this->token('bob'));
        self::assertSame(403, $code);
        [$code, $log] = $this->json('POST', "$base/accommodations/{$loft['id']}/book", null, $this->token('alice'));
        self::assertSame(200, $code);
        self::assertSame(['booked', 'rejected'], array_column($log['accommodations'], 'status'), 'Réservé en premier');

        [, $budget] = $this->json('GET', "$base/budget", null, $this->token('alice'));
        self::assertSame(['Logement · Loft Alfama'], array_column($budget['expenses'], 'label'));
        self::assertEquals(600, $budget['summary']['spent']);

        // Prix modifié : la dépense suit ; annulation : la dépense disparaît, l'hôtel redevient une proposition
        $this->json('PATCH', "$base/accommodations/{$loft['id']}", ['price' => 650], $this->token('alice'));
        [, $budget] = $this->json('GET', "$base/budget", null, $this->token('alice'));
        self::assertEquals(650, $budget['summary']['spent']);
        [, $log] = $this->json('POST', "$base/accommodations/{$loft['id']}/unbook", null, $this->token('alice'));
        self::assertSame(['proposed', 'proposed'], array_column($log['accommodations'], 'status'));
        [, $budget] = $this->json('GET', "$base/budget", null, $this->token('alice'));
        self::assertSame([], $budget['expenses']);

        [$code] = $this->json('POST', "$base/accommodations/{$hotel['id']}/book", null, $this->token('alice'));
        self::assertSame(200, $code);
        $this->json('PATCH', "$base/accommodations/{$hotel['id']}", ['price' => null], $this->token('alice'));
        [, $after] = $this->json('GET', "$base/budget", null, $this->token('alice'));
        self::assertEquals(450, $after['summary']['spent'], 'Un hébergement réservé garde un prix');
    }

    public function testEachTravelerChoosesTheirOwnTransport(): void
    {
        $trip = $this->groupTrip();
        $base = "/api/trips/{$trip['id']}";

        [$code, $log] = $this->json('POST', "$base/transports", ['mode' => 'train', 'departureCity' => 'Lyon', 'price' => 120], $this->token('bob'));
        self::assertSame(201, $code);
        [, $log] = $this->json('POST', "$base/transports", ['mode' => 'avion', 'departureCity' => 'Lyon', 'price' => 90], $this->token('bob'));
        $bob = current(array_filter($log['travelers'], fn ($t) => $t['user']['firstName'] === 'Bob'));
        [$train, $plane] = $bob['transports'];
        self::assertSame('Lyon', $train['departureCity']);

        [$code] = $this->json('POST', "$base/transports", ['mode' => 'fusée', 'departureCity' => 'Lyon'], $this->token('bob'));
        self::assertSame(422, $code);
        [$code] = $this->json('POST', "$base/transports/{$train['id']}/choose", null, $this->token('alice'));
        self::assertSame(403, $code, 'Chacun choisit son trajet');

        // Choisir : dépense personnelle de Bob ; en choisir un autre la remplace
        $this->json('POST', "$base/transports/{$train['id']}/choose", null, $this->token('bob'));
        [, $log] = $this->json('POST', "$base/transports/{$plane['id']}/choose", null, $this->token('bob'));
        $bob = current(array_filter($log['travelers'], fn ($t) => $t['user']['firstName'] === 'Bob'));
        self::assertSame([false, true], array_column($bob['transports'], 'chosen'));

        [, $budget] = $this->json('GET', "$base/budget", null, $this->token('alice'));
        self::assertSame(['Avion · depuis Lyon'], array_column($budget['expenses'], 'label'));
        $shares = array_column(array_map(fn ($b) => ['n' => $b['user']['firstName'], 's' => $b['share']], $budget['balances']), 's', 'n');
        self::assertEquals(['Alice' => 0, 'Bob' => 90], $shares, 'Dépense personnelle : pas partagée');

        // Supprimer le trajet choisi retire sa dépense
        $this->json('DELETE', "$base/transports/{$plane['id']}", null, $this->token('bob'));
        [, $budget] = $this->json('GET', "$base/budget", null, $this->token('alice'));
        self::assertSame([], $budget['expenses']);
    }
}
