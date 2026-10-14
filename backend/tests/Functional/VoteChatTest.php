<?php

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;
use App\Tests\SocialTestTrait;

/** Phase 9 — votes du groupe sur les activités et chat du voyage */
final class VoteChatTest extends ApiTestCase
{
    use SocialTestTrait;

    private const TRIP = [
        'destination' => 'Monterrey', 'departureCity' => 'Paris',
        'startDate' => '2027-07-19', 'endDate' => '2027-07-27', 'transportMode' => 'avion',
    ];

    /** Voyage d'un groupe de 4 (Alice organisatrice, Bob, Chloé, David) */
    private function groupTrip(): array
    {
        $group = $this->groupWith('alice', 'bob', 'chloe', 'david');
        [, $trip] = $this->json('POST', '/api/trips', self::TRIP + ['groupId' => $group['id']], $this->token('alice'));
        return $trip;
    }

    public function testProposalIsValidatedByMajorityAndJoinsThePlanning(): void
    {
        $trip = $this->groupTrip();
        $url = "/api/trips/{$trip['id']}/votes";

        [$code, $view] = $this->json('POST', $url, ['title' => 'Randonnée Cerro de la Silla', 'date' => '2027-07-24', 'time' => '12:15', 'category' => 'nature', 'price' => 15], $this->token('bob'));
        self::assertSame(201, $code);
        $vote = $view['votes'][0];
        self::assertSame('open', $vote['status']);
        self::assertSame('yes', $vote['myVote'], 'La personne qui propose participe');
        self::assertSame(1, $vote['yes']);
        self::assertSame(4, $vote['participantsCount']);
        self::assertSame('2027-07-23', $vote['deadline'], 'Clôture la veille de l\'activité');
        self::assertSame('2027-07-23', $view['summary']['closesOn']);

        // En vote : pas encore dans le planning
        [, $planning] = $this->json('GET', "/api/trips/{$trip['id']}/activities", null, $this->token('alice'));
        self::assertSame([], $planning);

        // 2 sur 4 : pas encore la majorité ; 3 sur 4 : validée
        $this->json('POST', "$url/{$vote['id']}", ['participates' => true], $this->token('chloe'));
        [, $view] = $this->json('GET', $url, null, $this->token('alice'));
        self::assertSame('open', $view['votes'][0]['status']);
        [, $view] = $this->json('POST', "$url/{$vote['id']}", ['participates' => true], $this->token('alice'));
        self::assertSame('validated', $view['votes'][0]['status']);
        self::assertSame(5.0, (float) $view['votes'][0]['rating']);
        self::assertSame(['open' => 0, 'validated' => 1], array_intersect_key($view['summary'], ['open' => 0, 'validated' => 0]));

        // Validée : elle rejoint le planning, le vote est clos
        [, $planning] = $this->json('GET', "/api/trips/{$trip['id']}/activities", null, $this->token('david'));
        self::assertSame(['Randonnée Cerro de la Silla'], array_column($planning, 'title'));
        [$code] = $this->json('POST', "$url/{$vote['id']}", ['participates' => false], $this->token('david'));
        self::assertSame(409, $code);

        // Le groupe est prévenu et le chat garde la trace
        [, $notifs] = $this->json('GET', '/api/notifications', null, $this->token('david'));
        self::assertContains('vote', array_column($notifs, 'type'));
        self::assertContains('vote_result', array_column($notifs, 'type'));
        [, $chat] = $this->json('GET', "/api/trips/{$trip['id']}/messages", null, $this->token('david'));
        $system = array_column(array_filter($chat['messages'], fn ($m) => $m['type'] === 'system'), 'body');
        self::assertContains('« Randonnée Cerro de la Silla » est validée : elle rejoint le planning', $system);
    }

    public function testProposalIsRejectedWhenMajorityBecomesImpossible(): void
    {
        $trip = $this->groupTrip();
        $url = "/api/trips/{$trip['id']}/votes";
        [, $view] = $this->json('POST', $url, ['title' => 'Plongée', 'date' => '2027-07-21'], $this->token('bob'));
        $id = $view['votes'][0]['id'];

        // On peut changer d'avis tant que le vote est ouvert
        [, $view] = $this->json('POST', "$url/$id", ['participates' => true], $this->token('alice'));
        self::assertSame(['Bob', 'Alice'], array_column($view['votes'][0]['voters']['yes'], 'firstName'));
        [, $view] = $this->json('POST', "$url/$id", ['participates' => false], $this->token('alice'));
        self::assertSame(['Bob'], array_column($view['votes'][0]['voters']['yes'], 'firstName'));
        self::assertSame(['Alice'], array_column($view['votes'][0]['voters']['no'], 'firstName'));
        [, $view] = $this->json('POST', "$url/$id", ['participates' => false], $this->token('chloe'));
        self::assertSame('rejected', $view['votes'][0]['status'], '2 « pas pour moi » sur 4 : plus de majorité possible');
        self::assertSame(2, $view['votes'][0]['no']);

        [, $planning] = $this->json('GET', "/api/trips/{$trip['id']}/activities", null, $this->token('alice'));
        self::assertSame([], $planning);
    }

    public function testVotesAreLimitedToTheTripParticipants(): void
    {
        $trip = $this->groupTrip();
        [, $view] = $this->json('POST', "/api/trips/{$trip['id']}/votes", ['title' => 'Tacos', 'date' => '2027-07-22'], $this->token('bob'));

        [$code] = $this->json('GET', "/api/trips/{$trip['id']}/votes", null, $this->token('eve'));
        self::assertSame(404, $code);
        [$code] = $this->json('POST', "/api/trips/{$trip['id']}/votes/{$view['votes'][0]['id']}", ['participates' => true], $this->token('eve'));
        self::assertSame(404, $code);
        [$code] = $this->json('POST', "/api/trips/{$trip['id']}/votes", ['title' => 'Hors dates', 'date' => '2027-08-01'], $this->token('bob'));
        self::assertSame(400, $code);

        // Seule la personne qui propose (ou l'organisatrice) retire la proposition
        [$code] = $this->json('DELETE', "/api/trips/{$trip['id']}/votes/{$view['votes'][0]['id']}", null, $this->token('chloe'));
        self::assertSame(403, $code);
        [$code, $view] = $this->json('DELETE', "/api/trips/{$trip['id']}/votes/{$view['votes'][0]['id']}", null, $this->token('bob'));
        self::assertSame(200, $code);
        self::assertSame([], $view['votes']);
    }

    public function testChatMessagesPollsAndTyping(): void
    {
        $trip = $this->groupTrip();
        $url = "/api/trips/{$trip['id']}/messages";

        [$code, $first] = $this->json('POST', $url, ['body' => 'Je prends les places et je les mets dans le budget'], $this->token('alice'));
        self::assertSame(201, $code);
        self::assertTrue($first['mine']);
        self::assertSame('Alice', $first['author']['displayName']);
        [$code] = $this->json('POST', $url, ['body' => '   '], $this->token('alice'));
        self::assertSame(422, $code, 'Message vide');

        // Sondage
        [$code] = $this->json('POST', $url, ['poll' => ['question' => 'Airbnb ou Booking ?', 'options' => ['Airbnb']]], $this->token('bob'));
        self::assertSame(422, $code, 'Au moins 2 réponses');
        [, $poll] = $this->json('POST', $url, ['poll' => ['question' => 'Airbnb ou Booking ?', 'options' => ['Airbnb', 'Booking'], 'topic' => 'Logement']], $this->token('bob'));
        self::assertSame('poll', $poll['type']);
        $this->json('POST', "$url/{$poll['id']}/poll", ['option' => 0], $this->token('alice'));
        [, $poll] = $this->json('POST', "$url/{$poll['id']}/poll", ['option' => 0], $this->token('chloe'));
        self::assertSame([2, 0], array_column($poll['poll']['options'], 'votes'));
        self::assertSame(0, $poll['poll']['myOption']);
        [$code] = $this->json('POST', "$url/{$poll['id']}/poll", ['option' => 5], $this->token('chloe'));
        self::assertSame(400, $code);

        // Interrogation : seulement les nouveaux messages, sondages à jour, qui écrit
        $this->json('POST', "/api/trips/{$trip['id']}/typing", null, $this->token('chloe'));
        [, $since] = $this->json('GET', "$url?after={$first['id']}", null, $this->token('alice'));
        self::assertSame([$poll['id']], array_column($since['messages'], 'id'));
        self::assertSame(2, $since['polls'][0]['poll']['total']);
        self::assertSame(['Chloe'], array_column($since['typing'], 'firstName'));
        self::assertFalse($since['messages'][0]['mine']);

        // Remboursement : message automatique dans le chat
        $ids = array_column($trip['participants'], 'id', 'firstName');
        $this->json('POST', "/api/trips/{$trip['id']}/settlements", ['fromId' => $ids['Bob'], 'toId' => $ids['Alice'], 'amount' => 15], $this->token('bob'));
        [, $since] = $this->json('GET', "$url?after={$poll['id']}", null, $this->token('alice'));
        self::assertSame('system', $since['messages'][0]['type']);
        self::assertNull($since['messages'][0]['author']);
        self::assertStringContainsString('a remboursé 15', $since['messages'][0]['body']);

        // Personne hors du voyage
        [$code] = $this->json('GET', $url, null, $this->token('eve'));
        self::assertSame(404, $code);
    }
}
