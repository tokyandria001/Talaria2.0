<?php

namespace App\Command;

use App\Service\ImageMetadataStripper;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Retire les métadonnées (position GPS, appareil, date...) des images déjà en ligne dans public/uploads.
 * Les nouvelles images sont nettoyées à l'envoi ; à lancer une fois pour les anciennes :
 *   php bin/console app:strip-image-metadata --no-debug
 */
#[AsCommand(name: 'app:strip-image-metadata', description: 'Retire les métadonnées (GPS...) des images déjà envoyées')]
final class StripImageMetadataCommand extends Command
{
    public function __construct(
        private ImageMetadataStripper $stripper,
        #[Autowire('%kernel.project_dir%')] private string $projectDir,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption('dry-run', null, InputOption::VALUE_NONE, 'Compter les images sans les modifier');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $dir = $this->projectDir . '/public/uploads';
        if (!is_dir($dir)) {
            $io->success('Aucune image envoyée.');
            return Command::SUCCESS;
        }

        $files = 0;
        $cleaned = 0;
        $images = new \RegexIterator(
            new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS)),
            '/\.(jpe?g|png|webp)$/i',
        );
        foreach ($images as $file) {
            $files++;
            if ($input->getOption('dry-run')) continue;
            if ($this->stripper->strip($file->getPathname())) $cleaned++;
        }

        $input->getOption('dry-run')
            ? $io->note(sprintf('%d image(s) à vérifier. Rien n\'a été modifié.', $files))
            : $io->success(sprintf('%d image(s) vérifiée(s), %d nettoyée(s).', $files, $cleaned));

        return Command::SUCCESS;
    }
}
