<?php

namespace App\Repository;

use App\Entity\Place;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class PlaceRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Place::class);
    }

    public function findByFilters(array $tags = [], string $search = '', array $bbox = []): array
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

        // Filter by tags in PHP (JSON array field)
        if (!empty($tags)) {
            $places = array_filter($places, function (Place $p) use ($tags) {
                return count(array_intersect($tags, $p->getTags())) > 0;
            });
        }

        return array_values($places);
    }
}