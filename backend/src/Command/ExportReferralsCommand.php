<?php

namespace App\Command;

use Doctrine\DBAL\Connection;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Qui a parrainé qui, en CSV : identifiants, pseudos et date d'inscription du filleul
 * (jamais d'email ni de nom). Sans fichier : affichage dans le terminal.
 *
 *   php bin/console app:export-referrals var/parrainages.csv --no-debug
 */
#[AsCommand(name: 'app:export-referrals', description: 'Exporte les parrainages (parrain → filleul) en CSV')]
final class ExportReferralsCommand extends Command
{
    public function __construct(private Connection $db)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addArgument('file', InputArgument::OPTIONAL, 'Fichier CSV à écrire');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $rows = $this->db->fetchAllAssociative(
            'SELECT p.id AS referrer_id, p.username AS referrer_username, f.id AS referred_id, f.username AS referred_username, f.referred_at
             FROM `user` f JOIN `user` p ON p.id = f.referred_by_id
             ORDER BY f.referred_at, f.id'
        );
        $columns = ['referrer_id', 'referrer_username', 'referred_id', 'referred_username', 'referred_at'];

        $file = $input->getArgument('file');
        if (!$file) {
            $io->table($columns, array_map('array_values', $rows));
            $io->comment(sprintf('%d parrainage(s).', count($rows)));
            return Command::SUCCESS;
        }

        $out = fopen($file, 'w');
        if ($out === false) {
            $io->error("Impossible d'écrire $file");
            return Command::FAILURE;
        }
        fputcsv($out, $columns, ',', '"', '');
        foreach ($rows as $row) fputcsv($out, array_values($row), ',', '"', '');
        fclose($out);
        $io->success(sprintf('%d parrainage(s) exporté(s) dans %s.', count($rows), $file));

        return Command::SUCCESS;
    }
}
