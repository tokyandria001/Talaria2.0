<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Signalement d'un contenu par un utilisateur (obligation du règlement européen sur les services
 * numériques). Les administrateurs sont prévenus ; au-delà de quelques signalements, le contenu est masqué.
 */
#[ORM\Entity]
#[ORM\Table(name: 'report')]
#[ORM\Index(name: 'idx_report_target', columns: ['target_type', 'target_id', 'status'])]
#[ORM\UniqueConstraint(name: 'uniq_report_reporter_target', columns: ['reporter_id', 'target_type', 'target_id'])]
#[ORM\HasLifecycleCallbacks]
class Report
{
    public const TARGETS = ['article', 'comment', 'place', 'user', 'group'];
    public const REASONS = ['haine', 'sexuel', 'violence', 'harcelement', 'spam', 'autre'];
    public const REASON_LABELS = [
        'haine' => 'contenu haineux', 'sexuel' => 'contenu sexuel', 'violence' => 'violence',
        'harcelement' => 'harcèlement', 'spam' => 'spam', 'autre' => 'autre motif',
    ];

    public const STATUS_OPEN = 'open';
    public const STATUS_DISMISSED = 'dismissed';   // classé sans suite
    public const STATUS_ACTIONED = 'actioned';     // contenu retiré

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $reporter;

    #[ORM\Column(length: 10)]
    #[Assert\Choice(choices: self::TARGETS, message: 'Contenu signalé invalide.')]
    private string $targetType;

    #[ORM\Column]
    private int $targetId;

    /** Photo précise signalée (photo d'un lieu, de profil, de couverture, d'un groupe) */
    #[ORM\Column(length: 255, nullable: true)]
    private ?string $photo = null;

    #[ORM\Column(length: 20)]
    #[Assert\Choice(choices: self::REASONS, message: 'Motif invalide.')]
    private string $reason;

    #[ORM\Column(length: 500, nullable: true)]
    #[Assert\Length(max: 500, maxMessage: 'Précision : 500 caractères maximum.')]
    private ?string $comment = null;

    #[ORM\Column(length: 10)]
    private string $status = self::STATUS_OPEN;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $handledBy = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $handledAt = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\PrePersist]
    public function onPrePersist(): void { $this->createdAt = new \DateTimeImmutable(); }

    public function getId(): int { return $this->id; }
    public function getReporter(): User { return $this->reporter; }
    public function setReporter(User $u): static { $this->reporter = $u; return $this; }
    public function getTargetType(): string { return $this->targetType; }
    public function getTargetId(): int { return $this->targetId; }
    public function setTarget(string $type, int $id): static { $this->targetType = $type; $this->targetId = $id; return $this; }
    public function getPhoto(): ?string { return $this->photo; }
    public function setPhoto(?string $p): static { $this->photo = $p; return $this; }
    public function getReason(): string { return $this->reason; }
    public function setReason(string $r): static { $this->reason = $r; return $this; }
    public function getComment(): ?string { return $this->comment; }
    public function setComment(?string $c): static { $this->comment = $c; return $this; }
    public function getStatus(): string { return $this->status; }
    public function isOpen(): bool { return $this->status === self::STATUS_OPEN; }
    public function getHandledBy(): ?User { return $this->handledBy; }
    public function getHandledAt(): ?\DateTimeImmutable { return $this->handledAt; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }

    public function close(string $status, User $admin): static
    {
        $this->status = $status;
        $this->handledBy = $admin;
        $this->handledAt = new \DateTimeImmutable();
        return $this;
    }
}
