<?php

namespace App\Service;

use App\Entity\Place;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Logements proposés par Talaria pour une destination : les lieux de la base (hôtels, auberges
 * importés d'OpenStreetMap), complétés au besoin par une recherche OpenStreetMap (Photon) ailleurs
 * dans le monde. Les plus proches du centre d'abord.
 *
 * Les lieux n'ont pas de tarif : le prix est une estimation (type, style de voyage, nuits, voyageurs),
 * le lien de réservation donne le prix réel.
 */
final class AccommodationSuggester
{
    public const MAX = 3;
    private const RADIUS_KM = 8;

    /** Prix estimé par personne et par nuit (€), selon le style de voyage */
    public const PRICE_PER_NIGHT = [
        'hotel'    => ['budget' => 40, 'confort' => 65, 'luxe' => 130],
        'auberge'  => ['budget' => 25, 'confort' => 35, 'luxe' => 50],
        'airbnb'   => ['budget' => 35, 'confort' => 50, 'luxe' => 90],
        'habitant' => ['budget' => 30, 'confort' => 45, 'luxe' => 70],
    ];

    /** Type de logement → catégorie des lieux en base (null : pas dans la base) et recherche OpenStreetMap */
    private const SOURCES = [
        'hotel'    => ['place' => 'hotel',   'q' => 'hotel',       'osm' => 'tourism:hotel'],
        'auberge'  => ['place' => 'auberge', 'q' => 'hostel',      'osm' => 'tourism:hostel'],
        'airbnb'   => ['place' => null,      'q' => 'apartments',  'osm' => 'tourism:apartment'],
        'habitant' => ['place' => null,      'q' => 'guest house', 'osm' => 'tourism:guest_house'],
    ];

    /** Noms trop vagues pour être proposés (« Hotel », « Apartments »...) */
    private const GENERIC = ['hotel', 'hôtel', 'hostel', 'auberge', 'apartments', 'apartment', 'appartement', 'guest house', 'guesthouse', 'camping'];

    public function __construct(private EntityManagerInterface $em, private GeoSearch $geo) {}

    /**
     * @return list<array{name: string, type: string, address: ?string, latitude: float, longitude: float,
     *                    distanceKm: float, estimatedPrice: int, pricePerNight: int, link: string}>
     */
    public function suggest(
        float $lat, float $lon, string $type, \DateTimeImmutable $checkIn, \DateTimeImmutable $checkOut,
        int $travelers, ?string $style = null, ?string $city = null,
    ): array {
        $type = isset(self::SOURCES[$type]) ? $type : 'hotel';
        $source = self::SOURCES[$type];
        $nights = max(1, (int) $checkIn->diff($checkOut)->days);
        $travelers = max(1, min(30, $travelers));
        $perNight = self::PRICE_PER_NIGHT[$type][in_array($style, ['budget', 'confort', 'luxe'], true) ? $style : 'confort'];

        $found = $source['place'] ? $this->fromPlaces($source['place'], $lat, $lon) : [];
        if (count($found) < self::MAX) {
            try {
                $found = [...$found, ...$this->geo->nearbyByTag($source['q'], $source['osm'], $lat, $lon, self::RADIUS_KM)];
            } catch (GeoSearchUnavailable) {
                // Photon indisponible : on garde les lieux de la base
            }
        }

        // Un seul par nom, sans noms vagues, du plus proche au plus loin
        $unique = [];
        foreach ($found as $f) {
            $key = mb_strtolower(trim($f['name']));
            if (mb_strlen($key) < 4 || in_array($key, self::GENERIC, true) || isset($unique[$key])) continue;
            $unique[$key] = $f;
        }
        usort($unique, fn ($a, $b) => $a['distanceKm'] <=> $b['distanceKm']);

        return array_map(fn ($f) => $f + [
            'type'           => $type,
            'pricePerNight'  => $perNight,
            'estimatedPrice' => $perNight * $nights * $travelers,
            'link'           => self::bookingLink($type, $f['name'], $f['city'] ?? $city, $checkIn, $checkOut, $travelers),
        ], array_slice($unique, 0, self::MAX));
    }

    /** @return list<array{name: string, address: ?string, city: ?string, latitude: float, longitude: float, distanceKm: float}> */
    private function fromPlaces(string $tag, float $lat, float $lon): array
    {
        $dLat = self::RADIUS_KM / 111;
        $dLon = self::RADIUS_KM / (111 * max(0.2, cos(deg2rad($lat))));
        // Distance approchée (en degrés) pour trier en base, la vraie distance est calculée ensuite
        $places = $this->em->createQueryBuilder()
            ->select('p')->from(Place::class, 'p')
            ->where('p.primaryTag = :tag')
            ->andWhere('p.latitude BETWEEN :minLat AND :maxLat')->andWhere('p.longitude BETWEEN :minLon AND :maxLon')
            ->setParameter('tag', $tag)
            ->setParameter('minLat', $lat - $dLat)->setParameter('maxLat', $lat + $dLat)
            ->setParameter('minLon', $lon - $dLon)->setParameter('maxLon', $lon + $dLon)
            ->setParameter('lat', $lat)->setParameter('lon', $lon)
            ->orderBy('(p.latitude - :lat) * (p.latitude - :lat) + (p.longitude - :lon) * (p.longitude - :lon)')
            ->setMaxResults(12)
            ->getQuery()->getResult();

        return array_map(fn (Place $p) => [
            'name'       => $p->getName(),
            'address'    => $p->getAddress(),
            'city'       => null,
            'latitude'   => $p->getLatitude(),
            'longitude'  => $p->getLongitude(),
            'distanceKm' => round(GeoSearch::distanceKm($lat, $lon, $p->getLatitude(), $p->getLongitude()), 1),
        ], $places);
    }

    /** Recherche pré-remplie chez le site de réservation (dates et voyageurs) */
    private static function bookingLink(string $type, string $name, ?string $city, \DateTimeImmutable $in, \DateTimeImmutable $out, int $travelers): string
    {
        if ($type === 'airbnb') {
            return 'https://www.airbnb.fr/s/' . rawurlencode($city ?: $name) . '/homes?' . http_build_query([
                'checkin' => $in->format('Y-m-d'), 'checkout' => $out->format('Y-m-d'), 'adults' => $travelers,
            ]);
        }
        return 'https://www.booking.com/searchresults.fr.html?' . http_build_query([
            'ss' => trim($name . ($city ? ', ' . $city : '')),
            'checkin' => $in->format('Y-m-d'), 'checkout' => $out->format('Y-m-d'),
            'group_adults' => $travelers, 'no_rooms' => max(1, (int) ceil($travelers / 2)),
        ]);
    }
}
