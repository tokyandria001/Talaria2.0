<?php

namespace App\Controller;

use App\Entity\User;
use App\Service\GeoSearch;
use App\Service\GeoSearchUnavailable;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\Routing\Attribute\Route;

/** Autocomplétion des villes et des pays (destination et ville de départ d'un voyage) */
class GeoController extends AbstractController
{
    #[Route('/api/geo/search', name: 'api_geo_search', methods: ['GET'])]
    public function search(Request $request, GeoSearch $geo, RateLimiterFactory $geoSearchLimiter): JsonResponse
    {
        /** @var User $me */
        $me = $this->getUser();
        if (!$geoSearchLimiter->create((string) $me->getId())->consume()->isAccepted()) {
            return $this->json(['message' => 'Trop de recherches, réessayez dans un instant.'], 429);
        }

        $q = (string) $request->query->get('q', '');
        try {
            // type=address : adresses et établissements (logement), proches de lat/lon si fournis
            if ($request->query->get('type') === 'address') {
                $lat = $request->query->get('lat'); $lon = $request->query->get('lon');
                return $this->json(['results' => $geo->searchAddress(
                    $q,
                    is_numeric($lat) ? (float) $lat : null,
                    is_numeric($lon) ? (float) $lon : null,
                )]);
            }
            return $this->json(['results' => $geo->search($q)]);
        } catch (GeoSearchUnavailable) {
            return $this->json(['message' => 'La recherche de lieux est momentanément indisponible.', 'results' => []], 503);
        }
    }

    /** Distance et durée en voiture : from=lat,lng & to=lat,lng */
    #[Route('/api/geo/route', name: 'api_geo_route', methods: ['GET'])]
    public function route(Request $request, GeoSearch $geo, RateLimiterFactory $geoSearchLimiter): JsonResponse
    {
        /** @var User $me */
        $me = $this->getUser();
        if (!$geoSearchLimiter->create((string) $me->getId())->consume()->isAccepted()) {
            return $this->json(['message' => 'Trop de recherches, réessayez dans un instant.'], 429);
        }

        $point = function (string $key) use ($request): ?array {
            $parts = explode(',', (string) $request->query->get($key, ''));
            if (count($parts) !== 2 || !is_numeric($parts[0]) || !is_numeric($parts[1])) return null;
            [$lat, $lng] = array_map('floatval', $parts);
            return abs($lat) <= 90 && abs($lng) <= 180 ? [$lat, $lng] : null;
        };
        $from = $point('from');
        $to = $point('to');
        if (!$from || !$to) return $this->json(['message' => 'Points de départ et d\'arrivée requis (from=lat,lng & to=lat,lng).'], 400);

        try {
            return $this->json($geo->route($from[0], $from[1], $to[0], $to[1]));
        } catch (GeoSearchUnavailable) {
            return $this->json(['message' => 'Le calcul d\'itinéraire est momentanément indisponible.'], 503);
        }
    }
}
