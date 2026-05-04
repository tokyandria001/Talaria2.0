<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity]
#[ORM\Table(name: 'trip')]
#[ORM\HasLifecycleCallbacks]
class Trip
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $title = null;

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank(message: 'La destination est requise.')]
    private string $destination;

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank(message: 'La ville de départ est requise.')]
    private string $departureCity;

    #[ORM\Column(type: 'date_immutable')]
    #[Assert\NotBlank]
    private \DateTimeImmutable $startDate;

    #[ORM\Column(type: 'date_immutable')]
    #[Assert\NotBlank]
    private \DateTimeImmutable $endDate;

    #[ORM\Column(options: ['default' => 1])]
    private int $travelers = 1;

    #[ORM\Column(nullable: true)]
    private ?int $budget = null;

    #[ORM\Column(length: 20)]
    #[Assert\Choice(choices: ['voiture', 'avion', 'train', 'bus'])]
    private string $transportMode = 'avion';

    // --- Voiture ---
    #[ORM\Column(nullable: true)]
    private ?int $distanceKm = null;

    #[ORM\Column(type: 'decimal', precision: 5, scale: 3, nullable: true)]
    private ?string $fuelPricePerLiter = null;

    #[ORM\Column(type: 'decimal', precision: 5, scale: 2, nullable: true)]
    private ?string $fuelConsumption = null;

    #[ORM\Column(nullable: true)]
    private ?int $tollCost = null;

    // --- Location sur place ---
    #[ORM\Column(options: ['default' => false])]
    private bool $needsRental = false;

    #[ORM\Column(length: 500, nullable: true)]
    private ?string $rentalLink = null;

    #[ORM\Column(nullable: true)]
    private ?int $rentalCost = null;

    // --- Liens réservation (JSON : [{type, url, label}]) ---
    #[ORM\Column(type: 'json', options: ['default' => '[]'])]
    private array $bookingLinks = [];

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $updatedAt = null;

    #[ORM\PrePersist]
    public function onPrePersist(): void { $this->createdAt = new \DateTimeImmutable(); }

    #[ORM\PreUpdate]
    public function onPreUpdate(): void { $this->updatedAt = new \DateTimeImmutable(); }

    // --- Getters / Setters ---

    public function getId(): int { return $this->id; }

    public function getTitle(): ?string { return $this->title; }
    public function setTitle(?string $v): static { $this->title = $v; return $this; }

    public function getDestination(): string { return $this->destination; }
    public function setDestination(string $v): static { $this->destination = $v; return $this; }

    public function getDepartureCity(): string { return $this->departureCity; }
    public function setDepartureCity(string $v): static { $this->departureCity = $v; return $this; }

    public function getStartDate(): \DateTimeImmutable { return $this->startDate; }
    public function setStartDate(\DateTimeImmutable $v): static { $this->startDate = $v; return $this; }

    public function getEndDate(): \DateTimeImmutable { return $this->endDate; }
    public function setEndDate(\DateTimeImmutable $v): static { $this->endDate = $v; return $this; }

    public function getTravelers(): int { return $this->travelers; }
    public function setTravelers(int $v): static { $this->travelers = $v; return $this; }

    public function getBudget(): ?int { return $this->budget; }
    public function setBudget(?int $v): static { $this->budget = $v; return $this; }

    public function getTransportMode(): string { return $this->transportMode; }
    public function setTransportMode(string $v): static { $this->transportMode = $v; return $this; }

    public function getDistanceKm(): ?int { return $this->distanceKm; }
    public function setDistanceKm(?int $v): static { $this->distanceKm = $v; return $this; }

    public function getFuelPricePerLiter(): ?string { return $this->fuelPricePerLiter; }
    public function setFuelPricePerLiter(?string $v): static { $this->fuelPricePerLiter = $v; return $this; }

    public function getFuelConsumption(): ?string { return $this->fuelConsumption; }
    public function setFuelConsumption(?string $v): static { $this->fuelConsumption = $v; return $this; }

    public function getTollCost(): ?int { return $this->tollCost; }
    public function setTollCost(?int $v): static { $this->tollCost = $v; return $this; }

    public function isNeedsRental(): bool { return $this->needsRental; }
    public function setNeedsRental(bool $v): static { $this->needsRental = $v; return $this; }

    public function getRentalLink(): ?string { return $this->rentalLink; }
    public function setRentalLink(?string $v): static { $this->rentalLink = $v; return $this; }

    public function getRentalCost(): ?int { return $this->rentalCost; }
    public function setRentalCost(?int $v): static { $this->rentalCost = $v; return $this; }

    public function getBookingLinks(): array { return $this->bookingLinks; }
    public function setBookingLinks(array $v): static { $this->bookingLinks = $v; return $this; }

    public function getUser(): User { return $this->user; }
    public function setUser(User $v): static { $this->user = $v; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
    public function getUpdatedAt(): ?\DateTimeImmutable { return $this->updatedAt; }

    /** Coût essence calculé (A/R) en euros, arrondi */
    public function computedFuelCost(): ?int
    {
        if (!$this->distanceKm || !$this->fuelPricePerLiter || !$this->fuelConsumption) {
            return null;
        }
        $liters = ($this->distanceKm * 2) * ((float) $this->fuelConsumption / 100);
        return (int) round($liters * (float) $this->fuelPricePerLiter);
    }

    /** Budget total calculé */
    public function computedTotalCost(): ?int
    {
        $fuel   = $this->computedFuelCost() ?? 0;
        $toll   = $this->tollCost ?? 0;
        $rental = $this->rentalCost ?? 0;
        if ($fuel === 0 && $toll === 0 && $rental === 0) return null;
        return $fuel + $toll + $rental;
    }
}
