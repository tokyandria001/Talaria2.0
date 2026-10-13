<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * Utilisateur bloqué : il ne voit plus le profil de la personne qui bloque, ne la trouve plus
 * dans la recherche, ne peut plus lui envoyer de demande d'ami ni l'inviter dans un groupe.
 */
#[ORM\Entity]
#[ORM\Table(name: 'blocked_user')]
#[ORM\UniqueConstraint(name: 'uniq_blocked_user', columns: ['blocker_id', 'blocked_id'])]
#[ORM\HasLifecycleCallbacks]
class BlockedUser
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $blocker;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $blocked;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\PrePersist]
    public function onPrePersist(): void { $this->createdAt = new \DateTimeImmutable(); }

    public function getId(): int { return $this->id; }

    public function getBlocker(): User { return $this->blocker; }
    public function setBlocker(User $v): static { $this->blocker = $v; return $this; }

    public function getBlocked(): User { return $this->blocked; }
    public function setBlocked(User $v): static { $this->blocked = $v; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
