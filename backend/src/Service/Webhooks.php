<?php

namespace App\Service;

use App\Entity\User;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\TerminateEvent;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Webhooks sortants : un service externe est prévenu des événements (aujourd'hui « user.registered »,
 * pour envoyer un email de bienvenue). Désactivés tant que WEBHOOK_URL est vide.
 *
 * Envoi après la réponse au client (kernel.terminate) : une panne du service externe ne ralentit
 * ni ne bloque jamais l'inscription. Chaque requête est signée :
 *   X-Talaria-Signature: sha256=<HMAC-SHA256 de "<X-Talaria-Timestamp>.<corps>" avec WEBHOOK_SECRET>
 * WEBHOOK_AUTH_HEADER (facultatif, « Nom: valeur ») : en-tête exigé par le destinataire (ex. « Header Auth » de n8n).
 */
final class Webhooks
{
    /** @var list<array{event: string, data: array<string, mixed>}> */
    private array $queue = [];

    public function __construct(
        private HttpClientInterface $http,
        private LoggerInterface $logger,
        #[Autowire('%env(default::WEBHOOK_URL)%')] private ?string $url,
        #[Autowire('%env(default::WEBHOOK_SECRET)%')] private ?string $secret,
        #[Autowire('%env(default::WEBHOOK_AUTH_HEADER)%')] private ?string $authHeader = null,
    ) {}

    /** Nouveau compte (inscription par email ou première connexion avec Google) */
    public function userRegistered(User $user, string $method): void
    {
        $this->queue('user.registered', [
            'id'        => $user->getId(),
            'email'     => $user->getEmail(),
            'firstName' => $user->getFirstName(),
            'username'  => $user->getPseudo(),
            'method'    => $method,
            'createdAt' => ($user->getCreatedAt() ?? new \DateTimeImmutable())->format(\DateTimeInterface::ATOM),
        ]);
    }

    /** Nouveau signalement (pour prévenir l'équipe par email ou message) : aucun nom ni email */
    public function reportCreated(\App\Entity\Report $report, int $openReports): void
    {
        $this->queue('report.created', [
            'reportId'    => $report->getId(),
            'targetType'  => $report->getTargetType(),
            'targetId'    => $report->getTargetId(),
            'reason'      => $report->getReason(),
            'openReports' => $openReports,
            'createdAt'   => $report->getCreatedAt()->format(\DateTimeInterface::ATOM),
        ]);
    }

    private function queue(string $event, array $data): void
    {
        if ($this->url) $this->queue[] = ['event' => $event, 'data' => $data];
    }

    #[AsEventListener(event: KernelEvents::TERMINATE)]
    public function flush(TerminateEvent $event): void
    {
        $queue = $this->queue;
        $this->queue = [];
        foreach ($queue as $item) $this->send($item['event'], $item['data']);
    }

    private function send(string $event, array $data): void
    {
        $id = bin2hex(random_bytes(12));
        $body = json_encode(['id' => $id, 'event' => $event, 'occurredAt' => (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM), 'data' => $data], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $timestamp = (string) time();
        $headers = [
            'Content-Type'        => 'application/json',
            'User-Agent'          => 'Talaria-Webhooks/1.0',
            'X-Talaria-Event'     => $event,
            'X-Talaria-Delivery'  => $id,
            'X-Talaria-Timestamp' => $timestamp,
            'X-Talaria-Signature' => 'sha256=' . hash_hmac('sha256', "$timestamp.$body", (string) $this->secret),
        ];
        // En-tête d'authentification du destinataire : « Nom: valeur »
        if ($this->authHeader && str_contains($this->authHeader, ':')) {
            [$name, $value] = array_map('trim', explode(':', $this->authHeader, 2));
            if ($name !== '' && $value !== '') $headers[$name] = $value;
        }

        // Deux essais, 5 secondes au plus chacun
        for ($attempt = 1; $attempt <= 2; $attempt++) {
            try {
                $status = $this->http->request('POST', (string) $this->url, ['headers' => $headers, 'body' => $body, 'timeout' => 5])->getStatusCode();
                if ($status < 300) return;
                $this->logger->warning('Webhook {event} refusé ({status})', ['event' => $event, 'status' => $status, 'delivery' => $id]);
            } catch (\Throwable $e) {
                $this->logger->warning('Webhook {event} impossible : {error}', ['event' => $event, 'error' => $e->getMessage(), 'delivery' => $id]);
            }
        }
    }
}
