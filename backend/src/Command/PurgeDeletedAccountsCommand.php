<?php

namespace App\Command;

use App\Entity\User;
use App\Service\AccountDeleter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Question\ConfirmationQuestion;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Supprime les comptes dont la suppression a été demandée il y a plus de 30 jours.
 * À lancer chaque jour (cron) :
 *   php bin/console app:purge-deleted-accounts --no-debug
 *
 * Administration : supprimer tout de suite un compte précis (email, id ou @pseudo), après confirmation :
 *   php bin/console app:purge-deleted-accounts --user=lea@exemple.fr --now --no-debug
 */
#[AsCommand(name: 'app:purge-deleted-accounts', description: 'Supprime les comptes 30 jours après la demande de suppression')]
final class PurgeDeletedAccountsCommand extends Command
{
    public function __construct(private EntityManagerInterface $em, private AccountDeleter $deleter)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('dry-run', null, InputOption::VALUE_NONE, 'Compter sans rien supprimer')
            ->addOption('user', null, InputOption::VALUE_REQUIRED, 'Compte précis : email, id ou @pseudo (avec --now)')
            ->addOption('now', null, InputOption::VALUE_NONE, 'Supprimer ce compte tout de suite, sans attendre 30 jours')
            ->addOption('yes', null, InputOption::VALUE_NONE, 'Ne pas demander de confirmation');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        if ($input->getOption('user') !== null || $input->getOption('now')) {
            return $this->deleteOne($input, $io);
        }

        $limit = (new \DateTimeImmutable())->modify(str_replace('+', '-', User::DELETION_DELAY));

        /** @var User[] $due */
        $due = $this->em->getRepository(User::class)->createQueryBuilder('u')
            ->where('u.deletionRequestedAt IS NOT NULL AND u.deletionRequestedAt <= :limit')
            ->setParameter('limit', $limit)
            ->getQuery()->getResult();

        if ($input->getOption('dry-run')) {
            $io->success(sprintf('%d compte(s) à supprimer.', count($due)));
            return Command::SUCCESS;
        }

        foreach ($due as $user) $this->deleter->delete($user);
        $io->success(sprintf('%d compte(s) supprimé(s).', count($due)));

        return Command::SUCCESS;
    }

    /** Suppression immédiate d'un compte par l'administrateur (avec le même ménage que la purge) */
    private function deleteOne(InputInterface $input, SymfonyStyle $io): int
    {
        $ref = trim((string) $input->getOption('user'));
        if ($ref === '' || !$input->getOption('now')) {
            $io->error('Indiquez le compte et --now, par exemple : --user=lea@exemple.fr --now');
            return Command::INVALID;
        }

        $repo = $this->em->getRepository(User::class);
        $user = match (true) {
            ctype_digit($ref)          => $repo->find((int) $ref),
            str_starts_with($ref, '@') => $repo->findOneBy(['username' => substr($ref, 1)]),
            default                    => $repo->findOneBy(['email' => $ref]),
        };
        if (!$user instanceof User) {
            $io->error("Aucun compte ne correspond à « $ref ». Rien n'a été supprimé.");
            return Command::FAILURE;
        }

        $io->writeln(sprintf(
            'Compte trouvé : #%d · %s · %s · inscrit le %s%s',
            $user->getId(), $user->getEmail(), $user->getPseudo() ? '@' . $user->getPseudo() : 'sans pseudo',
            $user->getCreatedAt()?->format('d/m/Y') ?? '?',
            $user->getDeletionRequestedAt() ? ' · suppression demandée le ' . $user->getDeletionRequestedAt()->format('d/m/Y') : '',
        ));

        if ($input->getOption('dry-run')) {
            $io->note('Simulation (--dry-run) : rien n\'a été supprimé.');
            return Command::SUCCESS;
        }

        $question = new ConfirmationQuestion('Supprimer ce compte et toutes ses données maintenant ?', false, '/^(o|oui|y|yes)$/i');
        if (!$input->getOption('yes') && !$io->askQuestion($question)) {
            $io->note('Annulé : rien n\'a été supprimé.');
            return Command::SUCCESS;
        }

        $id = $user->getId();
        $this->deleter->delete($user);
        $io->success(sprintf('Compte #%d supprimé définitivement.', $id));

        return Command::SUCCESS;
    }
}
