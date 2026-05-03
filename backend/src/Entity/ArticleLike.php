<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'article_like')]
#[ORM\HasLifecycleCallbacks]
class ArticleLike
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    #[ORM\ManyToOne(targetEntity: Article::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Article $article;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false)]
    private User $user;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\PrePersist]
    public function onPrePersist(): void
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): int { return $this->id; }

    public function getArticle(): Article { return $this->article; }
    public function setArticle(Article $a): static { $this->article = $a; return $this; }

    public function getUser(): User { return $this->user; }
    public function setUser(User $u): static { $this->user = $u; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}