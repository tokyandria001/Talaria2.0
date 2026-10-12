<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity]
#[ORM\Table(name: 'activity')]
#[ORM\Index(columns: ['trip_id', 'date'])]
#[ORM\HasLifecycleCallbacks]
class Activity
{
    /** Créneaux d'une journée, dans l'ordre chronologique */
    public const SLOTS = ['matin', 'midi', 'apres-midi', 'soir'];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    #[ORM\ManyToOne(targetEntity: Trip::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Trip $trip;

    /** Lieu de la carte associé (null pour une activité libre) */
    #[ORM\ManyToOne(targetEntity: Place::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?Place $place = null;

    #[ORM\Column(type: 'date_immutable')]
    private \DateTimeImmutable $date;

    /** matin | midi | apres-midi | soir */
    #[ORM\Column(length: 20)]
    #[Assert\Choice(choices: self::SLOTS, message: 'Créneau invalide.')]
    private string $slot = 'matin';

    #[ORM\Column(length: 200)]
    #[Assert\NotBlank(message: 'Le titre de l\'activité est requis.')]
    private string $title;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $description = null;

    /** Tag principal (visite, restaurant, bar, plage...) */
    #[ORM\Column(length: 30, nullable: true)]
    private ?string $category = null;

    #[ORM\Column(nullable: true)]
    #[Assert\PositiveOrZero(message: 'Le prix doit être positif.')]
    private ?int $price = null;

    #[ORM\Column(options: ['default' => false])]
    private bool $hasSpecialPrice = false;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $specialPriceNote = null;

    /** true si générée par le remplissage automatique (et pas encore modifiée) */
    #[ORM\Column(options: ['default' => false])]
    private bool $isAuto = false;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\PrePersist]
    public function onPrePersist(): void { $this->createdAt = new \DateTimeImmutable(); }

    public function getId(): int { return $this->id; }

    public function getTrip(): Trip { return $this->trip; }
    public function setTrip(Trip $v): static { $this->trip = $v; return $this; }

    public function getPlace(): ?Place { return $this->place; }
    public function setPlace(?Place $v): static { $this->place = $v; return $this; }

    public function getDate(): \DateTimeImmutable { return $this->date; }
    public function setDate(\DateTimeImmutable $v): static { $this->date = $v; return $this; }

    public function getSlot(): string { return $this->slot; }
    public function setSlot(string $v): static { $this->slot = $v; return $this; }

    public function getTitle(): string { return $this->title; }
    public function setTitle(string $v): static { $this->title = $v; return $this; }

    public function getDescription(): ?string { return $this->description; }
    public function setDescription(?string $v): static { $this->description = $v; return $this; }

    public function getCategory(): ?string { return $this->category; }
    public function setCategory(?string $v): static { $this->category = $v; return $this; }

    public function getPrice(): ?int { return $this->price; }
    public function setPrice(?int $v): static { $this->price = $v; return $this; }

    public function hasSpecialPrice(): bool { return $this->hasSpecialPrice; }
    public function setHasSpecialPrice(bool $v): static { $this->hasSpecialPrice = $v; return $this; }

    public function getSpecialPriceNote(): ?string { return $this->specialPriceNote; }
    public function setSpecialPriceNote(?string $v): static { $this->specialPriceNote = $v; return $this; }

    public function isAuto(): bool { return $this->isAuto; }
    public function setIsAuto(bool $v): static { $this->isAuto = $v; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }

    /** Clé de tri chronologique : date puis créneau */
    public function sortKey(): string
    {
        return $this->date->format('Y-m-d') . '-' . array_search($this->slot, self::SLOTS, true);
    }
}
