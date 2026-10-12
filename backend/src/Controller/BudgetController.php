<?php

namespace App\Controller;

use App\Entity\Expense;
use App\Entity\Settlement;
use App\Entity\Trip;
use App\Entity\User;
use App\Service\BudgetCalculator;
use App\Service\TripAccess;
use App\Service\UserPresenter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * Étape 4 — budget réel d'un voyage : dépenses, part de chacun, remboursements.
 *
 * Tous les participants peuvent ajouter une dépense. La modifier ou la supprimer : son auteur,
 * la personne qui a payé, ou un gestionnaire du voyage. Enregistrer un remboursement :
 * l'une des deux personnes concernées ou un gestionnaire.
 */
#[Route('/api/trips/{tripId}', name: 'api_budget_', requirements: ['tripId' => '\d+'])]
class BudgetController extends AbstractController
{
    use ApiInputTrait;

    public function __construct(
        private EntityManagerInterface $em,
        private TripAccess $access,
        private BudgetCalculator $calculator,
    ) {}

    /* ── Tableau de bord du budget ────────────── */
    #[Route('/budget', name: 'get', methods: ['GET'])]
    public function budget(int $tripId): JsonResponse
    {
        $trip = $this->access->findVisible($tripId, $this->me());
        if (!$trip) return $this->notFound();

        return $this->json($this->view($trip));
    }

    /* ── Dépenses ─────────────────────────────── */
    #[Route('/expenses', name: 'expense_create', methods: ['POST'])]
    public function createExpense(int $tripId, Request $req, ValidatorInterface $validator): JsonResponse
    {
        $me = $this->me();
        $trip = $this->access->findVisible($tripId, $me);
        if (!$trip) return $this->notFound();

        $data = json_decode($req->getContent(), true) ?? [];
        $expense = (new Expense())->setTrip($trip)->setCreatedBy($me)->setPaidBy($me)
            ->setParticipants($this->access->participants($trip));
        if ($error = $this->applyExpense($expense, $trip, $data)) return $error;

        $errors = $validator->validate($expense);
        if (count($errors) > 0) return $this->validationError($errors);

        $this->em->persist($expense);
        $this->access->notifyGroup($trip, $me, 'expense', sprintf(
            '%s a payé « %s » · %s',
            UserPresenter::public($expense->getPaidBy())['displayName'], $expense->getLabel(), self::euros($expense->getAmountCents()),
        ));
        $this->em->flush();

        return $this->json($this->view($trip), 201);
    }

    #[Route('/expenses/{id}', name: 'expense_update', methods: ['PATCH'], requirements: ['id' => '\d+'])]
    public function updateExpense(int $tripId, int $id, Request $req, ValidatorInterface $validator): JsonResponse
    {
        [$trip, $expense] = $this->loadExpense($tripId, $id);
        if (!$expense) return $this->json(['message' => 'Dépense introuvable.'], 404);
        if (!$this->canEditExpense($trip, $expense)) return $this->forbidden('Seuls son auteur, la personne qui a payé et l\'organisateur peuvent modifier cette dépense.');

        if ($error = $this->applyExpense($expense, $trip, json_decode($req->getContent(), true) ?? [])) {
            $this->em->refresh($expense);
            return $error;
        }
        $errors = $validator->validate($expense);
        if (count($errors) > 0) {
            $this->em->refresh($expense);
            return $this->validationError($errors);
        }
        $this->em->flush();

        return $this->json($this->view($trip));
    }

    #[Route('/expenses/{id}', name: 'expense_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function deleteExpense(int $tripId, int $id): JsonResponse
    {
        [$trip, $expense] = $this->loadExpense($tripId, $id);
        if (!$expense) return $this->json(['message' => 'Dépense introuvable.'], 404);
        if (!$this->canEditExpense($trip, $expense)) return $this->forbidden('Seuls son auteur, la personne qui a payé et l\'organisateur peuvent supprimer cette dépense.');

        $this->em->remove($expense);
        $this->em->flush();

        return $this->json($this->view($trip));
    }

    /* ── Remboursements ───────────────────────── */
    #[Route('/settlements', name: 'settlement_create', methods: ['POST'])]
    public function createSettlement(int $tripId, Request $req, ValidatorInterface $validator): JsonResponse
    {
        $me = $this->me();
        $trip = $this->access->findVisible($tripId, $me);
        if (!$trip) return $this->notFound();

        $data = json_decode($req->getContent(), true) ?? [];
        $from = $this->participantById($trip, $data['fromId'] ?? null);
        $to   = $this->participantById($trip, $data['toId'] ?? null);
        if (!$from || !$to) return $this->json(['message' => 'Les deux personnes doivent participer au voyage.'], 422);
        if ($from === $to) return $this->json(['message' => 'On ne se rembourse pas soi-même.'], 422);
        if (!in_array($me->getId(), [$from->getId(), $to->getId()], true) && !$this->access->canManage($trip, $me)) {
            return $this->forbidden('Seules les personnes concernées (ou l\'organisateur) peuvent enregistrer ce remboursement.');
        }

        $settlement = (new Settlement())->setTrip($trip)->setFromUser($from)->setToUser($to)->setCreatedBy($me)
            ->setAmountCents($this->parseAmountCents($data['amount'] ?? null));
        $errors = $validator->validate($settlement);
        if (count($errors) > 0) return $this->validationError($errors);

        $this->em->persist($settlement);
        $this->access->notifyGroup($trip, $me, 'settlement', sprintf(
            '%s a remboursé %s à %s',
            UserPresenter::public($from)['displayName'], self::euros($settlement->getAmountCents()), UserPresenter::public($to)['displayName'],
        ));
        $this->em->flush();

        return $this->json($this->view($trip), 201);
    }

    #[Route('/settlements/{id}', name: 'settlement_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function deleteSettlement(int $tripId, int $id): JsonResponse
    {
        $me = $this->me();
        $trip = $this->access->findVisible($tripId, $me);
        $settlement = $trip ? $this->em->getRepository(Settlement::class)->findOneBy(['id' => $id, 'trip' => $trip]) : null;
        if (!$settlement) return $this->json(['message' => 'Remboursement introuvable.'], 404);
        if ($settlement->getCreatedBy()?->getId() !== $me->getId() && !$this->access->canManage($trip, $me)) {
            return $this->forbidden('Seuls son auteur et l\'organisateur peuvent annuler ce remboursement.');
        }

        $this->em->remove($settlement);
        $this->em->flush();

        return $this->json($this->view($trip));
    }

    /* ── Helpers ──────────────────────────────── */

    private function applyExpense(Expense $e, Trip $trip, array $data): ?JsonResponse
    {
        if (array_key_exists('label', $data))    $e->setLabel(trim((string) $data['label']));
        if (array_key_exists('amount', $data))   $e->setAmountCents($this->parseAmountCents($data['amount']));
        if (array_key_exists('category', $data)) $e->setCategory((string) $data['category']);

        if (array_key_exists('paidById', $data)) {
            $payer = $this->participantById($trip, $data['paidById']);
            if (!$payer) return $this->json(['message' => 'La personne qui a payé doit participer au voyage.'], 422);
            $e->setPaidBy($payer);
        }
        if (array_key_exists('participantIds', $data)) {
            if (!is_array($data['participantIds'])) return $this->json(['message' => 'Liste de participants invalide.'], 400);
            $users = [];
            foreach ($data['participantIds'] as $uid) {
                $u = $this->participantById($trip, $uid);
                if (!$u) return $this->json(['message' => 'Chaque personne doit participer au voyage.'], 422);
                $users[] = $u;
            }
            $e->setParticipants($users);
        }
        return null;
    }

    private function participantById(Trip $trip, mixed $id): ?User
    {
        $id = $this->parseInt($id, 'participant');
        foreach ($this->access->participants($trip) as $u) {
            if ($u->getId() === $id) return $u;
        }
        return null;
    }

    private function canEditExpense(Trip $trip, Expense $e): bool
    {
        $me = $this->me();
        return in_array($me->getId(), [$e->getCreatedBy()?->getId(), $e->getPaidBy()->getId()], true)
            || $this->access->canManage($trip, $me);
    }

    /** @return array{0: ?Trip, 1: ?Expense} */
    private function loadExpense(int $tripId, int $id): array
    {
        $trip = $this->access->findVisible($tripId, $this->me());
        $expense = $trip ? $this->em->getRepository(Expense::class)->findOneBy(['id' => $id, 'trip' => $trip]) : null;
        return [$trip, $expense];
    }

    /** Vue complète : résumé, dépenses, remboursements, soldes, virements à faire */
    private function view(Trip $trip): array
    {
        $me = $this->me();
        $expenses    = $this->em->getRepository(Expense::class)->findBy(['trip' => $trip], ['createdAt' => 'DESC', 'id' => 'DESC']);
        $settlements = $this->em->getRepository(Settlement::class)->findBy(['trip' => $trip], ['createdAt' => 'DESC', 'id' => 'DESC']);
        $participants = $this->access->participants($trip);
        $result = $this->calculator->compute($expenses, $settlements, $participants);

        $spent = array_sum(array_map(fn (Expense $e) => $e->getAmountCents(), $expenses));
        $byCategory = array_fill_keys(Expense::CATEGORIES, 0);
        foreach ($expenses as $e) $byCategory[$e->getCategory()] += $e->getAmountCents();
        $budgetCents = $trip->getBudget() !== null ? $trip->getBudget() * 100 : null;
        $count = max(1, count($participants));
        $canManage = $this->access->canManage($trip, $me);

        $person = fn (User $u) => UserPresenter::public($u);

        return [
            'summary' => [
                'budget'     => self::money($budgetCents),
                'spent'      => self::money($spent),
                'remaining'  => $budgetCents !== null ? self::money($budgetCents - $spent) : null,
                'perPerson'  => self::money((int) round($spent / $count)),
                'byCategory' => array_map(fn (int $c) => self::money($c), $byCategory),
                'participantsCount' => count($participants),
            ],
            'expenses' => array_map(fn (Expense $e) => [
                'id'        => $e->getId(),
                'label'     => $e->getLabel(),
                'amount'    => self::money($e->getAmountCents()),
                'category'  => $e->getCategory(),
                'paidBy'    => $person($e->getPaidBy()),
                'participantIds' => array_values(array_map(fn (User $u) => $u->getId(), $e->getParticipants()->toArray())),
                'createdAt' => $e->getCreatedAt()->format(\DateTimeInterface::ATOM),
                'canEdit'   => in_array($me->getId(), [$e->getCreatedBy()?->getId(), $e->getPaidBy()->getId()], true) || $canManage,
            ], $expenses),
            'settlements' => array_map(fn (Settlement $s) => [
                'id'        => $s->getId(),
                'from'      => $person($s->getFromUser()),
                'to'        => $person($s->getToUser()),
                'amount'    => self::money($s->getAmountCents()),
                'createdAt' => $s->getCreatedAt()->format(\DateTimeInterface::ATOM),
                'canDelete' => $s->getCreatedBy()?->getId() === $me->getId() || $canManage,
            ], $settlements),
            'balances' => array_values(array_map(fn (array $r) => [
                'user'    => $person($r['user']),
                'paid'    => self::money($r['paid']),
                'share'   => self::money($r['share']),
                'balance' => self::money($r['balance']),
                'settled' => $r['balance'] >= 0,
            ], $result['balances'])),
            'transfers' => array_map(fn (array $t) => [
                'from'   => $person($t['from']),
                'to'     => $person($t['to']),
                'amount' => self::money($t['amount']),
            ], $result['transfers']),
        ];
    }

    /** Centimes → euros (2 décimales) pour l'API */
    private static function money(?int $cents): ?float
    {
        return $cents === null ? null : round($cents / 100, 2);
    }

    private static function euros(int $cents): string
    {
        return number_format($cents / 100, $cents % 100 ? 2 : 0, ',', ' ') . ' €';
    }

    private function me(): User
    {
        /** @var User $me */
        $me = $this->getUser();
        return $me;
    }

    private function notFound(): JsonResponse
    {
        return $this->json(['message' => 'Voyage introuvable.'], 404);
    }

    private function forbidden(string $message): JsonResponse
    {
        return $this->json(['message' => $message], 403);
    }
}
