import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import UserAvatar from '../UserAvatar';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client, { assetUrl } from '../../api/client';
import { Colors } from '../../constants/Colors';
import { categoryOf } from '../../constants/PlaceCategories';

const STATUS = {
  open:      { label: 'En cours', bg: Colors.sableOr,  color: Colors.parme },
  validated: { label: 'Validée',  bg: '#dcefdc',       color: '#2f7a3a' },
  rejected:  { label: 'Refusée',  bg: '#ece3e7',       color: Colors.textMuted },
};

const utc = (iso) => new Date(`${iso}T00:00:00Z`);
const shortDate = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const weekday = (iso) => utc(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC', weekday: 'short' });
const capitalize = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Onglet Votes (maquettes 24 et 24b) : activités proposées au groupe, « Je participe » / « Pas pour moi ».
 * Une activité validée rejoint le planning.
 */
export default function VotesTab({ trip, refreshKey, onPropose, onProposeManual, onChanged }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    client.get(`/api/trips/${trip.id}/votes`).then(({ data: d }) => setData(d)).catch(() => setData({ summary: {}, votes: [] }));
  }, [trip.id]);

  useEffect(() => { load(); }, [load, refreshKey]);
  // Retour de la carte après une proposition : la liste se met à jour
  useFocusEffect(load);

  const vote = async (item, participates) => {
    setBusy(item.id);
    try {
      const { data: d } = await client.post(`/api/trips/${trip.id}/votes/${item.id}`, { participates });
      setData(d);
      // Validée : le planning change
      if (d.votes.find(v => v.id === item.id)?.status !== 'open') onChanged?.();
    } catch (err) {
      Alert.alert('Vote', err.response?.data?.message || "Impossible d'enregistrer le vote.");
      load();
    } finally { setBusy(null); }
  };

  const remove = (item) => Alert.alert('Retirer la proposition ?', item.title, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Retirer', style: 'destructive', onPress: async () => {
      try { const { data: d } = await client.delete(`/api/trips/${trip.id}/votes/${item.id}`); setData(d); }
      catch (err) { Alert.alert('Erreur', err.response?.data?.message || 'Impossible de retirer la proposition.'); }
    } },
  ]);

  if (!data) return <ActivityIndicator color={Colors.parme} style={{ marginTop: 30 }} />;
  const { summary, votes } = data;

  return (
    <View style={{ marginTop: 4 }}>
      {votes.length > 0 && (
        <View style={s.summary}>
          <Text style={s.summaryText}>
            {summary.open} vote{summary.open > 1 ? 's' : ''} en cours · {summary.validated} validé{summary.validated > 1 ? 's' : ''}
          </Text>
          {summary.closesOn && <Text style={s.closes}>Clôture le {shortDate(summary.closesOn)}</Text>}
        </View>
      )}

      {votes.length === 0 && (
        <View style={s.empty}>
          <Ionicons name="thumbs-up-outline" size={36} color={Colors.orchidee} />
          <Text style={s.emptyTitle}>Aucune proposition</Text>
          <Text style={s.emptyText}>Proposez une activité au groupe : elle rejoint le planning dès que la majorité participe.</Text>
        </View>
      )}

      {votes.map(v => <VoteCard key={v.id} item={v} busy={busy === v.id} onVote={(p) => vote(v, p)} onRemove={() => remove(v)} />)}

      {/* Proposer depuis la carte de la destination, ou une activité sans lieu */}
      <TouchableOpacity style={s.propose} onPress={onPropose} activeOpacity={0.85}>
        <Ionicons name="map-outline" size={18} color={Colors.parme} />
        <Text style={s.proposeText}>Proposer une activité</Text>
      </TouchableOpacity>
      {onProposeManual && (
        <TouchableOpacity style={s.manual} onPress={onProposeManual} hitSlop={8}>
          <Text style={s.manualText}>ou proposer une activité sans lieu</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function VoteCard({ item: v, busy, onVote, onRemove }) {
  const cat = categoryOf({ tags: v.category ? [v.category] : [] });
  const status = STATUS[v.status] ?? STATUS.open;
  const open = v.status === 'open';
  const progress = v.participantsCount ? Math.min(1, v.votesCount / v.participantsCount) : 0;
  const meta = [`${capitalize(weekday(v.date))} ${shortDate(v.date)}`, v.time, v.price != null ? `${v.price} €/pers` : null].filter(Boolean).join(' · ');

  return (
    <View style={s.card}>
      {v.place?.photo
        ? <Image source={{ uri: assetUrl(v.place.photo) }} style={s.photo} resizeMode="cover" />
        : <View style={[s.photo, s.photoEmpty, { backgroundColor: cat.color }]}><Ionicons name={cat.icon} size={40} color="rgba(255,255,255,0.9)" /></View>}

      <View style={s.body}>
        <View style={s.titleRow}>
          <Text style={s.title} numberOfLines={2}>{v.title}</Text>
          <Text style={[s.status, { backgroundColor: status.bg, color: status.color }]}>{status.label}</Text>
        </View>
        <Text style={s.meta}>{meta}</Text>

        <View style={s.scoreRow}>
          <Stars value={v.rating ?? 0} />
          <Text style={s.score}>
            {v.rating != null ? `${String(v.rating).replace('.', ',')}/5 · ` : ''}{v.votesCount} vote{v.votesCount > 1 ? 's' : ''} sur {v.participantsCount}
          </Text>
        </View>
        <View style={s.track}>
          <View style={[s.fill, { width: `${progress * 100}%` }, v.status === 'validated' && { backgroundColor: '#2f9e5b' }]} />
        </View>

        {open && (
          <View style={s.buttons}>
            {v.myVote === 'yes' ? (
              <View style={[s.btn, s.btnChosen]}>
                <Ionicons name="checkmark" size={15} color={Colors.parme} />
                <Text style={s.btnChosenText}>Vous participez</Text>
              </View>
            ) : (
              <TouchableOpacity style={[s.btn, s.btnYes]} onPress={() => onVote(true)} disabled={busy} activeOpacity={0.85}>
                <Ionicons name="thumbs-up" size={14} color={Colors.white} />
                <Text style={s.btnYesText}>Je participe</Text>
              </TouchableOpacity>
            )}
            {v.myVote === 'no' ? (
              <View style={[s.btn, s.btnChosen]}>
                <Ionicons name="close" size={15} color={Colors.parme} />
                <Text style={s.btnChosenText}>Pas pour vous</Text>
              </View>
            ) : (
              <TouchableOpacity style={[s.btn, s.btnNo]} onPress={() => onVote(false)} disabled={busy} activeOpacity={0.85}>
                <Text style={s.btnNoText}>Pas pour moi</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {open && v.myVote && <Text style={s.change}>Touche l'autre choix pour changer d'avis.</Text>}

        {/* Qui a voté quoi */}
        <Voters icon="thumbs-up" label="Participent" people={v.voters?.yes ?? []} />
        <Voters icon="close" label="Pas pour eux" people={v.voters?.no ?? []} />

        <View style={s.footer}>
          {v.proposedBy && <Text style={s.by}>Proposé par {v.proposedBy.firstName || v.proposedBy.displayName}</Text>}
          {v.canDelete && (
            <TouchableOpacity onPress={onRemove} hitSlop={8} accessibilityLabel="Retirer la proposition">
              <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

function Voters({ icon, label, people }) {
  if (!people.length) return null;
  return (
    <View style={s.voters}>
      <Ionicons name={icon} size={13} color={Colors.parme} />
      <Text style={s.votersLabel}>{label}</Text>
      <View style={s.faces}>
        {people.slice(0, 5).map((p, i) => <UserAvatar key={p.id} user={p} size={22} style={[s.face, i > 0 && { marginLeft: -6 }]} />)}
      </View>
      <Text style={s.votersNames} numberOfLines={1}>{people.map(p => p.firstName || p.displayName).join(', ')}</Text>
    </View>
  );
}

function Stars({ value }) {
  const full = Math.round(value);
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => <Ionicons key={i} name="star" size={13} color={i <= full ? Colors.parme : '#d9cfd4'} />)}
    </View>
  );
}

const s = StyleSheet.create({
  summary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    backgroundColor: '#efe6e9', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14,
  },
  summaryText: { flex: 1, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.text },
  closes: {
    fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: Colors.parme,
    backgroundColor: Colors.sableOr, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden',
  },

  card:  { backgroundColor: Colors.white, borderRadius: 18, padding: 8, marginBottom: 14, borderWidth: 1, borderColor: '#efe6e9' },
  photo: { width: '100%', height: 130, borderRadius: 12 },
  photoEmpty: { alignItems: 'center', justifyContent: 'center' },
  body:  { paddingHorizontal: 6, paddingTop: 10, paddingBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.text },
  status: {
    fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11,
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden',
  },
  meta:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, marginTop: 3 },

  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  score: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.text },
  track: { height: 5, borderRadius: 3, backgroundColor: '#efe6e9', marginTop: 6, overflow: 'hidden' },
  fill:  { height: 5, borderRadius: 3, backgroundColor: Colors.parme },

  buttons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { flex: 1, height: 38, borderRadius: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnYes: { backgroundColor: Colors.parme },
  btnYesText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.white },
  btnNo: { backgroundColor: '#efe6e9' },
  btnNoText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text },
  btnChosen: { borderWidth: 1.5, borderColor: Colors.parme, backgroundColor: Colors.white },
  btnChosenText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.parme },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  by: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted },

  empty: { alignItems: 'center', backgroundColor: Colors.white, borderRadius: 16, padding: 22, marginBottom: 14 },
  emptyTitle: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 16, color: Colors.text, marginTop: 8 },
  emptyText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 19, marginTop: 4 },

  propose: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.parme, borderRadius: 100, paddingVertical: 12,
  },
  proposeText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.parme },
  manual: { alignSelf: 'center', marginTop: 10 },
  manualText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.parme, textDecorationLine: 'underline' },
  change: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 6 },
  voters: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  votersLabel: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: Colors.parme },
  faces: { flexDirection: 'row' },
  face: { borderWidth: 1.5, borderColor: Colors.white },
  votersNames: { flex: 1, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.text },
});
