<?php

namespace App\Controller;

use App\Entity\Article;
use App\Entity\ArticleLike;
use App\Entity\Comment;
use App\Entity\Notification;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Validator\ValidatorInterface;

#[Route('/api/articles', name: 'api_articles_')]
class ArticleController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        #[Autowire('%kernel.project_dir%')] private string $projectDir,
    ) {}

    /* ── List ─────────────────────────────────── */
    #[Route('', methods: ['GET'])]
    public function list(Request $req): JsonResponse
    {
        /** @var User|null $me */
        $me = $this->getUser();

        $qb = $this->em->createQueryBuilder()
            ->select('a')
            ->from(Article::class, 'a')
            ->orderBy('a.createdAt', 'DESC');

        if ($req->query->get('mine') === 'true' && $me) {
            $qb->andWhere('a.author = :me')->setParameter('me', $me);
        }
        if ($category = $req->query->get('category')) {
            $qb->andWhere('a.category = :cat')->setParameter('cat', $category);
        }
        if ($search = $req->query->get('search')) {
            $qb->andWhere('a.title LIKE :s OR a.content LIKE :s')
               ->setParameter('s', '%' . $search . '%');
        }

        $articles = $qb->getQuery()->getResult();
        $likedIds = [];
        if ($me) {
            $likes = $this->em->getRepository(ArticleLike::class)->findBy(['user' => $me]);
            foreach ($likes as $like) {
                $likedIds[$like->getArticle()->getId()] = true;
            }
        }

        return $this->json([
            'articles' => array_map(fn($a) => $this->serialize($a, false, $likedIds), $articles),
        ]);
    }

    /* ── Create ───────────────────────────────── */
    #[Route('', methods: ['POST'])]
    public function create(Request $req, ValidatorInterface $validator): JsonResponse
    {
        /** @var User $me */
        $me   = $this->getUser();
        $data = json_decode($req->getContent(), true) ?? [];

        $article = (new Article())
            ->setTitle($data['title'] ?? '')
            ->setContent($data['content'] ?? '')
            ->setCategory($data['category'] ?? '')
            ->setExcerpt($data['excerpt'] ?? null)
            ->setCoverImage($data['coverImage'] ?? null)
            ->setAuthor($me);

        $errors = $validator->validate($article);
        if (count($errors)) {
            $msgs = [];
            foreach ($errors as $e) { $msgs[$e->getPropertyPath()] = $e->getMessage(); }
            return $this->json(['errors' => $msgs], 422);
        }

        $this->em->persist($article);
        $this->em->flush();

        return $this->json($this->serialize($article, false, []), 201);
    }

    /* ── Show ─────────────────────────────────── */
    #[Route('/{id}', methods: ['GET'])]
    public function show(int $id): JsonResponse
    {
        $article = $this->em->find(Article::class, $id);
        if (!$article) return $this->json(['message' => 'Article introuvable.'], 404);

        /** @var User|null $me */
        $me = $this->getUser();
        $likedIds = [];
        if ($me) {
            $like = $this->em->getRepository(ArticleLike::class)
                ->findOneBy(['article' => $article, 'user' => $me]);
            if ($like) $likedIds[$article->getId()] = true;
        }

        $comments = $this->em->getRepository(Comment::class)
            ->findBy(['article' => $article], ['createdAt' => 'ASC']);

        $data = $this->serialize($article, true, $likedIds);
        $data['comments'] = array_map(fn($c) => $this->serializeComment($c, $me), $comments);

        return $this->json($data);
    }

    /* ── Update ───────────────────────────────── */
    #[Route('/{id}', methods: ['PUT'])]
    public function update(int $id, Request $req, ValidatorInterface $validator): JsonResponse
    {
        $article = $this->em->find(Article::class, $id);
        if (!$article) return $this->json(['message' => 'Article introuvable.'], 404);

        /** @var User $me */
        $me = $this->getUser();
        if ($article->getAuthor() !== $me) return $this->json(['message' => 'Interdit.'], 403);

        $data = json_decode($req->getContent(), true) ?? [];
        if (isset($data['title']))                 $article->setTitle($data['title']);
        if (isset($data['content']))               $article->setContent($data['content']);
        if (isset($data['category']))              $article->setCategory($data['category']);
        if (array_key_exists('excerpt', $data))    $article->setExcerpt($data['excerpt']);
        if (array_key_exists('coverImage', $data)) $article->setCoverImage($data['coverImage']);

        $errors = $validator->validate($article);
        if (count($errors)) {
            $msgs = [];
            foreach ($errors as $e) { $msgs[$e->getPropertyPath()] = $e->getMessage(); }
            return $this->json(['errors' => $msgs], 422);
        }

        $this->em->flush();
        return $this->json($this->serialize($article, false, []));
    }

    /* ── Delete ───────────────────────────────── */
    #[Route('/{id}', methods: ['DELETE'])]
    public function delete(int $id): JsonResponse
    {
        $article = $this->em->find(Article::class, $id);
        if (!$article) return $this->json(['message' => 'Article introuvable.'], 404);

        /** @var User $me */
        $me = $this->getUser();
        if ($article->getAuthor() !== $me) return $this->json(['message' => 'Interdit.'], 403);

        $this->em->remove($article);
        $this->em->flush();
        return $this->json(null, 204);
    }

    /* ── Toggle like ──────────────────────────── */
    #[Route('/{id}/like', methods: ['POST'])]
    public function toggleLike(int $id): JsonResponse
    {
        $article = $this->em->find(Article::class, $id);
        if (!$article) return $this->json(['message' => 'Article introuvable.'], 404);

        /** @var User $me */
        $me       = $this->getUser();
        $likeRepo = $this->em->getRepository(ArticleLike::class);
        $existing = $likeRepo->findOneBy(['article' => $article, 'user' => $me]);

        if ($existing) {
            $this->em->remove($existing);
            $article->setLikesCount(max(0, $article->getLikesCount() - 1));
            $liked = false;
        } else {
            $like = (new ArticleLike())->setArticle($article)->setUser($me);
            $this->em->persist($like);
            $article->setLikesCount($article->getLikesCount() + 1);
            $liked = true;

            // Notification au propriétaire (pas à soi-même)
            if ($article->getAuthor()->getId() !== $me->getId()) {
                $fromName = trim(($me->getFirstName() ?? '') . ' ' . ($me->getLastName() ?? '')) ?: $me->getEmail();
                $notif = (new Notification())
                    ->setRecipient($article->getAuthor())
                    ->setFromUser($me)
                    ->setArticle($article)
                    ->setType('like')
                    ->setMessage($fromName . ' a aimé votre article « ' . $article->getTitle() . ' »');
                $this->em->persist($notif);
            }
        }

        $this->em->flush();
        return $this->json(['liked' => $liked, 'likesCount' => $article->getLikesCount()]);
    }

    /* ── Add comment ──────────────────────────── */
    #[Route('/{id}/comments', methods: ['POST'])]
    public function addComment(int $id, Request $req, ValidatorInterface $validator): JsonResponse
    {
        $article = $this->em->find(Article::class, $id);
        if (!$article) return $this->json(['message' => 'Article introuvable.'], 404);

        /** @var User $me */
        $me   = $this->getUser();
        $data = json_decode($req->getContent(), true) ?? [];

        $comment = (new Comment())
            ->setArticle($article)
            ->setAuthor($me)
            ->setContent($data['content'] ?? '');

        $errors = $validator->validate($comment);
        if (count($errors)) {
            $msgs = [];
            foreach ($errors as $e) { $msgs[$e->getPropertyPath()] = $e->getMessage(); }
            return $this->json(['errors' => $msgs], 422);
        }

        $this->em->persist($comment);
        $article->setCommentsCount($article->getCommentsCount() + 1);

        // Notification au propriétaire (pas à soi-même)
        if ($article->getAuthor()->getId() !== $me->getId()) {
            $fromName = trim(($me->getFirstName() ?? '') . ' ' . ($me->getLastName() ?? '')) ?: $me->getEmail();
            $notif = (new Notification())
                ->setRecipient($article->getAuthor())
                ->setFromUser($me)
                ->setArticle($article)
                ->setType('comment')
                ->setMessage($fromName . ' a commenté votre article « ' . $article->getTitle() . ' »');
            $this->em->persist($notif);
        }

        $this->em->flush();

        return $this->json($this->serializeComment($comment, $me), 201);
    }

    /* ── Delete comment ───────────────────────── */
    #[Route('/{articleId}/comments/{commentId}', methods: ['DELETE'])]
    public function deleteComment(int $articleId, int $commentId): JsonResponse
    {
        $comment = $this->em->find(Comment::class, $commentId);
        if (!$comment || $comment->getArticle()->getId() !== $articleId) {
            return $this->json(['message' => 'Commentaire introuvable.'], 404);
        }

        /** @var User $me */
        $me = $this->getUser();
        if ($comment->getAuthor() !== $me) return $this->json(['message' => 'Interdit.'], 403);

        $article = $comment->getArticle();
        $this->em->remove($comment);
        $article->setCommentsCount(max(0, $article->getCommentsCount() - 1));
        $this->em->flush();

        return $this->json(null, 204);
    }

    /* ── Upload cover image ───────────────────── */
    #[Route('/upload-cover', methods: ['POST'])]
    public function uploadCover(Request $request): JsonResponse
    {
        try {
            $file = $request->files->get('cover');
            if (!$file) {
                return $this->json(['message' => 'Aucun fichier envoyé.'], 400);
            }

            if (!$file->isValid()) {
                return $this->json(['message' => 'Fichier corrompu (code PHP ' . $file->getError() . ').'], 400);
            }

            $allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            $mime    = $file->getMimeType();
            if (!in_array($mime, $allowed)) {
                return $this->json(['message' => 'Format invalide (' . $mime . '). JPEG, PNG, WebP ou GIF uniquement.'], 400);
            }

            if ($file->getSize() > 5 * 1024 * 1024) {
                return $this->json(['message' => 'Image trop lourde (max 5 Mo).'], 400);
            }

            $uploadDir = $this->projectDir . '/public/uploads/articles';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }

            $ext      = $file->guessExtension() ?? 'jpg';
            $filename = uniqid('cover_', true) . '.' . $ext;
            $file->move($uploadDir, $filename);

            return $this->json(['path' => '/uploads/articles/' . $filename]);

        } catch (\Exception $e) {
            return $this->json(['message' => $e->getMessage()], 500);
        }
    }

    /* ── Helpers ──────────────────────────────── */
    private function serialize(Article $a, bool $full, array $likedIds): array
    {
        $author    = $a->getAuthor();
        $firstName = $author->getFirstName() ?? '';
        $lastName  = $author->getLastName()  ?? '';
        $initials  = strtoupper(($firstName[0] ?? '') . ($lastName[0] ?? ''));
        if (!$initials) $initials = strtoupper($author->getEmail()[0]);

        $data = [
            'id'            => $a->getId(),
            'title'         => $a->getTitle(),
            'excerpt'       => $a->getExcerpt() ?: mb_substr(strip_tags($a->getContent()), 0, 200),
            'category'      => $a->getCategory(),
            'coverImage'    => $a->getCoverImage(),
            'author'        => [
                'id'        => $author->getId(),
                'firstName' => $firstName,
                'lastName'  => $lastName,
                'initials'  => $initials,
            ],
            'likesCount'    => $a->getLikesCount(),
            'commentsCount' => $a->getCommentsCount(),
            'likedByMe'     => isset($likedIds[$a->getId()]),
            'readTime'      => max(1, (int) ceil(mb_strlen(strip_tags($a->getContent())) / 1000)),
            'createdAt'     => $a->getCreatedAt()->format('c'),
            'isOwner'       => $this->getUser() !== null && $a->getAuthor() === $this->getUser(),
        ];

        if ($full) {
            $data['content'] = $a->getContent();
        }

        return $data;
    }

    private function serializeComment(Comment $c, ?User $me): array
    {
        $author = $c->getAuthor();
        $fn = $author->getFirstName() ?? '';
        $ln = $author->getLastName()  ?? '';
        $initials = strtoupper(($fn[0] ?? '') . ($ln[0] ?? '')) ?: strtoupper($author->getEmail()[0]);

        return [
            'id'        => $c->getId(),
            'content'   => $c->getContent(),
            'createdAt' => $c->getCreatedAt()->format('c'),
            'author'    => [
                'id'        => $author->getId(),
                'firstName' => $fn,
                'lastName'  => $ln,
                'initials'  => $initials,
            ],
            'isOwner' => $me !== null && $c->getAuthor() === $me,
        ];
    }
}