<?php

namespace App\Controller;

use App\Entity\Place;
use App\Repository\PlaceRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Validator\ValidatorInterface;

#[Route('/api/places', name: 'place_')]
class PlaceController extends AbstractController
{
    #[Route('', name: 'list', methods: ['GET'])]
    public function list(Request $request, PlaceRepository $repo, EntityManagerInterface $em): JsonResponse
    {
        if ($request->query->get('mine') === 'true') {
            $places = $em->getRepository(Place::class)->findBy(
                ['createdBy' => $this->getUser()],
                ['createdAt' => 'DESC'],
            );
        } else {
            $tags   = $request->query->get('tags') ? explode(',', $request->query->get('tags')) : [];
            $search = $request->query->get('search', '');
            $bbox   = $request->query->get('bbox') ? explode(',', $request->query->get('bbox')) : [];
            $places = $repo->findByFilters($tags, $search, $bbox);
        }

        return $this->json([
            'places' => array_map([$this, 'serialize'], $places),
        ]);
    }

    #[Route('/{id}', name: 'get', methods: ['GET'])]
    public function get(Place $place): JsonResponse
    {
        return $this->json(['place' => $this->serialize($place)]);
    }

    #[Route('', name: 'create', methods: ['POST'])]
    public function create(
        Request $request,
        EntityManagerInterface $em,
        ValidatorInterface $validator,
    ): JsonResponse {
        $data = json_decode($request->getContent(), true) ?? [];

        if (empty($data['name']) || !isset($data['latitude'], $data['longitude'])) {
            return $this->json(['message' => 'Nom, latitude et longitude requis.'], 400);
        }

        $place = new Place();
        $place->setName($data['name'])
              ->setDescription($data['description'] ?? null)
              ->setTags($data['tags'] ?? [])
              ->setAveragePrice(isset($data['averagePrice']) ? (int) $data['averagePrice'] : null)
              ->setLatitude((float) $data['latitude'])
              ->setLongitude((float) $data['longitude'])
              ->setCreatedBy($this->getUser());

        $errors = $validator->validate($place);
        if (count($errors) > 0) {
            $messages = [];
            foreach ($errors as $e) {
                $messages[$e->getPropertyPath()] = $e->getMessage();
            }
            return $this->json(['message' => 'Données invalides.', 'errors' => $messages], 422);
        }

        $em->persist($place);
        $em->flush();

        return $this->json(['place' => $this->serialize($place)], 201);
    }

    #[Route('/{id}', name: 'delete', methods: ['DELETE'])]
    public function delete(Place $place, EntityManagerInterface $em): JsonResponse
    {
        if ($place->getCreatedBy() !== $this->getUser()) {
            return $this->json(['message' => 'Interdit.'], 403);
        }

        $em->remove($place);
        $em->flush();

        return $this->json(null, 204);
    }

    private function serialize(Place $place): array
    {
        $user = $place->getCreatedBy();
        return [
            'id'           => $place->getId(),
            'name'         => $place->getName(),
            'description'  => $place->getDescription(),
            'tags'         => $place->getTags(),
            'averagePrice' => $place->getAveragePrice(),
            'latitude'     => $place->getLatitude(),
            'longitude'    => $place->getLongitude(),
            'photos'       => $place->getPhotos(),
            'createdBy'    => $user ? ['id' => $user->getId(), 'email' => $user->getEmail()] : null,
            'createdAt'    => $place->getCreatedAt()?->format(\DateTimeInterface::ATOM),
        ];
    }
}