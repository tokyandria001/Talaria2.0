<?php

namespace App\Controller;

use App\Entity\Place;
use App\Entity\PlaceLike;
use App\Entity\User;
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
    use ApiInputTrait;

    #[Route('', name: 'list', methods: ['GET'])]
    public function list(Request $request, PlaceRepository $repo, EntityManagerInterface $em): JsonResponse
    {
        /** @var User|null $me */
        $me = $this->getUser();

        if ($request->query->get('mine') === 'true') {
            $places = $em->getRepository(Place::class)->findBy(
                ['createdBy' => $me],
                ['createdAt' => 'DESC'],
            );
        } else {
            $tags        = $request->query->get('tags') ? explode(',', $request->query->get('tags')) : [];
            $search      = $request->query->get('search', '');
            $bbox        = $request->query->get('bbox') ? explode(',', $request->query->get('bbox')) : [];
            $recommended = $request->query->get('recommended') === 'true';
            $places      = $repo->findByFilters($tags, $search, $bbox, $recommended ? $me : null);
        }

        $likedIds = [];
        if ($me) {
            $likes = $em->getRepository(PlaceLike::class)->findBy(['user' => $me]);
            foreach ($likes as $like) {
                $likedIds[$like->getPlace()->getId()] = true;
            }
        }

        return $this->json([
            'places' => array_map(fn(Place $p) => $this->serialize($p, $likedIds), $places),
        ]);
    }

    #[Route('/{id}', name: 'get', methods: ['GET'])]
    public function get(Place $place, EntityManagerInterface $em): JsonResponse
    {
        /** @var User|null $me */
        $me       = $this->getUser();
        $likedIds = [];
        if ($me && $em->getRepository(PlaceLike::class)->findOneBy(['place' => $place, 'user' => $me])) {
            $likedIds[$place->getId()] = true;
        }

        return $this->json(['place' => $this->serialize($place, $likedIds)]);
    }

    /* ── Toggle like ──────────────────────────── */
    #[Route('/{id}/like', name: 'like', methods: ['POST'])]
    public function toggleLike(Place $place, EntityManagerInterface $em): JsonResponse
    {
        /** @var User $me */
        $me       = $this->getUser();
        $likeRepo = $em->getRepository(PlaceLike::class);
        $existing = $likeRepo->findOneBy(['place' => $place, 'user' => $me]);

        if ($existing) {
            $em->remove($existing);
            $place->setLikesCount(max(0, $place->getLikesCount() - 1));
            $liked = false;
        } else {
            $like = (new PlaceLike())->setPlace($place)->setUser($me);
            $em->persist($like);
            $place->setLikesCount($place->getLikesCount() + 1);
            $liked = true;
        }

        $em->flush();

        return $this->json(['liked' => $liked, 'likesCount' => $place->getLikesCount()]);
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
        if (!is_numeric($data['latitude']) || !is_numeric($data['longitude'])) {
            return $this->json(['message' => 'Coordonnées GPS invalides.'], 400);
        }

        $place = new Place();
        $place->setName(trim((string) $data['name']))
              ->setDescription(!empty($data['description']) ? trim((string) $data['description']) : null)
              ->setTags(is_array($data['tags'] ?? null) ? array_values($data['tags']) : [])
              ->setAveragePrice($this->parseInt($data['averagePrice'] ?? null, 'prix moyen'))
              ->setAddress(!empty($data['address']) ? trim((string) $data['address']) : null)
              ->setLatitude((float) $data['latitude'])
              ->setLongitude((float) $data['longitude'])
              ->setCreatedBy($this->getUser());

        $errors = $validator->validate($place);
        if (count($errors) > 0) return $this->validationError($errors);

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

    private function serialize(Place $place, array $likedIds = []): array
    {
        $user = $place->getCreatedBy();
        return [
            'id'           => $place->getId(),
            'name'         => $place->getName(),
            'description'  => $place->getDescription(),
            'tags'         => $place->getTags(),
            'averagePrice' => $place->getAveragePrice(),
            'address'      => $place->getAddress(),
            'latitude'     => $place->getLatitude(),
            'longitude'    => $place->getLongitude(),
            'photos'       => $place->getPhotos(),
            'likesCount'   => $place->getLikesCount(),
            'liked'        => isset($likedIds[$place->getId()]),
            'createdBy'    => $user ? ['id' => $user->getId(), 'email' => $user->getEmail()] : null,
            'createdAt'    => $place->getCreatedAt()?->format(\DateTimeInterface::ATOM),
        ];
    }
}