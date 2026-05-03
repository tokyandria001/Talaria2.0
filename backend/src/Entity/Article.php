<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity]
#[ORM\Table(name: 'article')]
#[ORM\HasLifecycleCallbacks]
class Article
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank(message: 'Le titre est requis.')]
    #[Assert\Length(max: 255)]
    private string $title;

    #[ORM\Column(type: 'text')]
    #[Assert\NotBlank(message: 'Le contenu est requis.')]
    private string $content;

    #[ORM\Column(length: 500, nullable: true)]
    private ?string $excerpt = null;

    #[ORM\Column(length: 50)]
    #[Assert\NotBlank(message: 'La catégorie est requise.')]
    #[Assert\Choice(choices: ['Itinéraires', 'Aventures', 'Éco-Tourisme', 'Logements', 'Conseils'])]
    private string $category;

    #[ORM\Column(length: 500, nullable: true)]
    private ?string $coverImage = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false)]
    private User $author;

    #[ORM\Column(options: ['default' => 0])]
    private int $likesCount = 0;

    #[ORM\Column(options: ['default' => 0])]
    private int $commentsCount = 0;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $updatedAt = null;

    #[ORM\PrePersist]
    public function onPrePersist(): void
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    #[ORM\PreUpdate]
    public function onPreUpdate(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getId(): int { return $this->id; }

    public function getTitle(): string { return $this->title; }
    public function setTitle(string $t): static { $this->title = $t; return $this; }

    public function getContent(): string { return $this->content; }
    public function setContent(string $c): static { $this->content = $c; return $this; }

    public function getExcerpt(): ?string { return $this->excerpt; }
    public function setExcerpt(?string $e): static { $this->excerpt = $e; return $this; }

    public function getCategory(): string { return $this->category; }
    public function setCategory(string $c): static { $this->category = $c; return $this; }

    public function getCoverImage(): ?string { return $this->coverImage; }
    public function setCoverImage(?string $i): static { $this->coverImage = $i; return $this; }

    public function getAuthor(): User { return $this->author; }
    public function setAuthor(User $u): static { $this->author = $u; return $this; }

    public function getLikesCount(): int { return $this->likesCount; }
    public function setLikesCount(int $c): static { $this->likesCount = $c; return $this; }

    public function getCommentsCount(): int { return $this->commentsCount; }
    public function setCommentsCount(int $c): static { $this->commentsCount = $c; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
    public function getUpdatedAt(): ?\DateTimeImmutable { return $this->updatedAt; }
}