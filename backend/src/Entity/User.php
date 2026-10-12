<?php

namespace App\Entity;

use App\Repository\UserRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Validator\Constraints\UniqueEntity;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: UserRepository::class)]
#[ORM\Table(name: '`user`')]
#[ORM\HasLifecycleCallbacks]
#[UniqueEntity(fields: ['email'], message: 'Un compte existe déjà avec cet email.')]
#[UniqueEntity(fields: ['username'], message: 'Ce pseudo est déjà pris.', ignoreNull: true)]
class User implements UserInterface, PasswordAuthenticatedUserInterface
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 180, unique: true)]
    #[Assert\NotBlank]
    #[Assert\Email]
    private ?string $email = null;

    #[ORM\Column]
    private array $roles = [];

    #[ORM\Column]
    private ?string $password = null;

    #[ORM\Column(length: 100, nullable: true)]
    #[Assert\Length(max: 100)]
    private ?string $firstName = null;

    #[ORM\Column(length: 100, nullable: true)]
    #[Assert\Length(max: 100)]
    private ?string $lastName = null;

    #[ORM\Column(length: 50, unique: true, nullable: true)]
    #[Assert\Length(min: 3, max: 50)]
    #[Assert\Regex(pattern: '/^[a-zA-Z0-9_.-]+$/', message: 'Le pseudo ne peut contenir que des lettres, chiffres, _, . ou -')]
    private ?string $username = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $profilePicture = null;

    /** Budget moyen par voyage (en euros) */
    #[ORM\Column(nullable: true)]
    #[Assert\PositiveOrZero(message: 'Le budget moyen ne peut pas être négatif.')]
    private ?int $averageBudget = null;

    /** Tags d'activités préférées: ["culture","nature","nightlife","sport","gastronomie","aventure"] */
    #[ORM\Column(type: 'json', nullable: true)]
    private array $activityTags = [];

    /** Mode de voyage: "budget" | "confort" | "luxe" */
    #[ORM\Column(length: 20, nullable: true)]
    private ?string $travelStyle = null;

    /** Rythme: "slow" | "fast" */
    #[ORM\Column(length: 10, nullable: true)]
    private ?string $travelPace = null;

    /** Transport favori: "avion" | "train" | "voiture" | "bateau" | "mixte" */
    #[ORM\Column(length: 20, nullable: true)]
    private ?string $favoriteTransport = null;

    /** Centres d'intérêt libres */
    #[ORM\Column(type: 'json', nullable: true)]
    private array $interests = [];

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $createdAt = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $updatedAt = null;

    #[ORM\PrePersist]
    public function onPrePersist(): void
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = new \DateTimeImmutable();
    }

    #[ORM\PreUpdate]
    public function onPreUpdate(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }

    public function getEmail(): ?string { return $this->email; }
    public function setEmail(string $email): static { $this->email = $email; return $this; }

    public function getUserIdentifier(): string { return (string) $this->email; }

    public function getRoles(): array
    {
        $roles = $this->roles;
        $roles[] = 'ROLE_USER';
        return array_unique($roles);
    }
    public function setRoles(array $roles): static { $this->roles = $roles; return $this; }

    public function getPassword(): ?string { return $this->password; }
    public function setPassword(string $password): static { $this->password = $password; return $this; }

    public function eraseCredentials(): void {}

    public function getFirstName(): ?string { return $this->firstName; }
    public function setFirstName(?string $firstName): static { $this->firstName = $firstName; return $this; }

    public function getLastName(): ?string { return $this->lastName; }
    public function setLastName(?string $lastName): static { $this->lastName = $lastName; return $this; }

    public function getPseudo(): ?string { return $this->username; }
    public function setPseudo(?string $username): static { $this->username = $username; return $this; }

    public function getProfilePicture(): ?string { return $this->profilePicture; }
    public function setProfilePicture(?string $profilePicture): static { $this->profilePicture = $profilePicture; return $this; }

    public function getAverageBudget(): ?int { return $this->averageBudget; }
    public function setAverageBudget(?int $averageBudget): static { $this->averageBudget = $averageBudget; return $this; }

    public function getActivityTags(): array { return $this->activityTags; }
    public function setActivityTags(array $activityTags): static { $this->activityTags = $activityTags; return $this; }

    public function getTravelStyle(): ?string { return $this->travelStyle; }
    public function setTravelStyle(?string $travelStyle): static { $this->travelStyle = $travelStyle; return $this; }

    public function getTravelPace(): ?string { return $this->travelPace; }
    public function setTravelPace(?string $travelPace): static { $this->travelPace = $travelPace; return $this; }

    public function getFavoriteTransport(): ?string { return $this->favoriteTransport; }
    public function setFavoriteTransport(?string $favoriteTransport): static { $this->favoriteTransport = $favoriteTransport; return $this; }

    public function getInterests(): array { return $this->interests; }
    public function setInterests(array $interests): static { $this->interests = $interests; return $this; }

    public function getCreatedAt(): ?\DateTimeImmutable { return $this->createdAt; }
    public function getUpdatedAt(): ?\DateTimeImmutable { return $this->updatedAt; }
}
