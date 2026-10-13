<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Message du chat d'un voyage (phase 9) :
 * - « text » : message d'un participant ;
 * - « system » : événement du voyage (remboursement, dépense, vote), sans auteur affiché ;
 * - « poll » : sondage, $body = la question, $pollOptions = les réponses possibles.
 */
#[ORM\Entity]
#[ORM\Table(name: 'trip_message')]
#[ORM\Index(columns: ['trip_id', 'id'])]
#[ORM\HasLifecycleCallbacks]
class TripMessage
{
    public const TYPE_TEXT   = 'text';
    public const TYPE_SYSTEM = 'system';
    public const TYPE_POLL   = 'poll';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    #[ORM\ManyToOne(targetEntity: Trip::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Trip $trip;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $author = null;

    #[ORM\Column(length: 10)]
    private string $type = self::TYPE_TEXT;

    #[ORM\Column(type: 'text')]
    #[Assert\NotBlank(message: 'Le message est vide.')]
    #[Assert\Length(max: 2000, maxMessage: 'Message trop long (2 000 caractères maximum).')]
    private string $body = '';

    /** Sondage : libellés des réponses */
    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $pollOptions = null;

    /** Sondage : thème affiché au-dessus de la question (« Logement ») */
    #[ORM\Column(length: 40, nullable: true)]
    private ?string $pollTopic = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\PrePersist]
    public function onPrePersist(): void { $this->createdAt = new \DateTimeImmutable(); }

    public function getId(): int { return $this->id; }

    public function getTrip(): Trip { return $this->trip; }
    public function setTrip(Trip $v): static { $this->trip = $v; return $this; }

    public function getAuthor(): ?User { return $this->author; }
    public function setAuthor(?User $v): static { $this->author = $v; return $this; }

    public function getType(): string { return $this->type; }
    public function setType(string $v): static { $this->type = $v; return $this; }

    public function getBody(): string { return $this->body; }
    public function setBody(string $v): static { $this->body = $v; return $this; }

    public function getPollOptions(): ?array { return $this->pollOptions; }
    public function setPollOptions(?array $v): static { $this->pollOptions = $v; return $this; }

    public function getPollTopic(): ?string { return $this->pollTopic; }
    public function setPollTopic(?string $v): static { $this->pollTopic = $v; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
