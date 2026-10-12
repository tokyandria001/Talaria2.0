<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/** Remboursement entre deux participants d'un voyage (« Grégouz a remboursé 15 € à Alec ») */
#[ORM\Entity]
#[ORM\Table(name: 'settlement')]
#[ORM\HasLifecycleCallbacks]
class Settlement
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    #[ORM\ManyToOne(targetEntity: Trip::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Trip $trip;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $fromUser;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $toUser;

    #[ORM\Column]
    #[Assert\Range(min: 1, max: 10_000_000, notInRangeMessage: 'Le montant doit être compris entre 0,01 € et 100 000 €.')]
    private int $amountCents = 0;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $createdBy = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\PrePersist]
    public function onPrePersist(): void { $this->createdAt = new \DateTimeImmutable(); }

    public function getId(): int { return $this->id; }

    public function getTrip(): Trip { return $this->trip; }
    public function setTrip(Trip $v): static { $this->trip = $v; return $this; }

    public function getFromUser(): User { return $this->fromUser; }
    public function setFromUser(User $v): static { $this->fromUser = $v; return $this; }

    public function getToUser(): User { return $this->toUser; }
    public function setToUser(User $v): static { $this->toUser = $v; return $this; }

    public function getAmountCents(): int { return $this->amountCents; }
    public function setAmountCents(int $v): static { $this->amountCents = $v; return $this; }

    public function getCreatedBy(): ?User { return $this->createdBy; }
    public function setCreatedBy(?User $v): static { $this->createdBy = $v; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
