<?php

namespace App\Controller;

use App\Service\FuelPrices;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Prix moyens des carburants en France aujourd'hui (€/L) : gazole, sp95, e10, sp98, e85, gplc.
 * Sert à estimer le coût d'un trajet en voiture (site, app mobile).
 */
class FuelPriceController extends AbstractController
{
    #[Route('/api/fuel-prices', name: 'api_fuel_prices', methods: ['GET'])]
    public function __invoke(FuelPrices $fuelPrices): JsonResponse
    {
        return $this->json($fuelPrices->current());
    }
}
