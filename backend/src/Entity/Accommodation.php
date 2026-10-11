<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity]
#[ORM\Table(name: 'accommodation')]
#[ORM\HasLifecycleCallbacks]
class Accommodation
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    #[ORM\ManyToOne(targetEntity: Trip::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Trip $trip;

    #[ORM\Column(length: 200)]
    #[Assert\NotBlank(message: 'Le nom du logement est requis.')]
    private string $name;

    /** hotel | airbnb | autre */
    #[ORM\Column(length: 20)]
    #[Assert\Choice(choices: ['hotel', 'airbnb', 'autre'])]
    private string $type = 'hotel';

    #[ORM\Column(type: 'date_immutable')]
    #[Assert\NotBlank]
    private \DateTimeImmutable $checkIn;

    #[ORM\Column(type: 'date_immutable')]
    #[Assert\NotBlank]
    private \DateTimeImmutable $checkOut;

    #[ORM\Column(nullable: true)]
    private ?int $price = null;

    #[ORM\Column(options: ['default' => false])]
    private bool $hasSpecialPrice = false;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $specialPriceNote = null;

    #[ORM\Column(length: 500, nullable: true)]
    private ?string $link = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\PrePersist]
    public function onPrePersist(): void { $this->createdAt = new \DateTimeImmutable(); }

    public function getId(): int { return $this->id; }

    public function getTrip(): Trip { return $this->trip; }
    public function setTrip(Trip $v): static { $this->trip = $v; return $this; }

    public function getName(): string { return $this->name; }
    public function setName(string $v): static { $this->name = $v; return $this; }

    public function getType(): string { return $this->type; }
    public function setType(string $v): static { $this->type = $v; return $this; }

    public function getCheckIn(): \DateTimeImmutable { return $this->checkIn; }
    public function setCheckIn(\DateTimeImmutable $v): static { $this->checkIn = $v; return $this; }

    public function getCheckOut(): \DateTimeImmutable { return $this->checkOut; }
    public function setCheckOut(\DateTimeImmutable $v): static { $this->checkOut = $v; return $this; }

    public function getPrice(): ?int { return $this->price; }
    public function setPrice(?int $v): static { $this->price = $v; return $this; }

    public function hasSpecialPrice(): bool { return $this->hasSpecialPrice; }
    public function setHasSpecialPrice(bool $v): static { $this->hasSpecialPrice = $v; return $this; }

    public function getSpecialPriceNote(): ?string { return $this->specialPriceNote; }
    public function setSpecialPriceNote(?string $v): static { $this->specialPriceNote = $v; return $this; }

    public function getLink(): ?string { return $this->link; }
    public function setLink(?string $v): static { $this->link = $v; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
