<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/** Vote d'un participant sur une activité proposée : « Je participe » (true) ou « Pas pour moi » (false) */
#[ORM\Entity]
#[ORM\Table(name: 'activity_vote')]
#[ORM\UniqueConstraint(name: 'uniq_activity_vote', columns: ['activity_id', 'user_id'])]
#[ORM\HasLifecycleCallbacks]
class ActivityVote
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    #[ORM\ManyToOne(targetEntity: Activity::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Activity $activity;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column]
    private bool $participates;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\PrePersist]
    public function onPrePersist(): void { $this->createdAt = new \DateTimeImmutable(); }

    public function getId(): int { return $this->id; }

    public function getActivity(): Activity { return $this->activity; }
    public function setActivity(Activity $v): static { $this->activity = $v; return $this; }

    public function getUser(): User { return $this->user; }
    public function setUser(User $v): static { $this->user = $v; return $this; }

    public function participates(): bool { return $this->participates; }
    public function setParticipates(bool $v): static { $this->participates = $v; return $this; }
}
