<?php

namespace App\Controller;

use App\Entity\PollVote;
use App\Entity\Trip;
use App\Entity\TripMessage;
use App\Entity\User;
use App\Service\TripAccess;
use App\Service\UserPresenter;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Cache\CacheItemPoolInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * Phase 9 — chat d'un voyage : messages, sondages, événements (remboursements, dépenses, votes).
 *
 * Pas de connexion permanente : l'app interroge GET /messages?after=<dernier id> toutes les
 * quelques secondes. La réponse contient aussi l'état à jour des sondages récents et la liste
 * des personnes en train d'écrire.
 */
#[Route('/api/trips/{tripId}', name: 'api_chat_', requirements: ['tripId' => '\d+'])]
class ChatController extends AbstractController
{
    /** Messages renvoyés au premier chargement */
    private const PAGE = 50;
    /** Sondages dont l'état est renvoyé à chaque interrogation */
    private const RECENT_POLLS = 20;
    /** « En train d'écrire » : durée de validité d'un signal (secondes) */
    private const TYPING_TTL = 6;

    public function __construct(
        private EntityManagerInterface $em,
        private TripAccess $access,
        private CacheItemPoolInterface $cache,
    ) {}

    #[Route('/messages', name: 'list', methods: ['GET'])]
    public function list(int $tripId, Request $req): JsonResponse
    {
        $me = $this->me();
        $trip = $this->access->findVisible($tripId, $me);
        if (!$trip) return $this->notFound();

        $qb = $this->em->getRepository(TripMessage::class)->createQueryBuilder('m')
            ->where('m.trip = :t')->setParameter('t', $trip);
        $after = (int) $req->query->get('after', 0);
        if ($after > 0) {
            $messages = $qb->andWhere('m.id > :after')->setParameter('after', $after)
                ->orderBy('m.id', 'ASC')->setMaxResults(200)->getQuery()->getResult();
        } else {
            $messages = array_reverse($qb->orderBy('m.id', 'DESC')->setMaxResults(self::PAGE)->getQuery()->getResult());
        }

        $polls = $this->em->getRepository(TripMessage::class)->findBy(
            ['trip' => $trip, 'type' => TripMessage::TYPE_POLL], ['id' => 'DESC'], self::RECENT_POLLS,
        );

        return $this->json([
            'messages' => $this->serializeAll($messages, $trip, $me),
            'polls'    => $this->serializeAll($polls, $trip, $me),
            'typing'   => $this->typingUsers($trip, $me),
        ]);
    }

    /** Envoyer un message { body } ou un sondage { poll: { question, options: [..], topic? } } */
    #[Route('/messages', name: 'create', methods: ['POST'])]
    public function create(int $tripId, Request $req, ValidatorInterface $validator): JsonResponse
    {
        $me = $this->me();
        $trip = $this->access->findVisible($tripId, $me);
        if (!$trip) return $this->notFound();

        $data = json_decode($req->getContent(), true) ?? [];
        $message = (new TripMessage())->setTrip($trip)->setAuthor($me);

        if (isset($data['poll'])) {
            $poll = is_array($data['poll']) ? $data['poll'] : [];
            $options = array_values(array_filter(array_map(
                fn ($o) => mb_substr(trim((string) $o), 0, 80),
                is_array($poll['options'] ?? null) ? $poll['options'] : [],
            ), fn ($o) => $o !== ''));
            if (count($options) < 2 || count($options) > 6) {
                return $this->json(['message' => 'Un sondage a entre 2 et 6 réponses.'], 422);
            }
            $topic = trim((string) ($poll['topic'] ?? ''));
            $message->setType(TripMessage::TYPE_POLL)
                ->setBody(trim((string) ($poll['question'] ?? '')))
                ->setPollOptions($options)
                ->setPollTopic($topic !== '' ? mb_substr($topic, 0, 40) : null);
        } else {
            $message->setBody(trim((string) ($data['body'] ?? '')));
        }

        $errors = $validator->validate($message);
        if (count($errors) > 0) {
            return $this->json(['message' => $errors[0]->getMessage()], 422);
        }

        $this->em->persist($message);
        $this->em->flush();
        $this->stopTyping($trip, $me);

        return $this->json($this->serializeAll([$message], $trip, $me)[0], 201);
    }

    /** Répondre à un sondage { option: index } (on peut changer d'avis) */
    #[Route('/messages/{id}/poll', name: 'poll_vote', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function votePoll(int $tripId, int $id, Request $req): JsonResponse
    {
        $me = $this->me();
        $trip = $this->access->findVisible($tripId, $me);
        $message = $trip ? $this->em->getRepository(TripMessage::class)->findOneBy(['id' => $id, 'trip' => $trip, 'type' => TripMessage::TYPE_POLL]) : null;
        if (!$message) return $this->notFound();

        $data = json_decode($req->getContent(), true) ?? [];
        $option = $data['option'] ?? null;
        if (!is_int($option) || !isset($message->getPollOptions()[$option])) {
            return $this->json(['message' => 'Réponse invalide.'], 400);
        }

        $vote = $this->em->getRepository(PollVote::class)->findOneBy(['message' => $message, 'user' => $me])
            ?? (new PollVote())->setMessage($message)->setUser($me);
        $vote->setOptionIndex($option);
        $this->em->persist($vote);
        $this->em->flush();

        return $this->json($this->serializeAll([$message], $trip, $me)[0]);
    }

    /** Signal « en train d'écrire », à renvoyer toutes les quelques secondes pendant la frappe */
    #[Route('/typing', name: 'typing', methods: ['POST'])]
    public function typing(int $tripId): JsonResponse
    {
        $me = $this->me();
        $trip = $this->access->findVisible($tripId, $me);
        if (!$trip) return $this->notFound();

        $item = $this->cache->getItem($this->typingKey($trip));
        $typing = $item->isHit() ? $item->get() : [];
        $typing[$me->getId()] = time();
        $this->cache->save($item->set($typing)->expiresAfter(self::TYPING_TTL * 2));

        return $this->json(null, 204);
    }

    /* ── Sérialisation ───────────────────────── */

    /** @param TripMessage[] $messages */
    private function serializeAll(array $messages, Trip $trip, User $me): array
    {
        $polls = array_filter($messages, fn (TripMessage $m) => $m->getType() === TripMessage::TYPE_POLL);
        $answers = [];
        if ($polls) {
            foreach ($this->em->getRepository(PollVote::class)->findBy(['message' => array_values($polls)]) as $v) {
                $answers[$v->getMessage()->getId()][] = $v;
            }
        }
        $participants = count($this->access->participants($trip));

        return array_map(function (TripMessage $m) use ($answers, $participants, $me) {
            $author = $m->getAuthor();
            $row = [
                'id'        => $m->getId(),
                'type'      => $m->getType(),
                'body'      => $m->getBody(),
                'author'    => $author && $m->getType() !== TripMessage::TYPE_SYSTEM ? UserPresenter::public($author) : null,
                'mine'      => $author?->getId() === $me->getId() && $m->getType() !== TripMessage::TYPE_SYSTEM,
                'createdAt' => $m->getCreatedAt()->format(\DateTimeInterface::ATOM),
            ];
            if ($m->getType() === TripMessage::TYPE_POLL) {
                $list = $answers[$m->getId()] ?? [];
                $counts = array_fill(0, count($m->getPollOptions() ?? []), 0);
                $mine = null;
                foreach ($list as $v) {
                    $counts[$v->getOptionIndex()] = ($counts[$v->getOptionIndex()] ?? 0) + 1;
                    if ($v->getUser()->getId() === $me->getId()) $mine = $v->getOptionIndex();
                }
                $row['poll'] = [
                    'topic'   => $m->getPollTopic(),
                    'options' => array_map(fn ($label, $i) => ['label' => $label, 'votes' => $counts[$i] ?? 0], $m->getPollOptions() ?? [], array_keys($m->getPollOptions() ?? [])),
                    'total'   => count($list),
                    'myOption' => $mine,
                    'participantsCount' => $participants,
                ];
            }
            return $row;
        }, array_values($messages));
    }

    /* ── En train d'écrire ───────────────────── */

    private function typingKey(Trip $trip): string
    {
        return 'chat_typing_' . $trip->getId();
    }

    /** @return array personnes ayant écrit dans les dernières secondes (sans moi) */
    private function typingUsers(Trip $trip, User $me): array
    {
        $item = $this->cache->getItem($this->typingKey($trip));
        if (!$item->isHit()) return [];

        $users = [];
        foreach ($this->access->participants($trip) as $u) {
            $at = $item->get()[$u->getId()] ?? 0;
            if ($u->getId() !== $me->getId() && $at >= time() - self::TYPING_TTL) $users[] = UserPresenter::public($u);
        }
        return $users;
    }

    private function stopTyping(Trip $trip, User $me): void
    {
        $item = $this->cache->getItem($this->typingKey($trip));
        if (!$item->isHit()) return;
        $typing = $item->get();
        unset($typing[$me->getId()]);
        $this->cache->save($item->set($typing)->expiresAfter(self::TYPING_TTL * 2));
    }

    /* ── Helpers ─────────────────────────────── */

    private function me(): User
    {
        /** @var User $me */
        $me = $this->getUser();
        return $me;
    }

    private function notFound(): JsonResponse
    {
        return $this->json(['message' => 'Introuvable.'], 404);
    }
}
