<?php

namespace App\Entity;

use App\Repository\PlaceRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: PlaceRepository::class)]
#[ORM\Index(name: 'idx_place_position', columns: ['latitude', 'longitude'])]
#[ORM\Index(name: 'idx_place_primary_tag', columns: ['primary_tag'])]
#[ORM\Index(name: 'idx_place_popularity', columns: ['likes_count', 'id'])]
#[ORM\UniqueConstraint(name: 'uniq_place_external', columns: ['source', 'external_id'])]
#[ORM\HasLifecycleCallbacks]
class Place
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 200)]
    #[Assert\NotBlank]
    #[Assert\Length(max: 200)]
    private string $name;

    #[ORM\Column(type: 'text', nullable: true)]
    #[Assert\Length(max: 2000)]
    private ?string $description = null;

    /** restaurant | bar | hotel | visite | plage | sport | culture */
    #[ORM\Column(type: 'json')]
    #[Assert\Count(max: 10, maxMessage: '10 catégories maximum.')]
    #[Assert\All([new Assert\Type('string'), new Assert\Length(max: 30)])]
    private array $tags = [];

    /** Catégorie principale (premier tag), indexée pour filtrer la carte en base de données */
    #[ORM\Column(length: 30, nullable: true)]
    private ?string $primaryTag = null;

    /** Origine d'un lieu importé (ex. « osm ») et son identifiant d'origine : réimport sans doublon */
    #[ORM\Column(length: 20, nullable: true)]
    private ?string $source = null;

    #[ORM\Column(length: 64, nullable: true)]
    private ?string $externalId = null;

    /** Horaires au format OpenStreetMap (ex. « Mo-Sa 17:00-02:00 ») */
    #[ORM\Column(length: 255, nullable: true)]
    private ?string $openingHours = null;

    #[ORM\Column(nullable: true)]
    #[Assert\PositiveOrZero(message: 'Le prix moyen ne peut pas être négatif.')]
    private ?int $averagePrice = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Assert\Length(max: 255)]
    private ?string $address = null;

    #[ORM\Column]
    #[Assert\Range(min: -90, max: 90, notInRangeMessage: 'Latitude invalide.')]
    private float $latitude;

    #[ORM\Column]
    #[Assert\Range(min: -180, max: 180, notInRangeMessage: 'Longitude invalide.')]
    private float $longitude;

    #[ORM\Column(type: 'json')]
    private array $photos = [];

    #[ORM\Column(options: ['default' => 0])]
    private int $likesCount = 0;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: true)]
    private ?User $createdBy = null;

    #[ORM\Column]
    private ?\DateTimeImmutable $createdAt = null;

    #[ORM\PrePersist]
    public function onPrePersist(): void
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }

    public function getName(): string { return $this->name; }
    public function setName(string $name): static { $this->name = $name; return $this; }

    public function getDescription(): ?string { return $this->description; }
    public function setDescription(?string $description): static { $this->description = $description; return $this; }

    public function getTags(): array { return $this->tags; }
    public function setTags(array $tags): static
    {
        $this->tags = array_values($tags);
        $this->primaryTag = $this->tags[0] ?? null;
        return $this;
    }

    public function getPrimaryTag(): ?string { return $this->primaryTag; }

    public function getSource(): ?string { return $this->source; }
    public function setSource(?string $v): static { $this->source = $v; return $this; }

    public function getExternalId(): ?string { return $this->externalId; }
    public function setExternalId(?string $v): static { $this->externalId = $v; return $this; }

    public function getOpeningHours(): ?string { return $this->openingHours; }
    public function setOpeningHours(?string $v): static { $this->openingHours = $v; return $this; }

    public function getAveragePrice(): ?int { return $this->averagePrice; }
    public function setAveragePrice(?int $averagePrice): static { $this->averagePrice = $averagePrice; return $this; }

    public function getAddress(): ?string { return $this->address; }
    public function setAddress(?string $address): static { $this->address = $address; return $this; }

    public function getLatitude(): float { return $this->latitude; }
    public function setLatitude(float $latitude): static { $this->latitude = $latitude; return $this; }

    public function getLongitude(): float { return $this->longitude; }
    public function setLongitude(float $longitude): static { $this->longitude = $longitude; return $this; }

    public function getPhotos(): array { return $this->photos; }
    public function setPhotos(array $photos): static { $this->photos = $photos; return $this; }

    public function getLikesCount(): int { return $this->likesCount; }
    public function setLikesCount(int $likesCount): static { $this->likesCount = $likesCount; return $this; }

    public function getCreatedBy(): ?User { return $this->createdBy; }
    public function setCreatedBy(?User $createdBy): static { $this->createdBy = $createdBy; return $this; }

    public function getCreatedAt(): ?\DateTimeImmutable { return $this->createdAt; }
}