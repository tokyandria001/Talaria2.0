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

        try {
            return $this->json(['results' => $geo->search((string) $request->query->get('q', ''))]);
        } catch (GeoSearchUnavailable) {
            return $this->json(['message' => 'La recherche de lieux est momentanément indisponible.', 'results' => []], 503);
        }
    }
}
