<?php

namespace App\Repository;

use App\Entity\Place;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class PlaceRepository extends ServiceEntityRepository
{
    /**
     * Correspondance entre les centres d'intérêt du profil utilisateur (User::activityTags)
     * et les tags de lieux (Place::tags), qui n'utilisent pas le même vocabulaire.
     */
    private const ACTIVITY_TO_PLACE_TAGS = [
        'culture'     => ['culture', 'visite', 'musee'],
        'nature'      => ['nature', 'plage', 'visite'],
        'nightlife'   => ['bar'],
        'sport'       => ['sport', 'activite'],
        'gastronomie' => ['restaurant', 'bar', 'marche'],
        'aventure'    => ['sport', 'activite', 'nature'],
        'plage'       => ['plage'],
    ];

    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Place::class);
    }

    /** Nombre de lieux renvoyés par défaut / au maximum (la carte charge la zone visible) */
    public const DEFAULT_LIMIT = 300;
    public const MAX_LIMIT = 500;

    /**
     * Lieux filtrés en base : catégorie principale (indexée), recherche, zone (indexée), limite.
     * Les plus aimés d'abord ; avec $recommendFor, les plus pertinents pour l'utilisateur passent devant.
     *
     * @return Place[]
     */
    public function findByFilters(array $tags = [], string $search = '', array $bbox = [], ?User $recommendFor = null, int $limit = self::DEFAULT_LIMIT): array
    {
        return $this->search($tags, $search, $bbox, $recommendFor, $limit)['places'];
    }

    /**
     * Comme findByFilters, en indiquant s'il reste d'autres lieux au-delà de la limite.
     *
     * @return array{places: Place[], truncated: bool}
     */
    public function search(array $tags = [], string $search = '', array $bbox = [], ?User $recommendFor = null, int $limit = self::DEFAULT_LIMIT): array
    {
        $limit = max(1, min($limit, self::MAX_LIMIT));
        // Lieux masqués après signalements : absents de la carte
        $qb = $this->createQueryBuilder('p')->andWhere('p.hiddenAt IS NULL');

        if ($search !== '') {
            $qb->andWhere('p.name LIKE :search OR p.description LIKE :search')
               ->setParameter('search', '%' . addcslashes($search, '%_') . '%');
        }

        if (count($bbox) === 4) {
            [$lat1, $lng1, $lat2, $lng2] = array_map('floatval', $bbox);
            $qb->andWhere('p.latitude BETWEEN :lat1 AND :lat2')
               ->andWhere('p.longitude BETWEEN :lng1 AND :lng2')
               ->setParameter('lat1', min($lat1, $lat2))
               ->setParameter('lat2', max($lat1, $lat2))
               ->setParameter('lng1', min($lng1, $lng2))
               ->setParameter('lng2', max($lng1, $lng2));
        }

        $tags = array_values(array_filter(array_map('strval', $tags)));
        if ($tags) {
            $qb->andWhere('p.primaryTag IN (:tags)')->setParameter('tags', $tags);
        }

        // Un de plus que la limite pour savoir s'il en reste
        $places = $qb->orderBy('p.likesCount', 'DESC')->addOrderBy('p.id', 'DESC')
            ->setMaxResults($limit + 1)
            ->getQuery()->getResult();

        $truncated = count($places) > $limit;
        $places = array_slice($places, 0, $limit);

        if ($recommendFor !== null) {
            $matchedPlaceTags = $this->matchedPlaceTagsFor($recommendFor);
            usort($places, function (Place $a, Place $b) use ($matchedPlaceTags) {
                return $this->recommendationScore($b, $matchedPlaceTags) <=> $this->recommendationScore($a, $matchedPlaceTags);
            });
        }

        return ['places' => $places, 'truncated' => $truncated];
    }

    /** Nombre de cases de la grille de regroupement sur le petit côté de la zone visible */
    private const CLUSTER_CELLS = 4;

    /**
     * Regroupement des lieux de la zone sur une grille (calculé en base, sans charger les lieux) :
     * une bulle par case avec le nombre de lieux et leur position moyenne. La taille des cases est
     * une puissance de 2 en degrés, pour que les bulles restent stables quand on déplace la carte
     * et se divisent quand on zoome. Les cases d'un seul lieu sont renvoyées comme lieux.
     *
     * @return array{clusters: list<array{latitude: float, longitude: float, count: int}>, places: Place[]}
     */
    public function clusters(array $tags, string $search, array $bbox): array
    {
        [$lat1, $lng1, $lat2, $lng2] = array_map('floatval', $bbox);
        $latMin = min($lat1, $lat2); $latMax = max($lat1, $lat2);
        $lngMin = min($lng1, $lng2); $lngMax = max($lng1, $lng2);

        $span = max(min($latMax - $latMin, $lngMax - $lngMin), 0.0001);
        $cell = 2 ** floor(log($span / self::CLUSTER_CELLS, 2));

        // Coordonnées décalées pour rester positives : la troncature entière vaut alors un arrondi inférieur
        $conn  = $this->getEntityManager()->getConnection();
        $floor = $conn->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\SQLitePlatform
            ? 'CAST(%s AS INTEGER)' : 'FLOOR(%s)';
        $cellLat = sprintf($floor, '(latitude + 90) / :cell');
        $cellLng = sprintf($floor, '(longitude + 180) / :cell');

        $where  = ['latitude BETWEEN :latMin AND :latMax', 'longitude BETWEEN :lngMin AND :lngMax', 'hidden_at IS NULL'];
        $params = ['cell' => $cell, 'latMin' => $latMin, 'latMax' => $latMax, 'lngMin' => $lngMin, 'lngMax' => $lngMax];
        $types  = [];

        if ($search !== '') {
            $where[] = '(name LIKE :search OR description LIKE :search)';
            $params['search'] = '%' . addcslashes($search, '%_') . '%';
        }
        $tags = array_values(array_filter(array_map('strval', $tags)));
        if ($tags) {
            $where[] = 'primary_tag IN (:tags)';
            $params['tags'] = $tags;
            $types['tags'] = \Doctrine\DBAL\ArrayParameterType::STRING;
        }

        $rows = $conn->fetchAllAssociative(
            "SELECT $cellLat AS cy, $cellLng AS cx, COUNT(*) AS n, AVG(latitude) AS lat, AVG(longitude) AS lng, MIN(id) AS id
             FROM place WHERE " . implode(' AND ', $where) . ' GROUP BY cy, cx',
            $params,
            $types,
        );

        $clusters = [];
        $singleIds = [];
        foreach ($rows as $row) {
            if ((int) $row['n'] === 1) {
                $singleIds[] = (int) $row['id'];
                continue;
            }
            $clusters[] = ['latitude' => (float) $row['lat'], 'longitude' => (float) $row['lng'], 'count' => (int) $row['n']];
        }
        usort($clusters, fn($a, $b) => $b['count'] <=> $a['count']);

        return [
            'clusters' => $clusters,
            'places'   => $singleIds ? $this->findBy(['id' => $singleIds]) : [],
        ];
    }

    /** Tags de lieux correspondant aux centres d'intérêt de l'utilisateur. */
    private function matchedPlaceTagsFor(User $user): array
    {
        $placeTags = [];
        foreach ($user->getActivityTags() as $activityTag) {
            $placeTags = array_merge($placeTags, self::ACTIVITY_TO_PLACE_TAGS[$activityTag] ?? []);
        }

        return array_unique($placeTags);
    }

    /** Score = pertinence (préférences) en priorité, puis popularité (likes). */
    private function recommendationScore(Place $place, array $matchedPlaceTags): int
    {
        $relevance = count(array_intersect($matchedPlaceTags, $place->getTags()));

        return $relevance * 1000 + $place->getLikesCount();
    }
}