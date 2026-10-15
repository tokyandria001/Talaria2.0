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
    public const INVITE_POLICIES = ['everyone', 'friends', 'friends_of_friends', 'nobody'];

    /** Valeurs possibles des préférences de voyage (listes) */
    public const TRAVEL_PREFERENCES = [
        'transports'     => ['avion', 'train', 'voiture', 'bus', 'covoiturage'],
        'accommodations' => ['hotel', 'airbnb', 'auberge', 'camping'],
        'diets'          => ['vegetarien', 'vegan', 'sans-gluten', 'halal'],
    ];

    /** Onboarding : styles de voyageur (3 au plus) et avec qui l'on part le plus souvent */
    public const TRAVELER_TYPES = ['aventurier', 'foodie', 'culture', 'nature', 'fetard', 'romantique'];
    public const COMPANIONS = ['amis', 'couple', 'famille', 'solo'];
    /** Style de voyageur → centre d'intérêt utilisé pour remplir le planning */
    public const TRAVELER_TYPE_TAGS = [
        'aventurier' => 'aventure', 'foodie' => 'gastronomie', 'culture' => 'culture',
        'nature' => 'nature', 'fetard' => 'nightlife', 'romantique' => 'bien-etre',
    ];

    /** Délai avant la suppression effective d'un compte */
    public const DELETION_DELAY = '+30 days';

    public const DEFAULT_SETTINGS = [
        'notifications' => [
            'push'               => true,
            'groupMessages'      => true,
            'votes'              => true,
            'expenses'           => true,
            'departureReminders' => true,
            'deals'              => false,
            'inspiration'        => false,
            'weeklyDigest'       => true,
            'newsletter'         => false,
        ],
        'sharePosition' => false,
        'language'      => 'fr',
        'currency'      => 'EUR',
        'reimbursements' => [
            'methods'       => [],
            'remindDebts'   => true,
            'roundHalfEuro' => false,
        ],
    ];
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

    /** Empreinte du mot de passe ; null pour un compte créé avec Google (pas de mot de passe) */
    #[ORM\Column(nullable: true)]
    private ?string $password = null;

    /** Identifiant du compte Google lié (« sub » du jeton Google) */
    #[ORM\Column(length: 64, unique: true, nullable: true)]
    private ?string $googleId = null;

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

    /** Photo de couverture du profil (bandeau derrière la photo) */
    #[ORM\Column(length: 255, nullable: true)]
    private ?string $coverPhoto = null;

    /** Budget moyen par voyage (en euros) */
    #[ORM\Column(nullable: true)]
    #[Assert\PositiveOrZero(message: 'Le budget moyen ne peut pas être négatif.')]
    private ?int $averageBudget = null;

    /** Tags d'activités préférées: ["culture","nature","nightlife","sport","gastronomie","aventure"] */
    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $activityTags = [];

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
    private ?array $interests = [];

    /* ── Profil et paramètres (maquettes 27 à 37) ── */

    #[ORM\Column(type: 'text', nullable: true)]
    #[Assert\Length(max: 500, maxMessage: 'La bio fait 500 caractères maximum.')]
    private ?string $bio = null;

    #[ORM\Column(length: 30, nullable: true)]
    #[Assert\Regex(pattern: '/^\+?[0-9 .()-]{6,30}$/', message: 'Numéro de téléphone invalide.')]
    private ?string $phone = null;

    #[ORM\Column(options: ['default' => false])]
    private bool $hasCar = false;

    #[ORM\Column(options: ['default' => false])]
    private bool $hasDrivingLicense = false;

    /** Profil visible des autres voyageurs (sinon : nom et photo seulement, sauf pour les amis) */
    #[ORM\Column(options: ['default' => true])]
    private bool $profilePublic = true;

    /** Qui peut m'inviter dans un groupe : everyone | friends | friends_of_friends | nobody */
    #[ORM\Column(length: 20, options: ['default' => 'friends'])]
    #[Assert\Choice(choices: self::INVITE_POLICIES, message: 'Choix invalide.')]
    private string $invitePolicy = 'friends';

    /**
     * Préférences de voyage : transports, hébergements, régimes alimentaires (listes),
     * ecoFriendly, directFlightsOnly (booléens). Voir TRAVEL_PREFERENCES.
     */
    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $travelPreferences = null;

    /**
     * Réglages : notifications (par catégorie), position partagée, langue, devise,
     * moyens et rappels de remboursement. Voir DEFAULT_SETTINGS.
     */
    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $settings = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $passwordChangedAt = null;

    /** Suppression du compte demandée : effective 30 jours après (annulable d'ici là) */
    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $deletionRequestedAt = null;

    /** Parrain : la personne dont le lien d'invitation a mené à l'inscription (vidé si son compte est supprimé) */
    #[ORM\ManyToOne(targetEntity: self::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $referredBy = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $referredAt = null;

    /* ── Onboarding (questions après l'inscription) ── */

    /** Année de naissance : sert aux tarifs adaptés (-26 ans...), jamais affichée aux autres */
    #[ORM\Column(nullable: true)]
    #[Assert\Range(min: 1900, max: 2100, notInRangeMessage: 'Âge invalide.')]
    private ?int $birthYear = null;

    /** Ville de départ habituelle (trajets et prix calculés depuis chez soi) */
    #[ORM\Column(length: 120, nullable: true)]
    private ?string $homeCity = null;

    #[ORM\Column(nullable: true)]
    private ?float $homeLatitude = null;

    #[ORM\Column(nullable: true)]
    private ?float $homeLongitude = null;

    /** Gares et aéroports préférés près de chez soi (libellés) */
    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $homeHubs = null;

    /** Styles de voyageur (TRAVELER_TYPES, 3 au plus) */
    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $travelerTypes = null;

    /** Budget pour un week-end, par personne, transport et logement compris (€) */
    #[ORM\Column(nullable: true)]
    #[Assert\Range(min: 0, max: 100000, notInRangeMessage: 'Budget invalide.')]
    private ?int $weekendBudget = null;

    /** Avec qui l'on part le plus souvent (COMPANIONS) */
    #[ORM\Column(length: 20, nullable: true)]
    #[Assert\Choice(choices: self::COMPANIONS, message: 'Choix invalide.')]
    private ?string $companions = null;

    /** Destinations qui tentent (swipe de l'onboarding) */
    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $wishlist = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $onboardedAt = null;

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
    public function hasPassword(): bool { return $this->password !== null; }

    public function getReferredBy(): ?User { return $this->referredBy; }
    public function setReferredBy(?User $referredBy): static { $this->referredBy = $referredBy; return $this; }
    public function getReferredAt(): ?\DateTimeImmutable { return $this->referredAt; }
    public function setReferredAt(?\DateTimeImmutable $referredAt): static { $this->referredAt = $referredAt; return $this; }

    public function getGoogleId(): ?string { return $this->googleId; }
    public function setGoogleId(?string $googleId): static { $this->googleId = $googleId; return $this; }

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

    public function getActivityTags(): array { return $this->activityTags ?? []; }
    public function setActivityTags(array $activityTags): static { $this->activityTags = $activityTags; return $this; }

    public function getTravelStyle(): ?string { return $this->travelStyle; }
    public function setTravelStyle(?string $travelStyle): static { $this->travelStyle = $travelStyle; return $this; }

    public function getTravelPace(): ?string { return $this->travelPace; }
    public function setTravelPace(?string $travelPace): static { $this->travelPace = $travelPace; return $this; }

    public function getFavoriteTransport(): ?string { return $this->favoriteTransport; }
    public function setFavoriteTransport(?string $favoriteTransport): static { $this->favoriteTransport = $favoriteTransport; return $this; }

    public function getBirthYear(): ?int { return $this->birthYear; }
    public function setBirthYear(?int $year): static { $this->birthYear = $year; return $this; }
    public function getHomeCity(): ?string { return $this->homeCity; }
    public function setHomeCity(?string $city): static { $this->homeCity = $city; return $this; }
    public function getHomeLatitude(): ?float { return $this->homeLatitude; }
    public function setHomeLatitude(?float $lat): static { $this->homeLatitude = $lat; return $this; }
    public function getHomeLongitude(): ?float { return $this->homeLongitude; }
    public function setHomeLongitude(?float $lng): static { $this->homeLongitude = $lng; return $this; }
    public function getHomeHubs(): array { return $this->homeHubs ?? []; }
    public function setHomeHubs(array $hubs): static { $this->homeHubs = $hubs; return $this; }
    public function getTravelerTypes(): array { return $this->travelerTypes ?? []; }
    public function setTravelerTypes(array $types): static { $this->travelerTypes = $types; return $this; }
    public function getWeekendBudget(): ?int { return $this->weekendBudget; }
    public function setWeekendBudget(?int $budget): static { $this->weekendBudget = $budget; return $this; }
    public function getCompanions(): ?string { return $this->companions; }
    public function setCompanions(?string $companions): static { $this->companions = $companions; return $this; }
    public function getWishlist(): array { return $this->wishlist ?? []; }
    public function setWishlist(array $wishlist): static { $this->wishlist = $wishlist; return $this; }
    public function getOnboardedAt(): ?\DateTimeImmutable { return $this->onboardedAt; }
    public function setOnboardedAt(?\DateTimeImmutable $at): static { $this->onboardedAt = $at; return $this; }

    public function getInterests(): array { return $this->interests ?? []; }
    public function setInterests(array $interests): static { $this->interests = $interests; return $this; }

    public function getCreatedAt(): ?\DateTimeImmutable { return $this->createdAt; }
    public function getUpdatedAt(): ?\DateTimeImmutable { return $this->updatedAt; }

    public function getCoverPhoto(): ?string { return $this->coverPhoto; }
    public function setCoverPhoto(?string $v): static { $this->coverPhoto = $v; return $this; }

    public function getBio(): ?string { return $this->bio; }
    public function setBio(?string $v): static { $this->bio = $v; return $this; }

    public function getPhone(): ?string { return $this->phone; }
    public function setPhone(?string $v): static { $this->phone = $v; return $this; }

    public function hasCar(): bool { return $this->hasCar; }
    public function setHasCar(bool $v): static { $this->hasCar = $v; return $this; }

    public function hasDrivingLicense(): bool { return $this->hasDrivingLicense; }
    public function setHasDrivingLicense(bool $v): static { $this->hasDrivingLicense = $v; return $this; }

    public function isProfilePublic(): bool { return $this->profilePublic; }
    public function setProfilePublic(bool $v): static { $this->profilePublic = $v; return $this; }

    public function getInvitePolicy(): string { return $this->invitePolicy; }
    public function setInvitePolicy(string $v): static { $this->invitePolicy = $v; return $this; }

    /** Préférences de voyage complétées des valeurs par défaut */
    public function getTravelPreferences(): array
    {
        return ($this->travelPreferences ?? []) + [
            'transports' => [], 'accommodations' => [], 'diets' => [],
            'ecoFriendly' => false, 'directFlightsOnly' => false,
        ];
    }
    public function setTravelPreferences(array $v): static { $this->travelPreferences = $v; return $this; }

    /** Réglages complétés des valeurs par défaut (une clé ajoutée plus tard a toujours une valeur) */
    public function getSettings(): array
    {
        return array_replace_recursive(self::DEFAULT_SETTINGS, $this->settings ?? []);
    }
    public function setSettings(array $v): static { $this->settings = $v; return $this; }

    /** Une catégorie de notifications est-elle activée ? (notifications, votes, expenses...) */
    public function wantsNotification(string $category): bool
    {
        return (bool) ($this->getSettings()['notifications'][$category] ?? true);
    }

    public function getPasswordChangedAt(): ?\DateTimeImmutable { return $this->passwordChangedAt; }
    public function setPasswordChangedAt(?\DateTimeImmutable $v): static { $this->passwordChangedAt = $v; return $this; }

    public function getDeletionRequestedAt(): ?\DateTimeImmutable { return $this->deletionRequestedAt; }
    public function setDeletionRequestedAt(?\DateTimeImmutable $v): static { $this->deletionRequestedAt = $v; return $this; }

    /** Date de suppression effective (null si aucune suppression demandée) */
    public function getDeletionScheduledFor(): ?\DateTimeImmutable
    {
        return $this->deletionRequestedAt?->modify(self::DELETION_DELAY);
    }
}
