<?php

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;
use App\Tests\SocialTestTrait;

/** Étape 4 — dépenses, part de chacun, remboursements (chiffres de la maquette « Budget ») */
final class BudgetTest extends ApiTestCase
{
    use SocialTestTrait;

    /** Voyage de groupe à 5 (Alec organise) */
    private function monterrey(): array
    {
        $group = $this->groupWith('alec', 'paul', 'lana', 'gregouz', 'layna');
        [, $trip] = $this->json('POST', '/api/trips', [
            'destination' => 'Monterrey', 'departureCity' => 'Paris', 'startDate' => '2027-07-19', 'endDate' => '2027-07-27',
            'travelers' => 5, 'budget' => 4200, 'groupId' => $group['id'],
        ], $this->token('alec'));
        return $trip;
    }

    private function expense(array $trip, string $by, string $label, $amount, string $category): array
    {
        [$code, $view] = $this->json('POST', "/api/trips/{$trip['id']}/expenses", [
            'label' => $label, 'amount' => $amount, 'category' => $category, 'paidById' => $this->user($by)['id'],
        ], $this->token($by));
        self::assertSame(201, $code, json_encode($view));
        return $view;
    }

    private function balanceOf(array $view, string $name): float
    {
        foreach ($view['balances'] as $b) {
            if ($b['user']['id'] === $this->user($name)['id']) return $b['balance'];
        }
        self::fail("Pas de solde pour $name");
    }

    public function testMockupFiguresSharesAndTransfers(): void
    {
        $trip = $this->monterrey();
        $this->expense($trip, 'paul', 'Vols aller-retour', 1450, 'transport');
        $this->expense($trip, 'alec', 'Airbnb Barrio Antiguo', 900, 'logement');
        $this->expense($trip, 'lana', 'Plongée', 150, 'activite');
        $this->expense($trip, 'gregouz', 'Dégustation', 97, 'repas');
        $view = $this->expense($trip, 'layna', 'Courses & repas', '100,00', 'repas');

        self::assertSame(2697.0, (float) $view['summary']['spent']);
        self::assertSame(1503.0, (float) $view['summary']['remaining']);
        self::assertSame(539.4, $view['summary']['perPerson']);
        self::assertSame(1450.0, (float) $view['summary']['byCategory']['transport']);
        self::assertSame(197.0, (float) $view['summary']['byCategory']['repas']);

        // Soldes de la maquette (+361 / +911 / −389 / −442 / −439, arrondis à l'euro)
        self::assertEqualsWithDelta(360.6, $this->balanceOf($view, 'alec'), 0.01);
        self::assertEqualsWithDelta(910.6, $this->balanceOf($view, 'paul'), 0.01);
        self::assertEqualsWithDelta(-389.4, $this->balanceOf($view, 'lana'), 0.01);
        self::assertEqualsWithDelta(-442.4, $this->balanceOf($view, 'gregouz'), 0.01);
        self::assertEqualsWithDelta(-439.4, $this->balanceOf($view, 'layna'), 0.01);
        self::assertEqualsWithDelta(0, array_sum(array_column($view['balances'], 'balance')), 0.001, 'Les soldes s\'équilibrent');

        // Virements : au plus n−1, et ils soldent exactement les dettes
        self::assertLessThanOrEqual(4, count($view['transfers']));
        self::assertEqualsWithDelta(1271.2, array_sum(array_column($view['transfers'], 'amount')), 0.01);

        // L'écran groupe affiche le dépensé du prochain voyage
        [, $group] = $this->json('GET', "/api/groups/{$trip['group']['id']}", null, $this->token('lana'));
        self::assertSame(2697.0, (float) $group['stats']['spent']);
        self::assertStringContainsString('a payé « Courses & repas » · 100 €', $group['activity'][0]['message']);
    }

    public function testSettlementsBalanceTheAccounts(): void
    {
        $trip = $this->monterrey();
        $this->expense($trip, 'alec', 'Location de voiture', 100, 'transport');

        [, $view] = $this->json('GET', "/api/trips/{$trip['id']}/budget", null, $this->token('gregouz'));
        self::assertEqualsWithDelta(-20.0, $this->balanceOf($view, 'gregouz'), 0.001);
        self::assertFalse(array_values(array_filter($view['balances'], fn ($b) => $b['user']['id'] === $this->user('gregouz')['id']))[0]['settled']);

        // Grégouz rembourse 15 € à Alec, puis le reste
        [$code, $view] = $this->json('POST', "/api/trips/{$trip['id']}/settlements", [
            'fromId' => $this->user('gregouz')['id'], 'toId' => $this->user('alec')['id'], 'amount' => 15,
        ], $this->token('gregouz'));
        self::assertSame(201, $code);
        self::assertEqualsWithDelta(-5.0, $this->balanceOf($view, 'gregouz'), 0.001);
        self::assertEqualsWithDelta(65.0, $this->balanceOf($view, 'alec'), 0.001);

        [, $notifs] = $this->json('GET', '/api/notifications', null, $this->token('alec'));
        self::assertSame('Gregouz a remboursé 15 € à Alec', $notifs[0]['message']);

        [, $view] = $this->json('POST', "/api/trips/{$trip['id']}/settlements", [
            'fromId' => $this->user('gregouz')['id'], 'toId' => $this->user('alec')['id'], 'amount' => '5,00',
        ], $this->token('alec'));
        $greg = array_values(array_filter($view['balances'], fn ($b) => $b['user']['id'] === $this->user('gregouz')['id']))[0];
        self::assertEqualsWithDelta(0.0, $greg['balance'], 0.001);
        self::assertTrue($greg['settled'], 'Grégouz est à jour');

        // Un tiers ne peut pas enregistrer un remboursement entre deux autres
        [$code] = $this->json('POST', "/api/trips/{$trip['id']}/settlements", [
            'fromId' => $this->user('lana')['id'], 'toId' => $this->user('alec')['id'], 'amount' => 20,
        ], $this->token('paul'));
        self::assertSame(403, $code);
    }

    public function testExpenseSplitBetweenSomeParticipantsAndRounding(): void
    {
        $trip = $this->monterrey();
        // 10 € partagés entre 3 personnes : 3,34 + 3,33 + 3,33
        [, $view] = $this->json('POST', "/api/trips/{$trip['id']}/expenses", [
            'label' => 'Glaces', 'amount' => 10, 'category' => 'repas',
            'participantIds' => [$this->user('alec')['id'], $this->user('paul')['id'], $this->user('lana')['id']],
        ], $this->token('alec'));

        $shares = array_column(array_filter($view['balances'], fn ($b) => $b['share'] > 0), 'share');
        sort($shares);
        self::assertSame([3.33, 3.33, 3.34], $shares, 'Aucun centime perdu');
        self::assertEqualsWithDelta(0.0, $this->balanceOf($view, 'layna'), 0.001, 'Layna ne participe pas à cette dépense');
    }

    public function testValidationAndPermissions(): void
    {
        $trip = $this->monterrey();
        $base = "/api/trips/{$trip['id']}/expenses";

        [$code] = $this->json('POST', $base, ['label' => 'x', 'amount' => 0, 'category' => 'repas'], $this->token('alec'));
        self::assertSame(422, $code, 'Montant nul');
        [$code] = $this->json('POST', $base, ['label' => 'x', 'amount' => -5, 'category' => 'repas'], $this->token('alec'));
        self::assertSame(422, $code, 'Montant négatif');
        [$code] = $this->json('POST', $base, ['label' => 'x', 'amount' => 'beaucoup', 'category' => 'repas'], $this->token('alec'));
        self::assertSame(400, $code, 'Montant non numérique');
        [$code] = $this->json('POST', $base, ['label' => 'x', 'amount' => 5, 'category' => 'casino'], $this->token('alec'));
        self::assertSame(422, $code, 'Catégorie inconnue');
        [$code] = $this->json('POST', $base, ['label' => 'x', 'amount' => 5, 'category' => 'repas', 'paidById' => $this->user('intrus')['id']], $this->token('alec'));
        self::assertSame(422, $code, 'Le payeur doit participer');
        [$code] = $this->json('GET', "/api/trips/{$trip['id']}/budget", null, $this->token('intrus'));
        self::assertSame(404, $code, 'Un non-participant ne voit pas le budget');

        // Paul ajoute une dépense : Lana (simple membre) ne peut ni la modifier ni la supprimer, Alec (organisateur) si
        [, $view] = $this->json('POST', $base, ['label' => 'Taxi', 'amount' => 30, 'category' => 'transport'], $this->token('paul'));
        $id = $view['expenses'][0]['id'];
        [$code] = $this->json('PATCH', "$base/$id", ['amount' => 1], $this->token('lana'));
        self::assertSame(403, $code);
        [$code, $updated] = $this->json('PATCH', "$base/$id", ['amount' => 35], $this->token('alec'));
        self::assertSame(200, $code);
        self::assertSame(35.0, (float) $updated['expenses'][0]['amount']);
        [$code, $afterDelete] = $this->json('DELETE', "$base/$id", null, $this->token('paul'));
        self::assertSame(200, $code);
        self::assertCount(0, $afterDelete['expenses']);
    }

    public function testPersonalTripBudget(): void
    {
        $trip = $this->createTrip($this->token('alec'));
        [$code, $view] = $this->json('POST', "/api/trips/{$trip['id']}/expenses", ['label' => 'Musée', 'amount' => 12.5, 'category' => 'activite'], $this->token('alec'));

        self::assertSame(201, $code);
        self::assertSame(12.5, $view['summary']['spent']);
        self::assertCount(1, $view['balances']);
        self::assertSame([], $view['transfers']);
    }
}
