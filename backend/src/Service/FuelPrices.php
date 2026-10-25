<?php

namespace App\Service;

use Psr\Log\LoggerInterface;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Prix moyens des carburants en France (€/L), d'après le flux officiel et gratuit des prix relevés dans
 * toutes les stations (data.economie.gouv.fr, « prix-carburants.gouv.fr »). Mis en cache 6 heures ;
 * si le service ne répond pas, les derniers prix connus (30 jours), sinon des valeurs par défaut.
 */
final class FuelPrices
{
    private const URL = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records';
    private const FUELS = ['gazole', 'sp95', 'e10', 'sp98', 'e85', 'gplc'];
    /** Valeurs de secours si le service n'a jamais répondu */
    private const DEFAULTS = ['gazole' => 1.72, 'sp95' => 1.80, 'e10' => 1.75, 'sp98' => 1.88, 'e85' => 0.85, 'gplc' => 1.00];

    public function __construct(
        private HttpClientInterface $httpClient,
        private CacheInterface $cache,
        private LoggerInterface $logger,
    ) {}

    /**
     * @return array{prices: array<string, float>, stations: int, updatedAt: string, source: string, estimated: bool}
     */
    public function current(): array
    {
        return $this->cache->get('fuel_prices', function (ItemInterface $item) {
            $fresh = $this->fetch();
            if ($fresh) {
                $item->expiresAfter(6 * 3600);
                $this->cache->delete('fuel_prices_last');
                $this->cache->get('fuel_prices_last', function (ItemInterface $last) use ($fresh) {
                    $last->expiresAfter(30 * 86400);
                    return $fresh;
                });
                return $fresh;
            }
            // Service indisponible : on réessaie dans 30 minutes, avec les derniers prix connus en attendant
            $item->expiresAfter(1800);
            return $this->cache->get('fuel_prices_last', fn (ItemInterface $last) => [
                'prices' => self::DEFAULTS, 'stations' => 0, 'updatedAt' => (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM),
                'source' => 'valeurs par défaut', 'estimated' => true,
            ]);
        });
    }

    /** @return array{prices: array<string, float>, stations: int, updatedAt: string, source: string, estimated: bool}|null */
    private function fetch(): ?array
    {
        $select = implode(',', [...array_map(fn ($f) => "avg({$f}_prix) as $f", self::FUELS), 'count(*) as stations']);
        try {
            $data = $this->httpClient->request('GET', self::URL, [
                'query'   => ['select' => $select, 'limit' => 1],
                'timeout' => 10,
            ])->toArray();
        } catch (\Throwable $e) {
            $this->logger->warning('Prix des carburants indisponibles : {message}', ['message' => $e->getMessage()]);
            return null;
        }

        $row = $data['results'][0] ?? null;
        if (!is_array($row) || (int) ($row['stations'] ?? 0) < 100) return null;
        $prices = [];
        foreach (self::FUELS as $fuel) {
            $value = $row[$fuel] ?? null;
            // Prix plausibles seulement (entre 0,30 et 5 €/L), sinon la valeur par défaut
            $prices[$fuel] = is_numeric($value) && $value > 0.3 && $value < 5 ? round((float) $value, 3) : self::DEFAULTS[$fuel];
        }

        return [
            'prices'    => $prices,
            'stations'  => (int) $row['stations'],
            'updatedAt' => (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM),
            'source'    => 'prix-carburants.gouv.fr',
            'estimated' => false,
        ];
    }
}
