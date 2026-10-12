<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/** Journal d'un groupe (« Activité récente » de l'écran groupe) : une ligne par action, pas par destinataire */
#[ORM\Entity]
#[ORM\Table(name: 'group_activity')]
#[ORM\Index(columns: ['group_id', 'created_at'])]
#[ORM\HasLifecycleCallbacks]
class GroupActivity
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    #[ORM\ManyToOne(targetEntity: TravelGroup::class)]
    #[ORM\JoinColumn(name: 'group_id', nullable: false, onDelete: 'CASCADE')]
    private TravelGroup $group;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $actor = null;

    #[ORM\ManyToOne(targetEntity: Trip::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?Trip $trip = null;

    /** group_created | group_join | group_trip | trip_update | expense... */
    #[ORM\Column(length: 20)]
    private string $type;

    #[ORM\Column(length: 255)]
    private string $message;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\PrePersist]
    public function onPrePersist(): void { $this->createdAt = new \DateTimeImmutable(); }

    public function getId(): int { return $this->id; }

    public function getGroup(): TravelGroup { return $this->group; }
    public function setGroup(TravelGroup $v): static { $this->group = $v; return $this; }

    public function getActor(): ?User { return $this->actor; }
    public function setActor(?User $v): static { $this->actor = $v; return $this; }

    public function getTrip(): ?Trip { return $this->trip; }
    public function setTrip(?Trip $v): static { $this->trip = $v; return $this; }

    public function getType(): string { return $this->type; }
    public function setType(string $v): static { $this->type = $v; return $this; }

    public function getMessage(): string { return $this->message; }
    public function setMessage(string $v): static { $this->message = mb_substr($v, 0, 255); return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
