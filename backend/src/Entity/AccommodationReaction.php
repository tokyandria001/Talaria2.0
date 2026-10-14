<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/** Avis d'un participant sur un hébergement proposé : j'aime (true) ou je n'aime pas (false) */
#[ORM\Entity]
#[ORM\Table(name: 'accommodation_reaction')]
#[ORM\UniqueConstraint(name: 'uniq_accommodation_reaction', columns: ['accommodation_id', 'user_id'])]
class AccommodationReaction
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    #[ORM\ManyToOne(targetEntity: Accommodation::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Accommodation $accommodation;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column]
    private bool $liked;

    public function getId(): int { return $this->id; }

    public function getAccommodation(): Accommodation { return $this->accommodation; }
    public function setAccommodation(Accommodation $v): static { $this->accommodation = $v; return $this; }

    public function getUser(): User { return $this->user; }
    public function setUser(User $v): static { $this->user = $v; return $this; }

    public function isLiked(): bool { return $this->liked; }
    public function setLiked(bool $v): static { $this->liked = $v; return $this; }
}
