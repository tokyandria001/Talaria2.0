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

    public function findByFilters(array $tags = [], string $search = '', array $bbox = [], ?User $recommendFor = null): array
    {
        $qb = $this->createQueryBuilder('p');

        if ($search !== '') {
            $qb->andWhere('p.name LIKE :search OR p.description LIKE :search')
               ->setParameter('search', '%' . $search . '%');
        }

        if (!empty($bbox) && count($bbox) === 4) {
            [$lat1, $lng1, $lat2, $lng2] = array_map('floatval', $bbox);
            $qb->andWhere('p.latitude BETWEEN :lat1 AND :lat2')
               ->andWhere('p.longitude BETWEEN :lng1 AND :lng2')
               ->setParameter('lat1', min($lat1, $lat2))
               ->setParameter('lat2', max($lat1, $lat2))
               ->setParameter('lng1', min($lng1, $lng2))
               ->setParameter('lng2', max($lng1, $lng2));
        }

        $places = $qb->orderBy('p.createdAt', 'DESC')->getQuery()->getResult();

        // Filter by tags in PHP (JSON array field) — un lieu matche s'il a au moins un des tags demandés
        if (!empty($tags)) {
            $places = array_filter($places, function (Place $p) use ($tags) {
                return count(array_intersect($tags, $p->getTags())) > 0;
            });
        }

        $places = array_values($places);

        if ($recommendFor !== null) {
            $matchedPlaceTags = $this->matchedPlaceTagsFor($recommendFor);
            usort($places, function (Place $a, Place $b) use ($matchedPlaceTags) {
                return $this->recommendationScore($b, $matchedPlaceTags) <=> $this->recommendationScore($a, $matchedPlaceTags);
            });
        }

        return $places;
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