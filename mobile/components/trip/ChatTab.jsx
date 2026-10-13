import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import client from '../../api/client';
import BottomSheet, { SheetLabel } from '../BottomSheet';
import UserAvatar from '../UserAvatar';
import { Colors } from '../../constants/Colors';

/** Interrogation du serveur (pas de connexion permanente) et signal « en train d'écrire » */
const POLL_MS = 4000;
const TYPING_EVERY_MS = 3000;

const dayKey = (iso) => iso.slice(0, 10);
const hm = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * Onglet Chat (maquette 25) : messages des participants, événements du voyage (remboursements,
 * dépenses, votes) et sondages. Mise à jour toutes les 4 secondes.
 */
export default function ChatTab({ trip, bottomInset = 0 }) {
  const [messages, setMessages] = useState(null);
  const [typing,   setTyping]   = useState([]);
  const [text,     setText]     = useState('');
  const [sending,  setSending]  = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const lastId = useRef(0);
  const lastTyping = useRef(0);
  const scrollRef = useRef(null);
  const url = `/api/trips/${trip.id}/messages`;

  /** Ajoute les nouveaux messages et met à jour les sondages déjà affichés */
  const merge = useCallback((incoming = [], polls = []) => {
    setMessages(prev => {
      const byId = new Map((prev ?? []).map(m => [m.id, m]));
      for (const m of incoming) byId.set(m.id, m);
      for (const p of polls) if (byId.has(p.id)) byId.set(p.id, p);
      const list = [...byId.values()].sort((a, b) => a.id - b.id);
      if (list.length) lastId.current = list[list.length - 1].id;
      return list;
    });
  }, []);

  useEffect(() => {
    let alive = true;
    const fetchNew = () => client.get(url, { params: lastId.current ? { after: lastId.current } : {} })
      .then(({ data }) => { if (alive) { merge(data.messages, data.polls); setTyping(data.typing ?? []); } })
      .catch(() => { if (alive) setMessages(m => m ?? []); });
    fetchNew();
    const id = setInterval(fetchNew, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [url, merge]);

  const onChangeText = (value) => {
    setText(value);
    if (value && Date.now() - lastTyping.current > TYPING_EVERY_MS) {
      lastTyping.current = Date.now();
      client.post(`/api/trips/${trip.id}/typing`).catch(() => {});
    }
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const { data } = await client.post(url, { body });
      merge([data]);
      setText('');
      lastTyping.current = 0;
    } catch (err) {
      Alert.alert('Message', err.response?.data?.message || "Impossible d'envoyer le message.");
    } finally { setSending(false); }
  };

  const answerPoll = async (message, option) => {
    try {
      const { data } = await client.post(`${url}/${message.id}/poll`, { option });
      merge([data]);
    } catch (err) { Alert.alert('Sondage', err.response?.data?.message || 'Impossible de répondre.'); }
  };

  const createPoll = async (poll) => {
    const { data } = await client.post(url, { poll });
    merge([data]);
    setPollOpen(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={s.list}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
      >
        {messages === null && <ActivityIndicator color={Colors.parme} style={{ marginTop: 30 }} />}
        {messages?.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="chatbubbles-outline" size={36} color={Colors.orchidee} />
            <Text style={s.emptyText}>Lancez la conversation avec les participants du voyage.</Text>
          </View>
        )}
        {(messages ?? []).map((m, i) => {
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
          // Série de messages d'une même personne : nom au début, photo à la fin
          const sameAuthor = (a, b) => a && b && a.type !== 'system' && b.type !== 'system' && a.author?.id === b.author?.id && dayKey(a.createdAt) === dayKey(b.createdAt);
          return (
            <View key={m.id}>
              {newDay && (
                <View style={s.dayRow}>
                  <View style={s.dayLine} /><Text style={s.dayText}>{dayLabel(m.createdAt)}</Text><View style={s.dayLine} />
                </View>
              )}
              {m.type === 'system'
                ? <SystemEvent message={m} />
                : <Bubble message={m} first={!sameAuthor(prev, m) || newDay} last={!sameAuthor(m, next)} onAnswer={answerPoll} />}
            </View>
          );
        })}
        {typing.length > 0 && (
          <View style={s.typing}>
            <UserAvatar user={typing[0]} size={22} />
            <View style={s.dots}><Text style={s.dotsText}>•••</Text></View>
            <Text style={s.typingText}>
              {typing.map(u => u.firstName || u.displayName).join(', ')} {typing.length > 1 ? 'écrivent' : 'écrit'}...
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={[s.inputBar, { paddingBottom: bottomInset + 10 }]}>
        <TouchableOpacity style={s.plus} onPress={() => setPollOpen(true)} accessibilityLabel="Créer un sondage">
          <Ionicons name="add" size={22} color={Colors.parme} />
        </TouchableOpacity>
        <TextInput
          style={s.input} placeholder="Écrire un message..." placeholderTextColor={Colors.textMuted}
          value={text} onChangeText={onChangeText} multiline maxLength={2000}
        />
        <TouchableOpacity style={[s.send, (!text.trim() || sending) && { opacity: 0.5 }]} onPress={send} disabled={!text.trim() || sending} accessibilityLabel="Envoyer">
          <Ionicons name="send" size={16} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <PollSheet visible={pollOpen} onClose={() => setPollOpen(false)} onCreate={createPoll} />
    </KeyboardAvoidingView>
  );
}

function SystemEvent({ message }) {
  const icon = /rembours/i.test(message.body) ? 'cash-outline' : /vote|validée|retenue/i.test(message.body) ? 'thumbs-up-outline' : 'receipt-outline';
  return (
    <View style={s.system}>
      <Ionicons name={icon} size={13} color={Colors.parme} />
      <Text style={s.systemText}>{message.body}</Text>
    </View>
  );
}

function Bubble({ message: m, first, last, onAnswer }) {
  const mine = m.mine;
  return (
    <View style={[s.row, mine ? s.rowMine : s.rowOther, last && { marginBottom: 10 }]}>
      {!mine && <View style={s.avatarSlot}>{last && <UserAvatar user={m.author} size={30} />}</View>}
      <View style={[s.bubbleCol, mine && { alignItems: 'flex-end' }]}>
        {!mine && first && <Text style={s.author}>{m.author?.firstName || m.author?.displayName}</Text>}
        <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleOther, m.type === 'poll' && s.pollBubble]}>
          {m.type === 'poll'
            ? <Poll message={m} onAnswer={onAnswer} />
            : <Text style={[s.body, mine && { color: Colors.white }]}>{m.body}</Text>}
          <View style={s.metaRow}>
            <Text style={[s.time, mine && { color: 'rgba(255,255,255,0.7)' }]}>{hm(m.createdAt)}</Text>
            {mine && <Ionicons name="checkmark" size={12} color="rgba(255,255,255,0.7)" />}
          </View>
        </View>
      </View>
    </View>
  );
}

function Poll({ message: m, onAnswer }) {
  const { poll } = m;
  const mine = m.mine;
  const ink = mine ? Colors.white : Colors.text;
  const max = Math.max(1, ...poll.options.map(o => o.votes));
  return (
    <View>
      <Text style={[s.pollTopic, { color: mine ? 'rgba(255,255,255,0.7)' : Colors.textMuted }]}>
        SONDAGE{poll.topic ? ` · ${poll.topic.toUpperCase()}` : ''}
      </Text>
      <Text style={[s.pollQuestion, { color: ink }]}>{m.body}</Text>
      {poll.options.map((o, i) => {
        const chosen = poll.myOption === i;
        return (
          <TouchableOpacity key={i} style={s.option} onPress={() => onAnswer(m, i)} activeOpacity={0.8}>
            <View style={s.optionRow}>
              <Text style={[s.optionLabel, { color: ink }, chosen && { fontFamily: 'BricolageGrotesque_700Bold' }]} numberOfLines={1}>
                {chosen ? '✓ ' : ''}{o.label}
              </Text>
              <Text style={[s.optionVotes, { color: ink }]}>{o.votes} vote{o.votes > 1 ? 's' : ''}</Text>
            </View>
            <View style={[s.optionTrack, { backgroundColor: mine ? 'rgba(255,255,255,0.25)' : '#efe6e9' }]}>
              <View style={[s.optionFill, { width: `${(o.votes / max) * 100}%`, backgroundColor: mine ? Colors.white : Colors.parme }]} />
            </View>
          </TouchableOpacity>
        );
      })}
      <Text style={[s.pollFooter, { color: mine ? 'rgba(255,255,255,0.7)' : Colors.textMuted }]}>
        {poll.total} vote{poll.total > 1 ? 's' : ''} sur {poll.participantsCount}
      </Text>
    </View>
  );
}

/** Création d'un sondage : thème facultatif, question, 2 à 6 réponses */
function PollSheet({ visible, onClose, onCreate }) {
  const [topic, setTopic] = useState('');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) { setTopic(''); setQuestion(''); setOptions(['', '']); } }, [visible]);

  const filled = options.map(o => o.trim()).filter(Boolean);
  const ready = question.trim() && filled.length >= 2;

  const submit = async () => {
    setSaving(true);
    try { await onCreate({ topic: topic.trim() || null, question: question.trim(), options: filled }); }
    catch (err) { Alert.alert('Sondage', err.response?.data?.message || 'Impossible de créer le sondage.'); }
    finally { setSaving(false); }
  };

  return (
    <BottomSheet visible={visible} title="Nouveau sondage" onClose={onClose} footer={(
      <TouchableOpacity style={[s.pollSubmit, (!ready || saving) && { opacity: 0.5 }]} onPress={submit} disabled={!ready || saving}>
        <Text style={s.pollSubmitText}>{saving ? 'Envoi...' : 'Envoyer le sondage'}</Text>
      </TouchableOpacity>
    )}>
      <SheetLabel style={{ marginTop: 4 }}>Thème (facultatif)</SheetLabel>
      <TextInput style={s.field} placeholder="Logement" placeholderTextColor="#b9aeb5" value={topic} onChangeText={setTopic} maxLength={40} />
      <SheetLabel>Question</SheetLabel>
      <TextInput style={s.field} placeholder="Airbnb ou Booking ?" placeholderTextColor="#b9aeb5" value={question} onChangeText={setQuestion} maxLength={200} />
      <SheetLabel>Réponses</SheetLabel>
      <View style={{ gap: 8 }}>
        {options.map((o, i) => (
          <TextInput key={i} style={s.field} placeholder={`Réponse ${i + 1}`} placeholderTextColor="#b9aeb5" maxLength={80}
            value={o} onChangeText={(v) => setOptions(list => list.map((x, j) => (j === i ? v : x)))} />
        ))}
      </View>
      {options.length < 6 && (
        <TouchableOpacity style={s.addOption} onPress={() => setOptions(list => [...list, ''])}>
          <Ionicons name="add" size={16} color={Colors.parme} />
          <Text style={s.addOptionText}>Ajouter une réponse</Text>
        </TouchableOpacity>
      )}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  list: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 12 },
  empty: { alignItems: 'center', backgroundColor: Colors.white, borderRadius: 16, padding: 22, marginTop: 10 },
  emptyText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginTop: 8 },

  dayRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  dayLine: { flex: 1, height: 1, backgroundColor: '#e3d6dd' },
  dayText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, textTransform: 'capitalize' },

  system: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', maxWidth: '90%',
    backgroundColor: '#efe6e9', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 10,
  },
  systemText: { flexShrink: 1, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.text, textAlign: 'center' },

  row:      { flexDirection: 'row', marginBottom: 4 },
  rowMine:  { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  avatarSlot: { width: 30, marginRight: 8, justifyContent: 'flex-end' },
  bubbleCol: { maxWidth: '78%' },
  author: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: Colors.textMuted, marginBottom: 3, marginLeft: 4 },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMine:  { backgroundColor: Colors.parme, borderBottomRightRadius: 6 },
  bubbleOther: { backgroundColor: Colors.white, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: '#efe6e9' },
  pollBubble: { minWidth: 230 },
  body: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, lineHeight: 19, color: Colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 3 },
  time: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 10, color: Colors.textMuted },

  pollTopic:    { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 10, letterSpacing: 0.4 },
  pollQuestion: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 15, marginTop: 3, marginBottom: 8 },
  option:      { marginBottom: 8 },
  optionRow:   { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  optionLabel: { flex: 1, fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13 },
  optionVotes: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11 },
  optionTrack: { height: 4, borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  optionFill:  { height: 4, borderRadius: 2 },
  pollFooter:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, marginTop: 2 },

  typing: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  dots:   { backgroundColor: Colors.white, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 2, borderWidth: 1, borderColor: '#efe6e9' },
  dotsText: { fontSize: 14, color: Colors.textMuted, letterSpacing: 1 },
  typingText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 14, paddingTop: 10,
    backgroundColor: Colors.sableLune, borderTopWidth: 1, borderTopColor: '#efe6e9',
  },
  plus: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#efe6e9' },
  input: {
    flex: 1, maxHeight: 110, backgroundColor: Colors.white, borderRadius: 20, borderWidth: 1, borderColor: '#efe6e9',
    paddingHorizontal: 14, paddingTop: 9, paddingBottom: 9, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text,
  },
  send: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.parme, alignItems: 'center', justifyContent: 'center' },

  field: {
    backgroundColor: Colors.white, borderRadius: 100, borderWidth: 1, borderColor: '#ece3e7',
    paddingHorizontal: 18, paddingVertical: 12, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text,
  },
  addOption: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start' },
  addOptionText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.parme },
  pollSubmit: { backgroundColor: Colors.parme, borderRadius: 100, height: 50, alignItems: 'center', justifyContent: 'center' },
  pollSubmitText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.white },
});
