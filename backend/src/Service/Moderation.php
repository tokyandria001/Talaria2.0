<?php

namespace App\Service;

use App\Entity\Article;
use App\Entity\Comment;
use App\Entity\Notification;
use App\Entity\Place;
use App\Entity\Report;
use App\Entity\TravelGroup;
use App\Entity\User;
use App\Exception\InvalidInputException;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Signalements de contenus (règlement européen sur les services numériques) :
 *  - un utilisateur signale un article, un commentaire, un lieu, un profil ou un groupe (photo précise facultative) ;
 *  - les administrateurs reçoivent une notification (et le webhook « report.created » part) ;
 *  - à partir de 3 personnes différentes, un article, un commentaire ou un lieu est masqué automatiquement ;
 *  - un administrateur classe sans suite (contenu réaffiché) ou retire le contenu.
 */
final class Moderation
{
    /** Nombre de personnes différentes à partir duquel le contenu est masqué en attendant un administrateur */
    public const HIDE_THRESHOLD = 3;

    public function __construct(
        private EntityManagerInterface $em,
        private ImageUploader $uploader,
        private Webhooks $webhooks,
    ) {}

    /** Enregistre un signalement (un seul par personne et par contenu ; un nouveau remplace l'ancien s'il est clos) */
    public function report(User $reporter, string $type, int $id, string $reason, ?string $comment, ?string $photo): Report
    {
        if (!in_array($type, Report::TARGETS, true)) throw new InvalidInputException('Contenu signalé invalide.');
        if (!in_array($reason, Report::REASONS, true)) throw new InvalidInputException('Motif invalide.');
        $target = $this->target($type, $id);
        if (!$target || !$this->canSee($reporter, $type, $target)) throw new InvalidInputException('Contenu introuvable.', 404);
        if ($type === 'user' && $target === $reporter) throw new InvalidInputException('Impossible de se signaler soi-même.');
        if ($photo !== null && !in_array($photo, $this->photosOf($type, $target), true)) $photo = null;

        $repo = $this->em->getRepository(Report::class);
        $existing = $repo->findOneBy(['reporter' => $reporter, 'targetType' => $type, 'targetId' => $id]);
        if ($existing?->isOpen()) throw new InvalidInputException('Tu as déjà signalé ce contenu, il est en cours d\'examen.', 409);
        if ($existing) $this->em->remove($existing);
        $this->em->flush();

        $report = (new Report())->setReporter($reporter)->setTarget($type, $id)->setReason($reason)
            ->setComment($comment !== null && trim($comment) !== '' ? mb_substr(trim($comment), 0, 500) : null)
            ->setPhoto($photo);
        $this->em->persist($report);
        $this->em->flush();

        $count = $repo->count(['targetType' => $type, 'targetId' => $id, 'status' => Report::STATUS_OPEN]);
        if ($count >= self::HIDE_THRESHOLD && ($target instanceof Article || $target instanceof Comment || $target instanceof Place)) {
            $target->setHidden(true);
        }

        $label = sprintf('Signalement : %s (%s)%s', $this->describe($type, $target), Report::REASON_LABELS[$reason],
            $count > 1 ? " · $count signalements" : '');
        foreach ($this->admins() as $admin) {
            if ($admin === $reporter) continue;
            $this->em->persist((new Notification())->setRecipient($admin)->setFromUser($reporter)->setType('report')
                ->setMessage(mb_substr($label, 0, 255)));
        }
        $this->em->flush();
        $this->webhooks->reportCreated($report, $count);

        return $report;
    }

    /**
     * Signalements en cours, regroupés par contenu (les plus signalés d'abord).
     *
     * @return list<array<string, mixed>>
     */
    public function openReports(): array
    {
        $reports = $this->em->getRepository(Report::class)->findBy(['status' => Report::STATUS_OPEN], ['createdAt' => 'ASC']);
        $groups = [];
        foreach ($reports as $r) {
            $key = $r->getTargetType() . ':' . $r->getTargetId();
            $groups[$key] ??= ['targetType' => $r->getTargetType(), 'targetId' => $r->getTargetId(), 'reports' => []];
            $groups[$key]['reports'][] = $r;
        }

        $out = [];
        foreach ($groups as $g) {
            $target = $this->target($g['targetType'], $g['targetId']);
            $reasons = array_count_values(array_map(fn (Report $r) => $r->getReason(), $g['reports']));
            arsort($reasons);
            $out[] = [
                'targetType'      => $g['targetType'],
                'targetId'        => $g['targetId'],
                'exists'          => $target !== null,
                'preview'         => $target ? $this->preview($g['targetType'], $target) : null,
                'hidden'          => ($target instanceof Article || $target instanceof Comment || $target instanceof Place) && $target->isHidden(),
                'reportsCount'    => count($g['reports']),
                'reasons'         => $reasons,
                'photos'          => array_values(array_unique(array_filter(array_map(fn (Report $r) => $r->getPhoto(), $g['reports'])))),
                'firstReportedAt' => $g['reports'][0]->getCreatedAt()->format(\DateTimeInterface::ATOM),
                'reports'         => array_map(fn (Report $r) => [
                    'id'        => $r->getId(),
                    'reason'    => $r->getReason(),
                    'comment'   => $r->getComment(),
                    'photo'     => $r->getPhoto(),
                    'reporter'  => UserPresenter::public($r->getReporter()),
                    'createdAt' => $r->getCreatedAt()->format(\DateTimeInterface::ATOM),
                ], $g['reports']),
            ];
        }
        usort($out, fn ($a, $b) => $b['reportsCount'] <=> $a['reportsCount']);
        return $out;
    }

    /**
     * Décision d'un administrateur sur un contenu signalé :
     *  - « dismiss » : classé sans suite, le contenu est réaffiché ;
     *  - « remove » : contenu supprimé (article, commentaire, lieu), ou photos retirées (profil, groupe ;
     *    seulement $photo si précisé, sinon toutes).
     */
    public function resolve(User $admin, string $type, int $id, string $action, ?string $photo = null): void
    {
        if (!in_array($action, ['dismiss', 'remove'], true)) throw new InvalidInputException('Action invalide : dismiss ou remove.');
        $reports = $this->em->getRepository(Report::class)->findBy(['targetType' => $type, 'targetId' => $id, 'status' => Report::STATUS_OPEN]);
        $target = $this->target($type, $id);
        if (!$reports && !$target) throw new InvalidInputException('Contenu introuvable.', 404);

        if ($action === 'dismiss') {
            if ($target instanceof Article || $target instanceof Comment || $target instanceof Place) $target->setHidden(false);
        } elseif ($target) {
            $this->remove($type, $target, $photo);
        }
        foreach ($reports as $r) $r->close($action === 'remove' ? Report::STATUS_ACTIONED : Report::STATUS_DISMISSED, $admin);
        $this->em->flush();
    }

    /** Un utilisateur qui n'a pas le droit de voir un contenu ne peut pas le signaler */
    public function canSee(User $user, string $type, object $target): bool
    {
        return match (true) {
            $target instanceof TravelGroup => $target->membershipOf($user)?->isActive() ?? false,
            $target instanceof User        => !$target->getDeletionRequestedAt(),
            default                        => true,
        };
    }

    /** Un contenu masqué reste visible par son auteur et par les administrateurs */
    public static function visibleTo(?User $viewer, bool $hidden, ?User $author): bool
    {
        return !$hidden || ($viewer && ($viewer === $author || $viewer->isAdmin()));
    }

    private function target(string $type, int $id): ?object
    {
        $class = match ($type) {
            'article' => Article::class, 'comment' => Comment::class, 'place' => Place::class,
            'user' => User::class, 'group' => TravelGroup::class, default => null,
        };
        return $class ? $this->em->find($class, $id) : null;
    }

    /** @return list<string> */
    private function photosOf(string $type, object $target): array
    {
        return array_values(array_filter(match (true) {
            $target instanceof Article     => [$target->getCoverImage()],
            $target instanceof Place       => $target->getPhotos(),
            $target instanceof User        => [$target->getProfilePicture(), $target->getCoverPhoto()],
            $target instanceof TravelGroup => [$target->getPhoto()],
            default                        => [],
        }));
    }

    private function remove(string $type, object $target, ?string $photo): void
    {
        if ($target instanceof Article) {
            $this->uploader->remove($target->getCoverImage());
            foreach ($this->em->getRepository(Comment::class)->findBy(['article' => $target]) as $c) $this->em->remove($c);
            $this->em->remove($target);
        } elseif ($target instanceof Comment) {
            $target->getArticle()->setCommentsCount(max(0, $target->getArticle()->getCommentsCount() - 1));
            $this->em->remove($target);
        } elseif ($target instanceof Place) {
            foreach ($target->getPhotos() as $p) $this->uploader->remove($p);
            $this->em->remove($target);
        } elseif ($target instanceof User) {
            // Le compte reste : seules ses photos partent (suspendre le compte est une décision à part)
            if (!$photo || $photo === $target->getProfilePicture()) {
                $this->uploader->remove($target->getProfilePicture());
                $target->setProfilePicture(null);
            }
            if (!$photo || $photo === $target->getCoverPhoto()) {
                $this->uploader->remove($target->getCoverPhoto());
                $target->setCoverPhoto(null);
            }
        } elseif ($target instanceof TravelGroup) {
            $this->uploader->remove($target->getPhoto());
            $target->setPhoto(null);
        }
    }

    private function describe(string $type, object $target): string
    {
        return match (true) {
            $target instanceof Article     => sprintf('article « %s »', mb_substr($target->getTitle(), 0, 60)),
            $target instanceof Comment     => sprintf('commentaire de %s', UserPresenter::public($target->getAuthor())['displayName']),
            $target instanceof Place       => sprintf('lieu « %s »', mb_substr($target->getName(), 0, 60)),
            $target instanceof User        => sprintf('profil de %s', UserPresenter::public($target)['displayName']),
            $target instanceof TravelGroup => sprintf('groupe « %s »', mb_substr($target->getName(), 0, 60)),
            default                        => $type,
        };
    }

    /** @return array<string, mixed> */
    private function preview(string $type, object $target): array
    {
        return match (true) {
            $target instanceof Article => ['label' => $target->getTitle(), 'text' => mb_substr($target->getContent(), 0, 300),
                'author' => UserPresenter::public($target->getAuthor()), 'photos' => $this->photosOf($type, $target)],
            $target instanceof Comment => ['label' => 'Commentaire sur « ' . $target->getArticle()->getTitle() . ' »', 'text' => $target->getContent(),
                'author' => UserPresenter::public($target->getAuthor()), 'articleId' => $target->getArticle()->getId(), 'photos' => []],
            $target instanceof Place => ['label' => $target->getName(), 'text' => $target->getDescription(),
                'author' => $target->getCreatedBy() ? UserPresenter::public($target->getCreatedBy()) : null, 'photos' => $this->photosOf($type, $target)],
            $target instanceof User => ['label' => UserPresenter::public($target)['displayName'], 'text' => $target->getBio(),
                'author' => UserPresenter::public($target), 'suspended' => $target->isSuspended(), 'photos' => $this->photosOf($type, $target)],
            $target instanceof TravelGroup => ['label' => $target->getName(), 'text' => null,
                'author' => $target->getCreatedBy() ? UserPresenter::public($target->getCreatedBy()) : null, 'photos' => $this->photosOf($type, $target)],
            default => [],
        };
    }

    /** @return User[] */
    private function admins(): array
    {
        return array_values(array_filter(
            $this->em->getRepository(User::class)->createQueryBuilder('u')->where('u.roles LIKE :r')->setParameter('r', '%ROLE_ADMIN%')->getQuery()->getResult(),
            fn (User $u) => $u->isAdmin(),
        ));
    }
}
