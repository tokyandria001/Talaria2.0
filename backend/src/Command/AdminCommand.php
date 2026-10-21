<?php

namespace App\Command;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Nomme ou retire un administrateur (badge sur le site). Seul moyen de devenir administrateur :
 * l'API ne permet à personne de se l'attribuer.
 *   php bin/console app:admin toky@exemple.fr --no-debug            nommer
 *   php bin/console app:admin toky@exemple.fr --revoke --no-debug   retirer
 *   php bin/console app:admin --list --no-debug                     liste des administrateurs
 */
#[AsCommand(name: 'app:admin', description: 'Nomme ou retire un administrateur (email, id ou @pseudo)')]
final class AdminCommand extends Command
{
    public function __construct(private EntityManagerInterface $em)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument('user', InputArgument::OPTIONAL, 'Compte : email, id ou @pseudo')
            ->addOption('revoke', null, InputOption::VALUE_NONE, 'Retirer le rôle administrateur')
            ->addOption('list', null, InputOption::VALUE_NONE, 'Lister les administrateurs');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $repo = $this->em->getRepository(User::class);

        if ($input->getOption('list')) {
            $admins = array_filter($repo->findAll(), fn (User $u) => $u->isAdmin());
            $io->table(['id', 'email', 'pseudo'], array_map(fn (User $u) => [$u->getId(), $u->getEmail(), $u->getPseudo()], $admins));
            return Command::SUCCESS;
        }

        $ref = trim((string) $input->getArgument('user'));
        if ($ref === '') {
            $io->error('Indiquez le compte : email, id ou @pseudo (ou --list).');
            return Command::INVALID;
        }
        $user = match (true) {
            ctype_digit($ref)          => $repo->find((int) $ref),
            str_starts_with($ref, '@') => $repo->findOneBy(['username' => substr($ref, 1)]),
            default                    => $repo->findOneBy(['email' => $ref]),
        };
        if (!$user instanceof User) {
            $io->error("Aucun compte ne correspond à « $ref ».");
            return Command::FAILURE;
        }

        $admin = !$input->getOption('revoke');
        $user->setAdmin($admin);
        $this->em->flush();
        $io->success(sprintf('#%d %s (%s) %s administrateur.', $user->getId(), $user->getEmail(),
            $user->getPseudo() ? '@' . $user->getPseudo() : 'sans pseudo', $admin ? 'est maintenant' : "n'est plus"));

        return Command::SUCCESS;
    }
}
