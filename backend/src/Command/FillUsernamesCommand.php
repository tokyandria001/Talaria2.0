<?php

namespace App\Command;

use App\Entity\User;
use App\Service\UsernameSuggester;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Donne un pseudo aux comptes qui n'en ont pas (créés avec Google, onboarding passé...).
 * À lancer une fois après le déploiement :
 *   php bin/console app:fill-usernames --no-debug
 */
#[AsCommand(name: 'app:fill-usernames', description: 'Attribue un pseudo aux comptes qui n\'en ont pas')]
final class FillUsernamesCommand extends Command
{
    public function __construct(private EntityManagerInterface $em, private UsernameSuggester $suggester)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption('dry-run', null, InputOption::VALUE_NONE, 'Afficher sans rien enregistrer');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $dryRun = (bool) $input->getOption('dry-run');
        $users = $this->em->getRepository(User::class)->findBy(['username' => null], ['id' => 'ASC']);

        $rows = [];
        foreach ($users as $user) {
            $this->suggester->ensure($user);
            // Enregistré un par un : le pseudo suivant tient compte de ceux déjà attribués
            if (!$dryRun) $this->em->flush();
            $rows[] = [$user->getId(), $user->getPseudo()];
        }

        $io->table(['id', 'pseudo'], $rows);
        $dryRun ? $io->note(sprintf('Simulation : %d compte(s) sans pseudo, rien n\'a été enregistré.', count($rows)))
                : $io->success(sprintf('%d pseudo(s) attribué(s).', count($rows)));

        return Command::SUCCESS;
    }
}
