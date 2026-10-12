<?php

namespace App\Command;

use Doctrine\DBAL\Connection;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Importe des lieux depuis un fichier JSON (données OpenStreetMap) :
 *  - liste d'hôtels : [{"name", "lat", "lon", "type": "hotel|guest_house|hostel|camp_site"}]
 *  - export de bars : {"bars": [{"id", "lat", "lon", "tags": {"name", "amenity", "opening_hours", "addr:*"}}]}
 *
 * Réimport sans doublon : chaque lieu garde (source, identifiant d'origine). Insertion par paquets.
 *
 *   php bin/console app:import-places chemin/vers/fichier.json --no-debug
 */
#[AsCommand(name: 'app:import-places', description: 'Importe des lieux (hôtels, bars...) depuis un fichier JSON OpenStreetMap')]
final class ImportPlacesCommand extends Command
{
    private const BATCH = 500;

    /** Types OpenStreetMap → catégorie Talaria */
    private const TYPE_TO_TAG = [
        'hotel' => 'hotel', 'guest_house' => 'hotel', 'motel' => 'hotel', 'apartment' => 'hotel', 'chalet' => 'hotel',
        'hostel' => 'auberge',
        'camp_site' => 'camping', 'caravan_site' => 'camping',
        'bar' => 'bar', 'pub' => 'bar', 'biergarten' => 'bar', 'nightclub' => 'bar', 'cafe' => 'bar',
        'restaurant' => 'restaurant',
    ];

    private const DESCRIPTIONS = [
        'guest_house' => "Chambres d'hôtes", 'hostel' => 'Auberge de jeunesse', 'camp_site' => 'Camping',
        'pub' => 'Pub', 'nightclub' => 'Boîte de nuit', 'biergarten' => 'Brasserie en plein air',
    ];

    public function __construct(private Connection $db)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument('file', InputArgument::REQUIRED, 'Fichier JSON à importer')
            ->addOption('source', null, InputOption::VALUE_REQUIRED, 'Origine des données', 'osm')
            ->addOption('dry-run', null, InputOption::VALUE_NONE, 'Compter sans rien écrire en base');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $file = $input->getArgument('file');
        $source = $input->getOption('source');
        $dryRun = (bool) $input->getOption('dry-run');

        if (!is_file($file)) {
            $io->error("Fichier introuvable : $file");
            return Command::FAILURE;
        }

        $data = json_decode(file_get_contents($file), true, 512, JSON_BIGINT_AS_STRING);
        if (!is_array($data)) {
            $io->error('Le fichier n\'est pas un JSON valide.');
            return Command::FAILURE;
        }
        $records = array_is_list($data) ? $data : ($data['bars'] ?? $data['places'] ?? $data['elements'] ?? []);
        $io->writeln(sprintf('%d enregistrements lus dans %s', count($records), basename($file)));

        // Identifiants déjà en base pour cette source : un réimport ne crée pas de doublon
        $existing = array_flip($this->db->fetchFirstColumn('SELECT external_id FROM place WHERE source = ?', [$source]));
        $seen = [];
        $now = (new \DateTimeImmutable())->format('Y-m-d H:i:s');

        $stats = ['importés' => 0, 'déjà en base' => 0, 'sans nom' => 0, 'type ignoré' => 0, 'position invalide' => 0, 'doublon dans le fichier' => 0];
        $batch = [];
        $progress = $io->createProgressBar(count($records));

        foreach ($records as $r) {
            $progress->advance();
            $place = $this->normalize($r);
            if (is_string($place)) { $stats[$place]++; continue; }

            if (isset($existing[$place['external_id']])) { $stats['déjà en base']++; continue; }
            if (isset($seen[$place['external_id']])) { $stats['doublon dans le fichier']++; continue; }
            $seen[$place['external_id']] = true;

            $batch[] = $place + ['source' => $source, 'created_at' => $now];
            $stats['importés']++;
            if (count($batch) >= self::BATCH) { $dryRun || $this->insert($batch); $batch = []; }
        }
        if ($batch && !$dryRun) $this->insert($batch);
        $progress->finish();
        $io->newLine(2);

        $io->table(['Résultat', 'Nombre'], array_map(fn ($k, $v) => [$k, $v], array_keys($stats), $stats));
        $dryRun ? $io->note('Simulation (--dry-run) : rien n\'a été écrit en base.')
                : $io->success(sprintf('%d lieux importés depuis %s.', $stats['importés'], basename($file)));
        $io->comment('Données © les contributeurs OpenStreetMap (licence ODbL) : afficher cette mention dans l\'application.');

        return Command::SUCCESS;
    }

    /** Ligne à insérer, ou raison du rejet */
    private function normalize(array $r): array|string
    {
        $tags = $r['tags'] ?? [];
        $name = trim((string) ($r['name'] ?? $tags['name'] ?? ''));
        if ($name === '') return 'sans nom';

        $type = (string) ($r['type'] ?? '');
        if ($type === 'node' || $type === 'way') $type = (string) ($tags['amenity'] ?? $tags['tourism'] ?? '');
        $mainType = explode(';', $type)[0];
        $tag = self::TYPE_TO_TAG[$mainType] ?? null;
        if (!$tag) return 'type ignoré';

        $lat = $r['lat'] ?? null;
        $lon = $r['lon'] ?? null;
        if (!is_numeric($lat) || !is_numeric($lon) || abs($lat) > 90 || abs($lon) > 180) return 'position invalide';

        // Identifiant d'origine : l'id OSM s'il existe, sinon une empreinte du nom et de la position
        $externalId = isset($r['id']) ? ($r['type'] ?? 'node') . '/' . $r['id']
            : 'h:' . substr(sha1(mb_strtolower($name) . '|' . round((float) $lat, 5) . '|' . round((float) $lon, 5)), 0, 24);

        $street = trim(($tags['addr:housenumber'] ?? '') . ' ' . ($tags['addr:street'] ?? ''));
        $city   = trim(($tags['addr:postcode'] ?? '') . ' ' . ($tags['addr:city'] ?? ''));
        $address = implode(', ', array_filter([$street, $city])) ?: null;

        return [
            'name'          => mb_substr($name, 0, 200),
            'description'   => self::DESCRIPTIONS[$mainType] ?? null,
            'tags'          => json_encode([$tag]),
            'primary_tag'   => $tag,
            'latitude'      => (float) $lat,
            'longitude'     => (float) $lon,
            'photos'        => '[]',
            'likes_count'   => 0,
            'address'       => $address ? mb_substr($address, 0, 255) : null,
            'opening_hours' => isset($tags['opening_hours']) ? mb_substr((string) $tags['opening_hours'], 0, 255) : null,
            'external_id'   => $externalId,
        ];
    }

    /** Insertion multi-lignes (beaucoup plus rapide que l'ORM pour des dizaines de milliers de lieux) */
    private function insert(array $rows): void
    {
        $columns = array_keys($rows[0]);
        $placeholders = '(' . implode(', ', array_fill(0, count($columns), '?')) . ')';
        $sql = sprintf('INSERT INTO place (%s) VALUES %s', implode(', ', $columns), implode(', ', array_fill(0, count($rows), $placeholders)));

        $params = [];
        foreach ($rows as $row) array_push($params, ...array_values($row));

        $this->db->transactional(fn (Connection $c) => $c->executeStatement($sql, $params));
    }
}
