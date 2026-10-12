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

    /** Prix moyen prédéfini par personne (€), par tag — modifiable librement sur chaque activité */
    public const DEFAULT_PRICES = [
        'restaurant' => 25,
        'bar'        => 12,
        'visite'     => 15,
        'culture'    => 12,
        'sport'      => 30,
        'plage'      => 0,
        'musee'      => 12,
        'activite'   => 30,
        'marche'     => 15,
        'nature'     => 0,
    ];

    public static function defaultPriceFor(?string $category): ?int
    {
        return $category === null ? null : (self::DEFAULT_PRICES[$category] ?? null);
    }

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

    /** Heure facultative (8:30, 19:30...) ; quand elle est renseignée, le créneau en est déduit */
    #[ORM\Column(type: 'time_immutable', nullable: true)]
    private ?\DateTimeImmutable $time = null;

    #[ORM\Column(length: 200)]
    #[Assert\NotBlank(message: 'Le titre de l\'activité est requis.')]
    #[Assert\Length(max: 200)]
    private string $title;

    #[ORM\Column(type: 'text', nullable: true)]
    #[Assert\Length(max: 2000)]
    private ?string $description = null;

    /** Tag principal (visite, restaurant, bar, plage...) */
    #[ORM\Column(length: 30, nullable: true)]
    private ?string $category = null;

    /** Prix par personne (€) */
    #[ORM\Column(nullable: true)]
    #[Assert\PositiveOrZero(message: 'Le prix doit être positif.')]
    private ?int $price = null;

    #[ORM\Column(options: ['default' => false])]
    private bool $hasSpecialPrice = false;

    #[ORM\Column(length: 255, nullable: true)]
    #[Assert\Length(max: 255)]
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
    public function getTime(): ?\DateTimeImmutable { return $this->time; }

    /** Fixe l'heure et en déduit le créneau (null : on garde le créneau actuel) */
    public function setTime(?\DateTimeImmutable $v): static
    {
        $this->time = $v;
        if ($v) $this->slot = self::slotForTime($v);
        return $this;
    }

    public static function slotForTime(\DateTimeInterface $t): string
    {
        $hm = $t->format('H:i');
        return match (true) {
            $hm < '11:00' => 'matin',
            $hm < '14:30' => 'midi',
            $hm < '18:00' => 'apres-midi',
            default       => 'soir',
        };
    }

    /** Clé de tri chronologique : date, créneau, puis heure (activités sans heure en fin de créneau) */
    public function sortKey(): string
    {
        return $this->date->format('Y-m-d') . '-' . array_search($this->slot, self::SLOTS, true) . '-' . ($this->time?->format('H:i') ?? '99:99');
    }
}
