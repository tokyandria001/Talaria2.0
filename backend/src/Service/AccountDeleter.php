<?php

namespace App\Service;

use App\Entity\Article;
use App\Entity\ArticleLike;
use App\Entity\Comment;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Suppression définitive d'un compte : articles (avec leurs likes, commentaires et couvertures),
 * likes et commentaires de l'utilisateur, photo de profil, puis le compte. Le reste (voyages,
 * amitiés, groupes, votes, messages...) suit par les règles ON DELETE de la base.
 *
 * Appelée 30 jours après la demande, par la commande app:purge-deleted-accounts.
 */
final class AccountDeleter
{
    public function __construct(
        private EntityManagerInterface $em,
        #[Autowire('%kernel.project_dir%')] private string $projectDir,
    ) {}

    public function delete(User $user): void
    {
        $em = $this->em;

        foreach ($em->getRepository(ArticleLike::class)->findBy(['user' => $user]) as $like) $em->remove($like);
        foreach ($em->getRepository(Comment::class)->findBy(['author' => $user]) as $comment) $em->remove($comment);
        $em->flush();

        foreach ($em->getRepository(Article::class)->findBy(['author' => $user]) as $article) {
            foreach ($em->getRepository(ArticleLike::class)->findBy(['article' => $article]) as $like) $em->remove($like);
            foreach ($em->getRepository(Comment::class)->findBy(['article' => $article]) as $comment) $em->remove($comment);
            $this->removeFile($article->getCoverImage());
            $em->remove($article);
        }
        $em->flush();

        $this->removeFile($user->getProfilePicture());
        $em->remove($user);
        $em->flush();
    }

    private function removeFile(?string $publicPath): void
    {
        if (!$publicPath) return;
        $path = $this->projectDir . '/public' . $publicPath;
        if (is_file($path)) unlink($path);
    }
}
