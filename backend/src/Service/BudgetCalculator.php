<?php

namespace App\Service;

use App\Entity\Expense;
use App\Entity\Settlement;
use App\Entity\User;

/**
 * Comptes d'un voyage (étape 4), en centimes :
 * - part de chacun = Σ(dépenses partagées avec lui) / nb de personnes de chaque dépense ;
 * - solde = payé − part + remboursements versés − remboursements reçus
 *   (solde > 0 : les autres lui doivent de l'argent ; < 0 : il doit de l'argent) ;
 * - virements à faire = nombre minimal de remboursements pour tout équilibrer.
 */
final class BudgetCalculator
{
    /**
     * @param Expense[]    $expenses
     * @param Settlement[] $settlements
     * @param User[]       $participants participants actuels (affichés même sans dépense)
     * @param array<int, int> $weights    nombre de personnes par participant (lui + rattachés) ; 1 par défaut
     * @return array{balances: array<int, array{user: User, paid: int, share: int, balance: int}>, transfers: list<array{from: User, to: User, amount: int}>}
     */
    public function compute(array $expenses, array $settlements, array $participants, array $weights = []): array
    {
        $rows = [];
        $row = function (User $u) use (&$rows): void {
            $rows[$u->getId()] ??= ['user' => $u, 'paid' => 0, 'share' => 0, 'balance' => 0];
        };
        foreach ($participants as $u) $row($u);

        foreach ($expenses as $e) {
            $row($e->getPaidBy());
            $rows[$e->getPaidBy()->getId()]['paid'] += $e->getAmountCents();

            // Parts par personne : un participant avec 2 enfants rattachés paie 3 parts.
            // Les centimes restants vont aux premiers participants (dans l'ordre des id)
            $people = $e->getParticipants()->toArray();
            usort($people, fn (User $a, User $b) => $a->getId() <=> $b->getId());
            $total = array_sum(array_map(fn (User $u) => max(1, $weights[$u->getId()] ?? 1), $people));
            if ($total === 0) continue;
            $given = 0;
            $shares = [];
            foreach ($people as $u) {
                $shares[$u->getId()] = intdiv($e->getAmountCents() * max(1, $weights[$u->getId()] ?? 1), $total);
                $given += $shares[$u->getId()];
            }
            $rest = $e->getAmountCents() - $given;
            foreach ($people as $i => $u) {
                $row($u);
                $rows[$u->getId()]['share'] += $shares[$u->getId()] + ($i < $rest ? 1 : 0);
            }
        }

        foreach ($settlements as $s) {
            $row($s->getFromUser());
            $row($s->getToUser());
            $rows[$s->getFromUser()->getId()]['balance'] += $s->getAmountCents();
            $rows[$s->getToUser()->getId()]['balance']   -= $s->getAmountCents();
        }

        foreach ($rows as &$r) {
            $r['balance'] += $r['paid'] - $r['share'];
        }
        unset($r);

        return ['balances' => $rows, 'transfers' => $this->transfers($rows)];
    }

    /** Appariement glouton des débiteurs et créanciers (au plus n−1 virements) */
    private function transfers(array $rows): array
    {
        $debtors = $creditors = [];
        foreach ($rows as $r) {
            if ($r['balance'] < 0) $debtors[]   = ['user' => $r['user'], 'amount' => -$r['balance']];
            if ($r['balance'] > 0) $creditors[] = ['user' => $r['user'], 'amount' => $r['balance']];
        }
        usort($debtors, fn ($a, $b) => $b['amount'] <=> $a['amount']);
        usort($creditors, fn ($a, $b) => $b['amount'] <=> $a['amount']);

        $transfers = [];
        $i = $j = 0;
        while ($i < count($debtors) && $j < count($creditors)) {
            $amount = min($debtors[$i]['amount'], $creditors[$j]['amount']);
            $transfers[] = ['from' => $debtors[$i]['user'], 'to' => $creditors[$j]['user'], 'amount' => $amount];
            $debtors[$i]['amount']   -= $amount;
            $creditors[$j]['amount'] -= $amount;
            if ($debtors[$i]['amount'] === 0) $i++;
            if ($creditors[$j]['amount'] === 0) $j++;
        }
        return $transfers;
    }
}
