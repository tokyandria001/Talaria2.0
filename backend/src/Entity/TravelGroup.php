<?php

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Groupe de voyage (phase 8) : des amis qui organisent un ou plusieurs voyages ensemble.
 * (« TravelGroup » car GROUP est un mot réservé SQL.)
 */
#[ORM\Entity]
#[ORM\Table(name: 'travel_group')]
#[ORM\HasLifecycleCallbacks]
class TravelGroup
{
    /** Alphabet du code d'invitation (sans 0/O, 1/I pour éviter les confusions) */
    private const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    #[ORM\Column(length: 100)]
    #[Assert\NotBlank(message: 'Donnez un nom au groupe.')]
    #[Assert\Length(max: 100)]
    private string $name = '';

    #[ORM\Column(length: 500, nullable: true)]
    #[Assert\Length(max: 500)]
    private ?string $description = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $photo = null;

    /** Privé : seul l'organisateur invite et partage le lien */
    #[ORM\Column(options: ['default' => true])]
    private bool $isPrivate = true;

    /** Budget partagé : suivi des dépenses et remboursements (étape 4) */
    #[ORM\Column(options: ['default' => true])]
    private bool $sharedBudget = true;

    #[ORM\Column(length: 8, unique: true)]
    private string $inviteCode;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $createdBy = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    /** @var Collection<int, GroupMember> */
    #[ORM\OneToMany(targetEntity: GroupMember::class, mappedBy: 'group', cascade: ['persist'], orphanRemoval: true)]
    #[ORM\OrderBy(['createdAt' => 'ASC'])]
    private Collection $members;

    public function __construct()
    {
        $this->members = new ArrayCollection();
        $this->regenerateInviteCode();
    }

    #[ORM\PrePersist]
    public function onPrePersist(): void { $this->createdAt = new \DateTimeImmutable(); }

    public function regenerateInviteCode(): static
    {
        $code = '';
        for ($i = 0; $i < 8; $i++) {
            $code .= self::CODE_ALPHABET[random_int(0, strlen(self::CODE_ALPHABET) - 1)];
        }
        $this->inviteCode = $code;
        return $this;
    }

    public function getId(): int { return $this->id; }

    public function getName(): string { return $this->name; }
    public function setName(string $v): static { $this->name = $v; return $this; }

    public function getDescription(): ?string { return $this->description; }
    public function setDescription(?string $v): static { $this->description = $v; return $this; }

    public function getPhoto(): ?string { return $this->photo; }
    public function setPhoto(?string $v): static { $this->photo = $v; return $this; }

    public function isPrivate(): bool { return $this->isPrivate; }
    public function setIsPrivate(bool $v): static { $this->isPrivate = $v; return $this; }

    public function hasSharedBudget(): bool { return $this->sharedBudget; }
    public function setSharedBudget(bool $v): static { $this->sharedBudget = $v; return $this; }

    public function getInviteCode(): string { return $this->inviteCode; }

    public function getCreatedBy(): ?User { return $this->createdBy; }
    public function setCreatedBy(?User $v): static { $this->createdBy = $v; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }

    /** @return Collection<int, GroupMember> */
    public function getMembers(): Collection { return $this->members; }

    public function addMember(GroupMember $m): static
    {
        if (!$this->members->contains($m)) {
            $this->members->add($m);
            $m->setGroup($this);
        }
        return $this;
    }

    public function removeMember(GroupMember $m): static
    {
        $this->members->removeElement($m);
        return $this;
    }

    public function membershipOf(User $user): ?GroupMember
    {
        foreach ($this->members as $m) {
            if ($m->getUser()->getId() === $user->getId()) return $m;
        }
        return null;
    }

    /** @return GroupMember[] membres actifs (invitations exclues), du plus ancien au plus récent */
    public function activeMembers(): array
    {
        return array_values(array_filter($this->members->toArray(), fn (GroupMember $m) => $m->isActive()));
    }
}
