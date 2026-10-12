<?php

namespace App\Controller;

use App\Entity\Activity;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

class PriceDefaultsController extends AbstractController
{
    /** Prix moyens prédéfinis par tag (€ / personne), partagés par le web et le mobile */
    #[Route('/api/price-defaults', name: 'api_price_defaults', methods: ['GET'])]
    public function __invoke(): JsonResponse
    {
        return $this->json(Activity::DEFAULT_PRICES);
    }
}
