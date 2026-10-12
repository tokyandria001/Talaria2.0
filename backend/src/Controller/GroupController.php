<?php

namespace App\Controller;

use App\Entity\Activity;
use App\Entity\GroupActivity;
use App\Entity\GroupMember;
use App\Entity\Notification;
use App\Entity\TravelGroup;
use App\Entity\Trip;
use App\Entity\User;
use App\Repository\FriendshipRepository;
use App\Service\GroupJournal;
use App\Service\ImageUploader;
use App\Service\UserPresenter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * Phase 8 (étape 2) — groupes de voyage : création, membres, invitations, code d'invitation.
 *
 * Règles : on n'invite que ses amis ; un invité accepte ou refuse ; le code fait entrer directement ;
 * groupe privé = seul l'organisateur invite / partage le code ; si l'organisateur part,
 * le membre le plus ancien le remplace (groupe supprimé s'il ne reste personne).
 */
#[Route('/api/groups', name: 'api_groups_')]
class GroupController extends AbstractController
{
    use ApiInputTrait;

    public function __construct(
        private EntityManagerInterface $em,
        private FriendshipRepository $friendships,
        private GroupJournal $journal,
    ) {}

    /* ── Mes groupes + invitations reçues ─────── */
    #[Route('', name: 'list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $me = $this->me();
        $memberships = $this->em->getRepository(GroupMember::class)->findBy(['user' => $me], ['createdAt' => 'DESC', 'id' => 'DESC']);

        $groups = $invitations = [];
        foreach ($memberships as $m) {
            if ($m->isActive()) {
                $groups[] = $this->summary($m->getGroup(), $m);
            } else {
                $invitations[] = $this->summary($m->getGroup(), $m) + [
                    'invitedBy' => $m->getInvitedBy() ? UserPresenter::public($m->getInvitedBy()) : null,
                ];
            }
        }

        return $this->json(['groups' => $groups, 'invitations' => $invitations]);
    }

    /* ── Créer un groupe ──────────────────────── */
    #[Route('', name: 'create', methods: ['POST'])]
    public function create(Request $req, ValidatorInterface $validator): JsonResponse
    {
        $me   = $this->me();
        $data = json_decode($req->getContent(), true) ?? [];

        $group = (new TravelGroup())->setCreatedBy($me);
        $this->applyFields($group, $data);

        $errors = $validator->validate($group);
        if (count($errors) > 0) return $this->validationError($errors);

        $owner = (new GroupMember())->setUser($me)->makeOwner()->activate();
        $group->addMember($owner);
        $this->em->persist($group);

        $invited = $this->inviteFriends($group, $me, $data['memberIds'] ?? []);
        if ($invited instanceof JsonResponse) return $invited;

        $this->journal->record($group, $me, 'group_created', UserPresenter::public($me)['displayName'] . ' a créé le groupe', notify: false);
        $this->em->flush();

        return $this->json($this->detail($group, $owner), 201);
    }

    /* ── Détail ───────────────────────────────── */
    #[Route('/{id}', name: 'get', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function get(int $id): JsonResponse
    {
        [$group, $me] = $this->loadGroup($id, allowInvited: true);
        if (!$group) return $this->notFound();

        return $this->json($this->detail($group, $me));
    }

    /* ── Modifier (organisateur) ──────────────── */
    #[Route('/{id}', name: 'update', methods: ['PATCH'], requirements: ['id' => '\d+'])]
    public function update(int $id, Request $req, ValidatorInterface $validator): JsonResponse
    {
        [$group, $me] = $this->loadGroup($id);
        if (!$group) return $this->notFound();
        if (!$me->isOwner()) return $this->forbidden('Seul l\'organisateur peut modifier le groupe.');

        $this->applyFields($group, json_decode($req->getContent(), true) ?? []);

        $errors = $validator->validate($group);
        if (count($errors) > 0) {
            $this->em->refresh($group);
            return $this->validationError($errors);
        }
        $this->em->flush();

        return $this->json($this->detail($group, $me));
    }

    /* ── Supprimer (organisateur) ─────────────── */
    #[Route('/{id}', name: 'delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function delete(int $id, ImageUploader $uploader): JsonResponse
    {
        [$group, $me] = $this->loadGroup($id);
        if (!$group) return $this->notFound();
        if (!$me->isOwner()) return $this->forbidden('Seul l\'organisateur peut supprimer le groupe.');

        $uploader->remove($group->getPhoto());
        $this->removeGroup($group);
        $this->em->flush();

        return $this->json(null, 204);
    }

    /* ── Photo du groupe (organisateur) ───────── */
    #[Route('/{id}/photo', name: 'photo', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function photo(int $id, Request $req, ImageUploader $uploader): JsonResponse
    {
        [$group, $me] = $this->loadGroup($id);
        if (!$group) return $this->notFound();
        if (!$me->isOwner()) return $this->forbidden('Seul l\'organisateur peut changer la photo.');

        $group->setPhoto($uploader->upload($req->files->get('photo'), 'groups', (string) $group->getId(), $group->getPhoto()));
        $this->em->flush();

        return $this->json(['photo' => $group->getPhoto()]);
    }

    /* ── Inviter des amis ─────────────────────── */
    #[Route('/{id}/members', name: 'invite', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function invite(int $id, Request $req): JsonResponse
    {
        [$group, $me] = $this->loadGroup($id);
        if (!$group) return $this->notFound();
        if (!$this->canInvite($group, $me)) return $this->forbidden('Dans un groupe privé, seul l\'organisateur peut inviter.');

        $data = json_decode($req->getContent(), true) ?? [];
        $invited = $this->inviteFriends($group, $me->getUser(), $data['userIds'] ?? []);
        if ($invited instanceof JsonResponse) return $invited;

        $this->em->flush();

        return $this->json($this->detail($group, $me));
    }

    /* ── Retirer un membre / annuler une invitation / quitter ─ */
    #[Route('/{id}/members/{userId}', name: 'remove_member', methods: ['DELETE'], requirements: ['id' => '\d+', 'userId' => '\d+'])]
    public function removeMember(int $id, int $userId): JsonResponse
    {
        [$group, $me] = $this->loadGroup($id, allowInvited: true);
        if (!$group) return $this->notFound();

        $leaving = $userId === $me->getUser()->getId();
        if (!$leaving && !($me->isActive() && $me->isOwner())) {
            return $this->forbidden('Seul l\'organisateur peut retirer un membre.');
        }

        $target = null;
        foreach ($group->getMembers() as $m) {
            if ($m->getUser()->getId() === $userId) { $target = $m; break; }
        }
        if (!$target) return $this->json(['message' => 'Ce membre ne fait pas partie du groupe.'], 404);

        $group->removeMember($target);

        // L'organisateur part : le membre actif le plus ancien prend le relais, sinon le groupe disparaît
        if ($target->isOwner()) {
            $successor = $group->activeMembers()[0] ?? null;
            if (!$successor) {
                $this->removeGroup($group);
                $this->em->flush();
                return $this->json(['deleted' => true]);
            }
            $successor->makeOwner();
        }

        $this->em->flush();

        return $leaving ? $this->json(['left' => true]) : $this->json($this->detail($group, $me));
    }

    /* ── Accepter / refuser une invitation ────── */
    #[Route('/{id}/accept', name: 'accept', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function accept(int $id): JsonResponse
    {
        [$group, $me] = $this->loadGroup($id, allowInvited: true);
        if (!$group || $me->isActive()) return $this->json(['message' => 'Invitation introuvable.'], 404);

        $me->activate();
        $this->notifyMembers($group, $me->getUser(), 'group_join', UserPresenter::public($me->getUser())['displayName'] . ' a rejoint « ' . $group->getName() . ' »');
        $this->em->flush();

        return $this->json($this->detail($group, $me));
    }

    #[Route('/{id}/decline', name: 'decline', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function decline(int $id): JsonResponse
    {
        [$group, $me] = $this->loadGroup($id, allowInvited: true);
        if (!$group || $me->isActive()) return $this->json(['message' => 'Invitation introuvable.'], 404);

        $group->removeMember($me);
        $this->em->flush();

        return $this->json(null, 204);
    }

    /* ── Nouveau code d'invitation (organisateur) ─ */
    #[Route('/{id}/invite-code', name: 'regenerate_code', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function regenerateCode(int $id): JsonResponse
    {
        [$group, $me] = $this->loadGroup($id);
        if (!$group) return $this->notFound();
        if (!$me->isOwner()) return $this->forbidden('Seul l\'organisateur peut changer le code d\'invitation.');

        $group->regenerateInviteCode();
        $this->em->flush();

        return $this->json(['inviteCode' => $group->getInviteCode()]);
    }

    /* ── Rejoindre avec un code ───────────────── */
    #[Route('/join/{code}', name: 'join_preview', methods: ['GET'])]
    public function joinPreview(string $code, RateLimiterFactory $groupJoinLimiter): JsonResponse
    {
        $me = $this->me();
        if (!$groupJoinLimiter->create((string) $me->getId())->consume()->isAccepted()) return $this->tooManyAttempts();

        $group = $this->byCode($code);
        if (!$group) return $this->json(['message' => 'Code d\'invitation invalide.'], 404);

        $membership = $group->membershipOf($me);
        return $this->json($this->summary($group, $membership) + ['alreadyMember' => (bool) $membership?->isActive()]);
    }

    #[Route('/join/{code}', name: 'join', methods: ['POST'])]
    public function join(string $code, RateLimiterFactory $groupJoinLimiter): JsonResponse
    {
        $me = $this->me();
        if (!$groupJoinLimiter->create((string) $me->getId())->consume()->isAccepted()) return $this->tooManyAttempts();

        $group = $this->byCode($code);
        if (!$group) return $this->json(['message' => 'Code d\'invitation invalide.'], 404);

        $membership = $group->membershipOf($me);
        if ($membership?->isActive()) return $this->json($this->detail($group, $membership));

        if (!$membership) {
            $membership = (new GroupMember())->setUser($me);
            $group->addMember($membership);
        }
        $membership->activate();
        $this->notifyMembers($group, $me, 'group_join', UserPresenter::public($me)['displayName'] . ' a rejoint « ' . $group->getName() . ' »');
        $this->em->flush();

        return $this->json($this->detail($group, $membership), 201);
    }

    /* ── Helpers ──────────────────────────────── */

    private function me(): User
    {
        /** @var User $me */
        $me = $this->getUser();
        return $me;
    }

    /**
     * Groupe + appartenance de l'utilisateur courant ; [null, null] s'il n'en fait pas partie.
     *
     * @return array{0: ?TravelGroup, 1: ?GroupMember}
     */
    private function loadGroup(int $id, bool $allowInvited = false): array
    {
        $group = $this->em->find(TravelGroup::class, $id);
        $membership = $group?->membershipOf($this->me());
        if (!$membership || (!$allowInvited && !$membership->isActive())) return [null, null];
        return [$group, $membership];
    }

    private function byCode(string $code): ?TravelGroup
    {
        $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $code));
        return strlen($code) === 8 ? $this->em->getRepository(TravelGroup::class)->findOneBy(['inviteCode' => $code]) : null;
    }

    private function canInvite(TravelGroup $group, GroupMember $me): bool
    {
        return $me->isActive() && ($me->isOwner() || !$group->isPrivate());
    }

    private function applyFields(TravelGroup $group, array $data): void
    {
        if (array_key_exists('name', $data))         $group->setName(trim((string) $data['name']));
        if (array_key_exists('description', $data))  $group->setDescription(trim((string) $data['description']) ?: null);
        if (array_key_exists('isPrivate', $data))    $group->setIsPrivate((bool) $data['isPrivate']);
        if (array_key_exists('sharedBudget', $data)) $group->setSharedBudget((bool) $data['sharedBudget']);
    }

    /**
     * Invite des amis de $inviter (les déjà-membres sont ignorés).
     *
     * @return int|JsonResponse nombre d'invitations, ou erreur si un utilisateur n'est pas un ami
     */
    private function inviteFriends(TravelGroup $group, User $inviter, mixed $userIds): int|JsonResponse
    {
        if (!is_array($userIds)) return $this->json(['message' => 'Liste de membres invalide.'], 400);
        $userIds = array_unique(array_map(fn ($v) => $this->parseInt($v, 'membre'), $userIds));
        if (count($userIds) > 50) return $this->json(['message' => '50 invitations maximum à la fois.'], 400);

        $count = 0;
        foreach ($userIds as $userId) {
            $user = $userId ? $this->em->find(User::class, $userId) : null;
            if (!$user) return $this->json(['message' => 'Utilisateur introuvable.'], 404);
            if ($group->membershipOf($user)) continue;

            if (!$this->friendships->findBetween($inviter, $user)?->isAccepted()) {
                return $this->json(['message' => sprintf('%s ne fait pas partie de vos amis.', UserPresenter::public($user)['displayName'])], 422);
            }

            $group->addMember((new GroupMember())->setUser($user)->setInvitedBy($inviter));
            $this->em->persist((new Notification())
                ->setRecipient($user)->setFromUser($inviter)->setGroup($group)
                ->setType('group_invite')
                ->setMessage(UserPresenter::public($inviter)['displayName'] . ' vous invite dans le groupe « ' . $group->getName() . ' »'));
            $count++;
        }
        return $count;
    }

    private function notifyMembers(TravelGroup $group, User $from, string $type, string $message): void
    {
        $this->journal->record($group, $from, $type, $message);
    }

    private function summary(TravelGroup $group, ?GroupMember $me): array
    {
        $active = $group->activeMembers();

        return [
            'id'           => $group->getId(),
            'name'         => $group->getName(),
            'description'  => $group->getDescription(),
            'photo'        => $group->getPhoto(),
            'isPrivate'    => $group->isPrivate(),
            'sharedBudget' => $group->hasSharedBudget(),
            'membersCount' => count($active),
            'membersPreview' => array_map(fn (GroupMember $m) => UserPresenter::public($m->getUser()), array_slice($active, 0, 5)),
            'myRole'       => $me?->getRole(),
            'myStatus'     => $me?->getStatus(),
        ];
    }

    private function detail(TravelGroup $group, GroupMember $me): array
    {
        $canInvite = $this->canInvite($group, $me);

        // Voyages du groupe (étape 3) : visibles des membres actifs uniquement
        $trips = $me->isActive()
            ? $this->em->getRepository(Trip::class)->findBy(['group' => $group], ['startDate' => 'ASC', 'id' => 'ASC'])
            : [];
        $today = (new \DateTimeImmutable('today'))->format('Y-m-d');
        $tripSummary = fn (Trip $t) => [
            'id'          => $t->getId(),
            'title'       => $t->getTitle(),
            'destination' => $t->getDestination(),
            'startDate'   => $t->getStartDate()->format('Y-m-d'),
            'endDate'     => $t->getEndDate()->format('Y-m-d'),
            'createdBy'   => UserPresenter::public($t->getUser()),
        ];
        $upcoming = array_values(array_filter($trips, fn (Trip $t) => $t->getEndDate()->format('Y-m-d') >= $today));
        $next = $upcoming[0] ?? null;

        return $this->summary($group, $me) + [
            'trips'       => array_map($tripSummary, $trips),
            'nextTrip'    => $next ? $tripSummary($next) : null,
            // Chiffres de l'écran groupe (prochain voyage) ; « dépensé » arrive avec les dépenses (étape 4)
            'stats' => [
                'budget'          => $next?->getBudget(),
                'spent'           => null,
                'activitiesCount' => $next ? $this->em->getRepository(Activity::class)->count(['trip' => $next]) : 0,
            ],
            'activity' => $me->isActive() ? array_map(fn (GroupActivity $a) => [
                'id'        => $a->getId(),
                'type'      => $a->getType(),
                'message'   => $a->getMessage(),
                'actor'     => $a->getActor() ? UserPresenter::public($a->getActor()) : null,
                'tripId'    => $a->getTrip()?->getId(),
                'createdAt' => $a->getCreatedAt()->format(\DateTimeInterface::ATOM),
            ], $this->journal->latest($group, 8)) : [],
            'createdAt'   => $group->getCreatedAt()->format(\DateTimeInterface::ATOM),
            'inviteCode'  => $canInvite ? $group->getInviteCode() : null,
            'permissions' => [
                'canEdit'   => $me->isActive() && $me->isOwner(),
                'canInvite' => $canInvite,
                'canRemove' => $me->isActive() && $me->isOwner(),
            ],
            'members' => array_map(fn (GroupMember $m) => [
                'user'      => UserPresenter::public($m->getUser()),
                'role'      => $m->getRole(),
                'status'    => $m->getStatus(),
                'joinedAt'  => $m->getJoinedAt()?->format('Y-m-d'),
                'invitedAt' => $m->getCreatedAt()->format('Y-m-d'),
            ], $group->getMembers()->toArray()),
        ];
    }

    /**
     * Supprime un groupe : ses voyages restent à leurs créateurs (détachés), ses notifications disparaissent.
     * Fait explicitement plutôt que de compter sur les ON DELETE de la base (et sur l'état en mémoire de Doctrine).
     */
    private function removeGroup(TravelGroup $group): void
    {
        $this->em->createQuery('UPDATE App\Entity\Trip t SET t.group = NULL WHERE t.group = :g')
            ->setParameter('g', $group)->execute();
        $this->em->createQuery('DELETE FROM App\Entity\Notification n WHERE n.group = :g')
            ->setParameter('g', $group)->execute();
        $this->em->createQuery('DELETE FROM App\Entity\GroupActivity a WHERE a.group = :g')
            ->setParameter('g', $group)->execute();
        $this->em->remove($group);
    }

    private function notFound(): JsonResponse
    {
        return $this->json(['message' => 'Groupe introuvable.'], 404);
    }

    private function forbidden(string $message): JsonResponse
    {
        return $this->json(['message' => $message], 403);
    }

    private function tooManyAttempts(): JsonResponse
    {
        return $this->json(['message' => 'Trop de tentatives avec des codes d\'invitation. Réessayez plus tard.'], 429);
    }
}
