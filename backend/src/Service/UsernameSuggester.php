<?php

namespace App\Service;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\String\Slugger\AsciiSlugger;

/**
 * Pseudo libre proposé à partir du prénom (sinon du début de l'email) : « alec », sinon « alec.42 »...
 * Chaque compte en reçoit un dès sa création (modifiable dans le profil) : il sert de code de parrainage.
 */
final class UsernameSuggester
{
    public function __construct(private EntityManagerInterface $em) {}

    /** Donne un pseudo au compte s'il n'en a pas encore */
    public function ensure(User $user): void
    {
        if ($user->getPseudo()) return;
        $seed = $user->getFirstName() ?: strstr((string) $user->getEmail(), '@', true) ?: 'voyageur';
        $user->setPseudo($this->suggest($seed));
    }

    /** Pseudo attribué d'office d'après l'email (pas choisi) : l'onboarding le remplace par un pseudo sur le prénom */
    public function isFromEmail(User $user): bool
    {
        $local = strstr((string) $user->getEmail(), '@', true);
        return $local && $user->getPseudo() !== null
            && preg_match('/^' . preg_quote($this->base($local), '/') . '(\.\d+)?$/', $user->getPseudo()) === 1;
    }

    /** $for : le compte qui recevra le pseudo (son pseudo actuel ne compte pas comme déjà pris) */
    public function suggest(string $seed, ?User $for = null): string
    {
        $base = $this->base($seed);
        $repo = $this->em->getRepository(User::class);
        $taken = fn (string $c) => ($u = $repo->findOneBy(['username' => $c])) !== null && $u !== $for;
        $candidate = $base;
        for ($i = 0; $taken($candidate) && $i < 20; $i++) {
            $candidate = $base . '.' . random_int(10, $i < 10 ? 99 : 9999);
        }
        return $candidate;
    }

    private function base(string $seed): string
    {
        $base = strtolower((string) (new AsciiSlugger())->slug($seed, '.'));
        $base = trim(substr(preg_replace('/[^a-z0-9.]/', '', $base) ?: 'voyageur', 0, 40), '.') ?: 'voyageur';
        return strlen($base) < 3 ? $base . '.voyage' : $base;
    }
}
