<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Trajet envisagé par un participant pour rejoindre la destination (chacun peut partir d'ailleurs,
 * avec un autre moyen de transport, et en comparer plusieurs). Le trajet choisi devient une dépense
 * personnelle du participant.
 */
#[ORM\Entity]
#[ORM\Table(name: 'transport_option')]
#[ORM\Index(columns: ['trip_id', 'user_id'])]
#[ORM\HasLifecycleCallbacks]
class TransportOption
{
    public const MODES = ['avion', 'train', 'bus', 'voiture', 'covoiturage', 'autre'];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    #[ORM\ManyToOne(targetEntity: Trip::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Trip $trip;

    /** Le participant qui voyage (et paie ce trajet) */
    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(length: 20)]
    #[Assert\Choice(choices: self::MODES, message: 'Moyen de transport invalide.')]
    private string $mode = 'train';

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank(message: 'La ville de départ est requise.')]
    #[Assert\Length(max: 255)]
    private string $departureCity = '';

    #[ORM\Column(nullable: true)]
    private ?float $departureLatitude = null;

    #[ORM\Column(nullable: true)]
    private ?float $departureLongitude = null;

    /** Prix total du trajet pour le participant et ses rattachés (€, aller-retour) */
    #[ORM\Column(nullable: true)]
    #[Assert\PositiveOrZero(message: 'Le prix doit être positif.')]
    private ?int $price = null;

    #[ORM\Column(length: 500, nullable: true)]
    #[Assert\Length(max: 500)]
    private ?string $link = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Assert\Length(max: 255)]
    private ?string $note = null;

    #[ORM\Column(options: ['default' => false])]
    private bool $chosen = false;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\PrePersist]
    public function onPrePersist(): void { $this->createdAt = new \DateTimeImmutable(); }

    public function getId(): int { return $this->id; }

    public function getTrip(): Trip { return $this->trip; }
    public function setTrip(Trip $v): static { $this->trip = $v; return $this; }

    public function getUser(): User { return $this->user; }
    public function setUser(User $v): static { $this->user = $v; return $this; }

    public function getMode(): string { return $this->mode; }
    public function setMode(string $v): static { $this->mode = $v; return $this; }

    public function getDepartureCity(): string { return $this->departureCity; }
    public function setDepartureCity(string $v): static { $this->departureCity = $v; return $this; }

    public function getDepartureLatitude(): ?float { return $this->departureLatitude; }
    public function setDepartureLatitude(?float $v): static { $this->departureLatitude = $v; return $this; }

    public function getDepartureLongitude(): ?float { return $this->departureLongitude; }
    public function setDepartureLongitude(?float $v): static { $this->departureLongitude = $v; return $this; }

    public function getPrice(): ?int { return $this->price; }
    public function setPrice(?int $v): static { $this->price = $v; return $this; }

    public function getLink(): ?string { return $this->link; }
    public function setLink(?string $v): static { $this->link = $v; return $this; }

    public function getNote(): ?string { return $this->note; }
    public function setNote(?string $v): static { $this->note = $v; return $this; }

    public function isChosen(): bool { return $this->chosen; }
    public function setChosen(bool $v): static { $this->chosen = $v; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
