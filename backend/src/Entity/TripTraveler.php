<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Réglages d'un participant pour un voyage : son budget personnel et les personnes rattachées
 * (enfants...) qui voyagent avec lui et dont il paie la part.
 *
 * Nombre de personnes = 1 + rattachés : il multiplie sa part des dépenses communes et le prix des activités.
 */
#[ORM\Entity]
#[ORM\Table(name: 'trip_traveler')]
#[ORM\UniqueConstraint(name: 'uniq_trip_traveler', columns: ['trip_id', 'user_id'])]
class TripTraveler
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
    private User $user;

    /** Budget personnel pour le voyage (€, lui et ses rattachés) */
    #[ORM\Column(nullable: true)]
    #[Assert\Range(min: 0, max: 1_000_000, notInRangeMessage: 'Le budget doit être compris entre 0 et 1 000 000 €.')]
    private ?int $budget = null;

    /** Personnes rattachées (enfants...), en plus du participant */
    #[ORM\Column(options: ['default' => 0])]
    #[Assert\Range(min: 0, max: 20, notInRangeMessage: 'Entre 0 et 20 personnes rattachées.')]
    private int $dependents = 0;

    public function getId(): int { return $this->id; }

    public function getTrip(): Trip { return $this->trip; }
    public function setTrip(Trip $v): static { $this->trip = $v; return $this; }

    public function getUser(): User { return $this->user; }
    public function setUser(User $v): static { $this->user = $v; return $this; }

    public function getBudget(): ?int { return $this->budget; }
    public function setBudget(?int $v): static { $this->budget = $v; return $this; }

    public function getDependents(): int { return $this->dependents; }
    public function setDependents(int $v): static { $this->dependents = $v; return $this; }

    /** Nombre de personnes : le participant et ses rattachés */
    public function getHeads(): int { return 1 + $this->dependents; }
}
