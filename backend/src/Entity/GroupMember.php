<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/** Appartenance d'un utilisateur à un groupe : organisateur ou membre, actif ou invité */
#[ORM\Entity]
#[ORM\Table(name: 'group_member')]
#[ORM\UniqueConstraint(name: 'uniq_group_member', columns: ['group_id', 'user_id'])]
#[ORM\HasLifecycleCallbacks]
class GroupMember
{
    public const ROLE_OWNER  = 'owner';
    public const ROLE_MEMBER = 'member';

    public const STATUS_ACTIVE  = 'active';
    public const STATUS_INVITED = 'invited';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    #[ORM\ManyToOne(targetEntity: TravelGroup::class, inversedBy: 'members')]
    #[ORM\JoinColumn(name: 'group_id', nullable: false, onDelete: 'CASCADE')]
    private TravelGroup $group;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(length: 10)]
    private string $role = self::ROLE_MEMBER;

    #[ORM\Column(length: 10)]
    private string $status = self::STATUS_INVITED;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $invitedBy = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $joinedAt = null;

    #[ORM\PrePersist]
    public function onPrePersist(): void { $this->createdAt = new \DateTimeImmutable(); }

    public function getId(): int { return $this->id; }

    public function getGroup(): TravelGroup { return $this->group; }
    public function setGroup(TravelGroup $v): static { $this->group = $v; return $this; }

    public function getUser(): User { return $this->user; }
    public function setUser(User $v): static { $this->user = $v; return $this; }

    public function getRole(): string { return $this->role; }
    public function isOwner(): bool { return $this->role === self::ROLE_OWNER; }
    public function makeOwner(): static { $this->role = self::ROLE_OWNER; return $this; }

    public function getStatus(): string { return $this->status; }
    public function isActive(): bool { return $this->status === self::STATUS_ACTIVE; }

    public function activate(): static
    {
        $this->status = self::STATUS_ACTIVE;
        $this->joinedAt ??= new \DateTimeImmutable();
        return $this;
    }

    public function getInvitedBy(): ?User { return $this->invitedBy; }
    public function setInvitedBy(?User $v): static { $this->invitedBy = $v; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
    public function getJoinedAt(): ?\DateTimeImmutable { return $this->joinedAt; }
}
