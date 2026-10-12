<?php

namespace App\Entity;

use App\Repository\FriendshipRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * Relation d'amitié entre deux utilisateurs (phase 7).
 * Une ligne = une demande (requester → addressee), en attente puis acceptée.
 * Un refus ou une annulation supprime la ligne.
 */
#[ORM\Entity(repositoryClass: FriendshipRepository::class)]
#[ORM\Table(name: 'friendship')]
#[ORM\UniqueConstraint(name: 'uniq_friendship_pair', columns: ['requester_id', 'addressee_id'])]
#[ORM\Index(columns: ['addressee_id', 'status'])]
#[ORM\HasLifecycleCallbacks]
class Friendship
{
    public const PENDING  = 'pending';
    public const ACCEPTED = 'accepted';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $requester;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $addressee;

    #[ORM\Column(length: 10)]
    private string $status = self::PENDING;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $acceptedAt = null;

    #[ORM\PrePersist]
    public function onPrePersist(): void { $this->createdAt = new \DateTimeImmutable(); }

    public function getId(): int { return $this->id; }

    public function getRequester(): User { return $this->requester; }
    public function setRequester(User $v): static { $this->requester = $v; return $this; }

    public function getAddressee(): User { return $this->addressee; }
    public function setAddressee(User $v): static { $this->addressee = $v; return $this; }

    public function getStatus(): string { return $this->status; }
    public function isAccepted(): bool { return $this->status === self::ACCEPTED; }

    public function accept(): static
    {
        $this->status = self::ACCEPTED;
        $this->acceptedAt = new \DateTimeImmutable();
        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
    public function getAcceptedAt(): ?\DateTimeImmutable { return $this->acceptedAt; }

    /** L'autre personne de la relation, vue depuis $me */
    public function otherThan(User $me): User
    {
        return $this->requester->getId() === $me->getId() ? $this->addressee : $this->requester;
    }

    public function involves(User $user): bool
    {
        return $this->requester->getId() === $user->getId() || $this->addressee->getId() === $user->getId();
    }
}
