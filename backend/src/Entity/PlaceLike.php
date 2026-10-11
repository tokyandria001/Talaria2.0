<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'place_like')]
#[ORM\HasLifecycleCallbacks]
class PlaceLike
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    #[ORM\ManyToOne(targetEntity: Place::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Place $place;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false)]
    private User $user;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\PrePersist]
    public function onPrePersist(): void
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): int { return $this->id; }

    public function getPlace(): Place { return $this->place; }
    public function setPlace(Place $p): static { $this->place = $p; return $this; }

    public function getUser(): User { return $this->user; }
    public function setUser(User $u): static { $this->user = $u; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
