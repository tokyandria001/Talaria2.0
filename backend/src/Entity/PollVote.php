<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/** Réponse d'un participant à un sondage du chat (une réponse par personne, modifiable) */
#[ORM\Entity]
#[ORM\Table(name: 'poll_vote')]
#[ORM\UniqueConstraint(name: 'uniq_poll_vote', columns: ['message_id', 'user_id'])]
class PollVote
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    #[ORM\ManyToOne(targetEntity: TripMessage::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private TripMessage $message;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    /** Index de la réponse choisie dans TripMessage::$pollOptions */
    #[ORM\Column]
    private int $optionIndex;

    public function getId(): int { return $this->id; }

    public function getMessage(): TripMessage { return $this->message; }
    public function setMessage(TripMessage $v): static { $this->message = $v; return $this; }

    public function getUser(): User { return $this->user; }
    public function setUser(User $v): static { $this->user = $v; return $this; }

    public function getOptionIndex(): int { return $this->optionIndex; }
    public function setOptionIndex(int $v): static { $this->optionIndex = $v; return $this; }
}
