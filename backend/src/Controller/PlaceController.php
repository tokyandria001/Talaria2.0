<?php

namespace App\Controller;

use App\Entity\Place;
use App\Entity\PlaceLike;
use App\Entity\User;
use App\Repository\PlaceRepository;
use App\Service\ImageUploader;
use App\Service\UserPresenter;
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
                ['createdAt' => 'DESC', 'id' => 'DESC'],
            );
        } else {
            $tags        = $request->query->get('tags') ? explode(',', $request->query->get('tags')) : [];
            $search      = $request->query->get('search', '');
            $bbox        = $request->query->get('bbox') ? explode(',', $request->query->get('bbox')) : [];
            $recommended = $request->query->get('recommended') === 'true';
            $limit       = (int) $request->query->get('limit', PlaceRepository::DEFAULT_LIMIT);
            $result      = $repo->search($tags, $search, $bbox, $recommended ? $me : null, $limit);
            $places      = $result['places'];
            $truncated   = $result['truncated'];

            // Trop de lieux dans la zone : bulles numérotées à la place des lieux (la carte reste fluide)
            if ($truncated && count($bbox) === 4 && $request->query->get('clusters') === 'true') {
                $grouped   = $repo->clusters($tags, $search, $bbox);
                $places    = $grouped['places'];
                $clusters  = $grouped['clusters'];
                $truncated = false;
            }
        }

        $likedIds = [];
        if ($me) {
            $likes = $em->getRepository(PlaceLike::class)->findBy(['user' => $me]);
            foreach ($likes as $like) {
                $likedIds[$like->getPlace()->getId()] = true;
            }
        }

        return $this->json([
            'places'    => array_map(fn(Place $p) => $this->serialize($p, $likedIds), $places),
            // true : la zone contient d'autres lieux (zoomer ou filtrer pour les voir)
            'truncated' => $truncated ?? false,
            // Bulles de regroupement (avec clusters=true) : position moyenne et nombre de lieux
            'clusters'  => $clusters ?? [],
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

    /* ── Photos du lieu (créateur du lieu, 8 maximum) ── */
    #[Route('/{id}/photos', name: 'photo_add', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function addPhoto(Place $place, Request $request, EntityManagerInterface $em, ImageUploader $uploader): JsonResponse
    {
        if ($place->getCreatedBy() !== $this->getUser()) {
            return $this->json(['message' => 'Seul le créateur du lieu peut ajouter des photos.'], 403);
        }
        if (count($place->getPhotos()) >= 8) {
            return $this->json(['message' => '8 photos maximum par lieu.'], 422);
        }

        $path = $uploader->upload($request->files->get('photo'), 'places', (string) $place->getId());
        $place->setPhotos([...$place->getPhotos(), $path]);
        $em->flush();

        return $this->json(['place' => $this->serialize($place)], 201);
    }

    #[Route('/{id}/photos/{index}', name: 'photo_delete', methods: ['DELETE'], requirements: ['id' => '\d+', 'index' => '\d+'])]
    public function deletePhoto(Place $place, int $index, EntityManagerInterface $em, ImageUploader $uploader): JsonResponse
    {
        if ($place->getCreatedBy() !== $this->getUser()) {
            return $this->json(['message' => 'Seul le créateur du lieu peut supprimer ses photos.'], 403);
        }
        $photos = $place->getPhotos();
        if (!isset($photos[$index])) return $this->json(['message' => 'Photo introuvable.'], 404);

        $uploader->remove($photos[$index]);
        array_splice($photos, $index, 1);
        $place->setPhotos($photos);
        $em->flush();

        return $this->json(['place' => $this->serialize($place)]);
    }

    #[Route('/{id}', name: 'delete', methods: ['DELETE'])]
    public function delete(Place $place, EntityManagerInterface $em, ImageUploader $uploader): JsonResponse
    {
        if ($place->getCreatedBy() !== $this->getUser()) {
            return $this->json(['message' => 'Interdit.'], 403);
        }

        foreach ($place->getPhotos() as $photo) $uploader->remove($photo);
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
            'openingHours' => $place->getOpeningHours(),
            'source'       => $place->getSource(),
            'latitude'     => $place->getLatitude(),
            'longitude'    => $place->getLongitude(),
            'photos'       => $place->getPhotos(),
            'likesCount'   => $place->getLikesCount(),
            'liked'        => isset($likedIds[$place->getId()]),
            'createdBy'    => $user ? UserPresenter::public($user) : null, // jamais l'email
            'createdAt'    => $place->getCreatedAt()?->format(\DateTimeInterface::ATOM),
        ];
    }
}