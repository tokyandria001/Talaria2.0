import { useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import BottomSheet, { Chip, SheetLabel } from '../BottomSheet';
import UserAvatar from '../UserAvatar';
import { Colors } from '../../constants/Colors';

export const EXPENSE_CATEGORIES = [
  { value: 'transport', label: 'Transport', color: '#4f203f' },
  { value: 'logement',  label: 'Logement',  color: '#7c5cdb' },
  { value: 'activite',  label: 'Activités', color: '#1fa2c4' },
  { value: 'repas',     label: 'Repas',     color: '#f2762e' },
  { value: 'autre',     label: 'Autre',     color: '#9a8a93' },
];
const catLabel = (v) => EXPENSE_CATEGORIES.find(c => c.value === v)?.label ?? 'Autre';
const eur = (n, signed = false) => {
  const v = Math.round((n ?? 0) * 100) / 100;
  const txt = `${Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;
  return signed ? `${v > 0 ? '+ ' : v < 0 ? '− ' : ''}${txt}` : (v < 0 ? `− ${txt}` : txt);
};

/** Onglet Budget du voyage (maquettes « Budget » et 15) : dépenses, part de chacun, qui doit quoi */
export default function BudgetTab({ trip }) {
  const { user } = useAuth();
  const [data, setData]       = useState(null);
  const [expense, setExpense] = useState(null);   // dépense en cours d'édition ({} = nouvelle)
  const [settle, setSettle]   = useState(false);

  const load = useCallback(() => client.get(`/api/trips/${trip.id}/budget`)
    .then(({ data: d }) => setData(d))
    .catch(() => setData(null)), [trip.id]);

  useEffect(() => { load(); }, [load]);

  if (!data) return <ActivityIndicator color={Colors.parme} style={{ marginTop: 30 }} />;

  const { summary, expenses, balances, transfers, settlements } = data;
  const budget = summary.budget;
  const ratio = budget ? Math.min(1, summary.spent / budget) : 0;
  const maxCat = Math.max(1, ...Object.values(summary.byCategory));
  const name = (u) => (u.id === user?.id ? 'Moi' : u.firstName || u.displayName);

  return (
    <>
      {/* Chiffres clés */}
      <View style={s.hero}>
        <View style={s.heroRow}>
          <Stat value={budget != null ? eur(budget) : '—'} label={summary.budgetSource === 'personal' ? 'Budgets cumulés' : 'Budget total'} />
          <Stat value={eur(summary.spent)} label="Dépensé" />
          <Stat value={eur(summary.perPerson)} label="Par personne" />
        </View>
        {budget != null && (
          <>
            <View style={s.progress}><View style={[s.progressFill, { width: `${ratio * 100}%` }, summary.remaining < 0 && { backgroundColor: '#ff8a8a' }]} /></View>
            <View style={s.heroRow}>
              <Text style={s.heroSmall}>{eur(summary.spent)} dépensés</Text>
              <Text style={s.heroSmall}>{summary.remaining < 0 ? `Dépassement ${eur(-summary.remaining)}` : `${eur(summary.remaining)} restants`}</Text>
            </View>
          </>
        )}
      </View>

      {/* Ma part : budget personnel, dépenses qui me reviennent, activités prévues */}
      {summary.me && (
        <View style={s.meCard}>
          <View style={s.rowBetween}>
            <Text style={s.meTitle}>Ma part{summary.me.heads > 1 ? ` · ${summary.me.heads} personnes` : ''}</Text>
            {summary.me.budget != null && (
              <Text style={[s.meRemaining, summary.me.remaining < 0 && { color: '#dc2626' }]}>
                {summary.me.remaining < 0 ? `Dépassement ${eur(-summary.me.remaining)}` : `${eur(summary.me.remaining)} restants`}
              </Text>
            )}
          </View>
          <View style={s.meRow}>
            <MeStat value={summary.me.budget != null ? eur(summary.me.budget) : '—'} label="Mon budget" />
            <MeStat value={eur(summary.me.share)} label="Mes dépenses" />
            <MeStat value={eur(summary.me.planned)} label="Activités prévues" />
          </View>
          {summary.me.budget == null && <Text style={s.note}>Définis ton budget dans l'onglet Logistique.</Text>}
        </View>
      )}

      {/* Par catégorie */}
      {summary.spent > 0 && (
        <>
          <Text style={s.section}>Par catégorie</Text>
          <View style={{ gap: 10 }}>
            {EXPENSE_CATEGORIES.filter(c => summary.byCategory[c.value] > 0).map(c => (
              <View key={c.value}>
                <View style={s.rowBetween}>
                  <Text style={s.catLabel}>{c.label}</Text>
                  <Text style={s.catValue}>{eur(summary.byCategory[c.value])}</Text>
                </View>
                <View style={s.catBar}><View style={[s.catFill, { width: `${(summary.byCategory[c.value] / maxCat) * 100}%`, backgroundColor: c.color }]} /></View>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Dépenses */}
      <View style={s.rowBetween}>
        <Text style={s.section}>Dépenses</Text>
        <TouchableOpacity onPress={() => setExpense({})}><Text style={s.link}>+ Ajouter</Text></TouchableOpacity>
      </View>
      <View style={s.table}>
        <View style={[s.tr, s.th]}>
          <Text style={[s.thText, { flex: 1.4 }]}>Poste</Text>
          <Text style={[s.thText, { flex: 1 }]}>Payé par</Text>
          <Text style={[s.thText, { width: 70, textAlign: 'right' }]}>Montant</Text>
        </View>
        {expenses.length === 0 && <Text style={s.emptyRow}>Aucune dépense pour l'instant.</Text>}
        {expenses.map(e => (
          <TouchableOpacity key={e.id} style={s.tr} onPress={() => (e.canEdit ? setExpense(e) : null)} activeOpacity={e.canEdit ? 0.7 : 1}>
            <View style={{ flex: 1.4 }}>
              <Text style={s.tdTitle} numberOfLines={1}>{e.label}</Text>
              <Text style={s.tdSub}>{catLabel(e.category)}</Text>
            </View>
            <View style={[s.payer, { flex: 1 }]}>
              <UserAvatar user={e.paidBy} size={22} />
              <Text style={s.tdText} numberOfLines={1}>{name(e.paidBy)}</Text>
            </View>
            <Text style={[s.tdAmount, { width: 70 }]}>{eur(e.amount)}</Text>
          </TouchableOpacity>
        ))}
        <View style={[s.tr, s.total]}>
          <Text style={s.totalText}>Total dépensé</Text>
          <Text style={s.totalText}>{eur(summary.spent)}</Text>
        </View>
      </View>

      {/* Part de chacun */}
      {summary.participantsCount > 1 && (
        <>
          <Text style={s.section}>Part de chacun</Text>
          <View style={s.card}>
            {balances.map(b => (
              <View key={b.user.id} style={s.balanceRow}>
                <UserAvatar user={b.user} size={26} />
                <Text style={s.balanceName}>{name(b.user)}{b.heads > 1 ? ` (+${b.heads - 1})` : ''}</Text>
                <Text style={[s.balanceValue, { color: b.balance > 0.004 ? '#16a34a' : b.balance < -0.004 ? '#dc2626' : Colors.textMuted }]}>
                  {Math.abs(b.balance) < 0.005 ? 'À jour' : eur(b.balance, true)}
                </Text>
              </View>
            ))}
          </View>
          <Text style={s.note}>
            Part équitable : {eur(summary.perPerson)} par voyageur{summary.travelersCount > summary.participantsCount ? ', personnes rattachées comprises' : ''}. Les soldes positifs ont avancé plus que leur part.
          </Text>

          {/* Qui doit quoi ? */}
          <View style={s.rowBetween}>
            <Text style={s.section}>Qui doit quoi ?</Text>
            {transfers.length === 0 && expenses.length > 0 && <Text style={s.balanced}>Équilibré ✓</Text>}
          </View>
          {transfers.length === 0 ? (
            <Text style={s.note}>{expenses.length ? 'Tout le monde est à jour.' : 'Ajoutez des dépenses pour voir les remboursements.'}</Text>
          ) : (
            <View style={s.card}>
              {transfers.map((t, i) => {
                const meDebtor = t.from.id === user?.id;
                const meCreditor = t.to.id === user?.id;
                return (
                  <View key={i} style={s.balanceRow}>
                    <UserAvatar user={meDebtor ? t.to : t.from} size={30} />
                    <Text style={s.balanceName}>
                      {meDebtor ? `Tu dois à ${name(t.to)}` : meCreditor ? `${name(t.from)} te doit` : `${name(t.from)} doit à ${name(t.to)}`}
                    </Text>
                    <Text style={[s.balanceValue, { color: meDebtor ? '#dc2626' : meCreditor ? '#16a34a' : Colors.text }]}>
                      {meDebtor ? `− ${eur(t.amount)}` : meCreditor ? `+ ${eur(t.amount)}` : eur(t.amount)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
          {transfers.length > 0 && (
            <TouchableOpacity style={s.primary} onPress={() => setSettle(true)}>
              <Ionicons name="cash-outline" size={18} color={Colors.white} />
              <Text style={s.primaryText}>Régler les comptes</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {settlements.length > 0 && (
        <>
          <Text style={s.section}>Remboursements</Text>
          <View style={s.card}>
            {settlements.map(st => (
              <View key={st.id} style={s.balanceRow}>
                <Ionicons name="swap-horizontal" size={18} color={Colors.parme} />
                <Text style={s.balanceName}>{name(st.from)} → {name(st.to)}</Text>
                <Text style={s.balanceValue}>{eur(st.amount)}</Text>
                {st.canDelete && (
                  <TouchableOpacity hitSlop={8} onPress={() => Alert.alert('Annuler ce remboursement ?', '', [
                    { text: 'Non', style: 'cancel' },
                    { text: 'Annuler le remboursement', style: 'destructive', onPress: () => client.delete(`/api/trips/${trip.id}/settlements/${st.id}`).then(({ data: d }) => setData(d)) },
                  ])}>
                    <Ionicons name="close-circle-outline" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </>
      )}

      <ExpenseSheet visible={!!expense} trip={trip} initial={expense} me={user} onClose={() => setExpense(null)}
        onSaved={(d) => { setData(d); setExpense(null); }} />
      <SettleSheet visible={settle} trip={trip} transfers={transfers} me={user} name={name} onClose={() => setSettle(false)}
        onSaved={(d) => { setData(d); }} />
    </>
  );
}

/* ── Ajouter / modifier une dépense ───────── */
function ExpenseSheet({ visible, trip, initial, me, onClose, onSaved }) {
  const isEdit = !!initial?.id;
  const people = trip.participants;
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setForm({
      label: initial?.label ?? '',
      amount: initial?.amount != null ? String(initial.amount).replace('.', ',') : '',
      category: initial?.category ?? 'repas',
      paidById: initial?.paidBy?.id ?? me?.id,
      participantIds: initial?.participantIds ?? people.map(p => p.id),
    });
  }, [visible, initial, me, people]);

  const toggle = (id) => setForm(f => ({
    ...f, participantIds: f.participantIds.includes(id) ? f.participantIds.filter(x => x !== id) : [...f.participantIds, id],
  }));

  const save = async () => {
    setSaving(true);
    try {
      const { data } = isEdit
        ? await client.patch(`/api/trips/${trip.id}/expenses/${initial.id}`, form)
        : await client.post(`/api/trips/${trip.id}/expenses`, form);
      onSaved(data);
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || "Impossible d'enregistrer la dépense.");
    } finally { setSaving(false); }
  };

  const remove = () => Alert.alert('Supprimer cette dépense ?', initial.label, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Supprimer', style: 'destructive', onPress: async () => {
      try { onSaved((await client.delete(`/api/trips/${trip.id}/expenses/${initial.id}`)).data); }
      catch (err) { Alert.alert('Erreur', err.response?.data?.message || 'Suppression impossible.'); }
    } },
  ]);

  if (!form.participantIds) return null;
  const share = form.amount && form.participantIds.length
    ? (parseFloat(form.amount.replace(',', '.')) || 0) / form.participantIds.length : 0;

  return (
    <BottomSheet visible={visible} title={isEdit ? 'Modifier la dépense' : 'Nouvelle dépense'} onClose={onClose}
      footer={(
        <View style={{ gap: 10 }}>
          <TouchableOpacity style={[s.primary, { marginTop: 0 }, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            <Text style={s.primaryText}>{saving ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Ajouter la dépense'}</Text>
          </TouchableOpacity>
          {isEdit && <TouchableOpacity onPress={remove} style={{ alignItems: 'center' }}><Text style={s.delete}>Supprimer la dépense</Text></TouchableOpacity>}
        </View>
      )}>
      <SheetLabel style={{ marginTop: 4 }}>Poste</SheetLabel>
      <TextInput style={s.input} placeholder="Vols aller-retour, Airbnb, courses..." placeholderTextColor="#b9aeb5"
        value={form.label} onChangeText={(v) => setForm(f => ({ ...f, label: v }))} />

      <SheetLabel>Montant total (€)</SheetLabel>
      <TextInput style={s.input} placeholder="1 450" placeholderTextColor="#b9aeb5" keyboardType="decimal-pad"
        value={form.amount} onChangeText={(v) => setForm(f => ({ ...f, amount: v.replace(/[^0-9,.]/g, '') }))} />

      <SheetLabel>Catégorie</SheetLabel>
      <View style={s.chips}>
        {EXPENSE_CATEGORIES.map(c => <Chip key={c.value} label={c.label} active={form.category === c.value} onPress={() => setForm(f => ({ ...f, category: c.value }))} />)}
      </View>

      <SheetLabel>Payé par</SheetLabel>
      <View style={s.chips}>
        {people.map(p => <Chip key={p.id} label={p.id === me?.id ? 'Moi' : p.firstName || p.displayName} active={form.paidById === p.id} onPress={() => setForm(f => ({ ...f, paidById: p.id }))} />)}
      </View>

      {people.length > 1 && (
        <>
          <SheetLabel>Partagée entre</SheetLabel>
          <View style={s.chips}>
            {people.map(p => <Chip key={p.id} label={p.id === me?.id ? 'Moi' : p.firstName || p.displayName} active={form.participantIds.includes(p.id)} onPress={() => toggle(p.id)} />)}
          </View>
          {share > 0 && <Text style={s.note}>Soit {eur(share)} par personne.</Text>}
        </>
      )}
    </BottomSheet>
  );
}

/* ── Régler les comptes ───────────────────── */
function SettleSheet({ visible, trip, transfers, me, name, onClose, onSaved }) {
  const [busy, setBusy] = useState(null);

  const record = async (t, i) => {
    setBusy(i);
    try {
      const { data } = await client.post(`/api/trips/${trip.id}/settlements`, { fromId: t.from.id, toId: t.to.id, amount: t.amount });
      onSaved(data);
      if (!data.transfers.length) onClose();
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || "Impossible d'enregistrer le remboursement.");
    } finally { setBusy(null); }
  };

  const canRecord = (t) => t.from.id === me?.id || t.to.id === me?.id || trip.permissions?.canManage;

  return (
    <BottomSheet visible={visible} title="Régler les comptes" onClose={onClose}>
      <Text style={[s.note, { marginTop: 0 }]}>
        Une fois le virement fait (Lydia, virement, espèces...), marque-le comme remboursé : les comptes se mettent à jour pour tout le groupe.
      </Text>
      <View style={{ gap: 10, marginTop: 12, paddingBottom: 8 }}>
        {transfers.map((t, i) => (
          <View key={i} style={s.settleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.tdTitle}>{name(t.from)} → {name(t.to)}</Text>
              <Text style={s.tdSub}>{eur(t.amount)}</Text>
            </View>
            {canRecord(t) ? (
              <TouchableOpacity style={s.smallBtn} onPress={() => record(t, i)} disabled={busy !== null}>
                <Text style={s.smallBtnText}>{busy === i ? '...' : 'Marquer remboursé'}</Text>
              </TouchableOpacity>
            ) : <Text style={s.tdSub}>En attente</Text>}
          </View>
        ))}
      </View>
    </BottomSheet>
  );
}

const Stat = ({ value, label }) => (
  <View style={{ flex: 1, alignItems: 'center' }}>
    <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    <Text style={s.statLabel}>{label}</Text>
  </View>
);

const s = StyleSheet.create({
  meCard:    { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: '#efe6e9', padding: 14, marginTop: 12, gap: 10 },
  meTitle:   { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.text },
  meRemaining: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: '#16a34a' },
  meRow:     { flexDirection: 'row', justifyContent: 'space-between' },
  meValue:   { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 16, color: Colors.parme },
  meLabel:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  hero:      { backgroundColor: Colors.parme, borderRadius: 18, padding: 16, gap: 10 },
  heroRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  heroSmall: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  statValue: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 19, color: Colors.white },
  statLabel: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  progress:     { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.white, borderRadius: 3 },

  section:    { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 16, color: Colors.text, marginTop: 20, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link:       { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.parme, marginTop: 10 },
  note:       { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 8, lineHeight: 16 },
  balanced:   { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: '#16a34a', marginTop: 10 },

  catLabel: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.text },
  catValue: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text },
  catBar:   { height: 6, borderRadius: 3, backgroundColor: '#efe6e9', marginTop: 4, overflow: 'hidden' },
  catFill:  { height: '100%', borderRadius: 3 },

  table:   { backgroundColor: Colors.white, borderRadius: 16, overflow: 'hidden' },
  tr:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3ecef' },
  th:      { backgroundColor: '#faf6f8' },
  thText:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted },
  tdTitle: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text },
  tdSub:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted },
  tdText:  { flex: 1, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.text },
  tdAmount: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text, textAlign: 'right' },
  payer:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  emptyRow: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, textAlign: 'center', padding: 14 },
  total:     { backgroundColor: Colors.parme, justifyContent: 'space-between', borderBottomWidth: 0 },
  totalText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.white },

  card:         { backgroundColor: Colors.white, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  balanceRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  balanceName:  { flex: 1, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.text },
  balanceValue: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text },

  primary:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.parme, borderRadius: 100, paddingVertical: 14, marginTop: 14 },
  primaryText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.white },
  delete:      { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: '#dc2626' },

  input: {
    backgroundColor: Colors.white, borderRadius: 100, borderWidth: 1, borderColor: '#ece3e7',
    paddingHorizontal: 16, paddingVertical: 12, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  settleRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white, borderRadius: 14, padding: 12 },
  smallBtn:     { backgroundColor: Colors.parme, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 8 },
  smallBtnText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.white },
});

function MeStat({ value, label }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.meValue}>{value}</Text>
      <Text style={s.meLabel}>{label}</Text>
    </View>
  );
}
