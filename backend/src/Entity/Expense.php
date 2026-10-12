<?php

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Dépense réelle d'un voyage (étape 4) : qui a payé, combien, partagée entre qui.
 * Montant en centimes pour des calculs exacts.
 */
#[ORM\Entity]
#[ORM\Table(name: 'expense')]
#[ORM\HasLifecycleCallbacks]
class Expense
{
    public const CATEGORIES = ['transport', 'logement', 'activite', 'repas', 'autre'];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    #[ORM\ManyToOne(targetEntity: Trip::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Trip $trip;

    #[ORM\Column(length: 120)]
    #[Assert\NotBlank(message: 'Indiquez à quoi correspond la dépense.')]
    #[Assert\Length(max: 120)]
    private string $label = '';

    #[ORM\Column]
    #[Assert\Range(min: 1, max: 10_000_000, notInRangeMessage: 'Le montant doit être compris entre 0,01 € et 100 000 €.')]
    private int $amountCents = 0;

    #[ORM\Column(length: 20)]
    #[Assert\Choice(choices: self::CATEGORIES, message: 'Catégorie de dépense invalide.')]
    private string $category = 'autre';

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $paidBy;

    /** @var Collection<int, User> participants qui se partagent la dépense à parts égales */
    #[ORM\ManyToMany(targetEntity: User::class)]
    #[ORM\JoinTable(name: 'expense_participant')]
    #[ORM\JoinColumn(onDelete: 'CASCADE')]
    #[ORM\InverseJoinColumn(onDelete: 'CASCADE')]
    #[Assert\Count(min: 1, minMessage: 'La dépense doit être partagée entre au moins une personne.')]
    private Collection $participants;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $createdBy = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->participants = new ArrayCollection();
    }

    #[ORM\PrePersist]
    public function onPrePersist(): void { $this->createdAt = new \DateTimeImmutable(); }

    public function getId(): int { return $this->id; }

    public function getTrip(): Trip { return $this->trip; }
    public function setTrip(Trip $v): static { $this->trip = $v; return $this; }

    public function getLabel(): string { return $this->label; }
    public function setLabel(string $v): static { $this->label = $v; return $this; }

    public function getAmountCents(): int { return $this->amountCents; }
    public function setAmountCents(int $v): static { $this->amountCents = $v; return $this; }

    public function getCategory(): string { return $this->category; }
    public function setCategory(string $v): static { $this->category = $v; return $this; }

    public function getPaidBy(): User { return $this->paidBy; }
    public function setPaidBy(User $v): static { $this->paidBy = $v; return $this; }

    /** @return Collection<int, User> */
    public function getParticipants(): Collection { return $this->participants; }

    /** @param User[] $users */
    public function setParticipants(array $users): static
    {
        $this->participants->clear();
        foreach ($users as $u) {
            if (!$this->participants->contains($u)) $this->participants->add($u);
        }
        return $this;
    }

    public function getCreatedBy(): ?User { return $this->createdBy; }
    public function setCreatedBy(?User $v): static { $this->createdBy = $v; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
