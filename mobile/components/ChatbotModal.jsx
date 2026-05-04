import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  FlatList, Image, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

const MASCOT = require('../assets/Logo-09.png');

/* ── Base de réponses ─────────────────────────── */
const RESPONSES = [
  {
    keys: ['bonjour', 'salut', 'hello', 'coucou', 'hey', 'bonsoir'],
    reply: "Bonjour ! Je suis Tali, votre assistant voyage Talaria 🐦\nComment puis-je vous aider aujourd'hui ?",
  },
  {
    keys: ['merci', 'super', 'parfait', 'génial', 'cool', 'nickel', 'top'],
    reply: "Avec plaisir ! N'hésitez pas si vous avez d'autres questions. Bon voyage ! ✈️",
  },
  {
    keys: ['voyage', 'créer', 'nouveau voyage', 'planifier', 'trip'],
    reply: "Pour créer un voyage, allez dans l'onglet ✈️ Voyages puis appuyez sur « + Nouveau voyage ».\n\nVous pourrez renseigner :\n• Destination et ville de départ\n• Dates aller/retour\n• Nombre de voyageurs\n• Budget prévu\n• Moyen de transport",
  },
  {
    keys: ['budget', 'argent', 'coût', 'dépense', 'prix', 'combien'],
    reply: "Lors de la création d'un voyage, vous pouvez renseigner un budget global. Si vous voyagez en voiture, Talaria calcule automatiquement le coût du carburant (A/R) en fonction de la distance, du prix du carburant et de la consommation de votre véhicule. 💰",
  },
  {
    keys: ['voiture', 'essence', 'carburant', 'péage', 'km', 'kilomètre'],
    reply: "Pour un voyage en voiture, renseignez :\n• Distance aller (km)\n• Prix du carburant (€/L)\n• Consommation (L/100km)\n• Péages A/R (€)\n\nTalaria calcule ensuite le coût total automatiquement ⛽",
  },
  {
    keys: ['avion', 'vol', 'train', 'bus', 'transport'],
    reply: "Talaria prend en charge 4 modes de transport :\n✈️ Avion — 🚄 Train — 🚌 Bus — 🚗 Voiture\n\nPour les vols et trains, vous pouvez ajouter des liens vers Skyscanner, Booking ou d'autres services dans la section Réservations.",
  },
  {
    keys: ['réservation', 'booking', 'hôtel', 'airbnb', 'skyscanner', 'lien'],
    reply: "Dans l'étape Réservations d'un voyage, vous pouvez ajouter des liens vers :\n🏨 Hôtels (Booking, Airbnb)\n✈️ Vols (Skyscanner, Transavia)\n🎯 Activités\n\nChaque lien s'ouvre directement dans votre navigateur.",
  },
  {
    keys: ['location', 'louer', 'véhicule', 'voiture location'],
    reply: "Si vous avez besoin d'une voiture sur place, cochez « Location de véhicule sur place » dans l'étape Réservations. Vous pourrez noter le coût et ajouter le lien du loueur. 🚙",
  },
  {
    keys: ['carte', 'map', 'lieu', 'endroit', 'ajouter lieu', 'restaurant', 'bar', 'hôtel'],
    reply: "Dans l'onglet 🗺 Carte, vous pouvez :\n• Explorer des lieux près de vous\n• Filtrer par catégorie (restau, bar, hôtel...)\n• Faire un appui long sur la carte pour ajouter un nouveau lieu\n• Voir la fiche d'un lieu en appuyant dessus",
  },
  {
    keys: ['communauté', 'article', 'partager', 'publier', 'écrire', 'post'],
    reply: "Dans l'onglet 👥 Communauté, vous pouvez :\n• Lire les articles des autres voyageurs\n• Publier votre propre article avec photo\n• Liker et commenter les publications\n• Filtrer par catégorie (Itinéraires, Aventures...)",
  },
  {
    keys: ['profil', 'compte', 'photo', 'avatar', 'pseudo', 'nom'],
    reply: "Dans l'onglet 👤 Profil, vous pouvez modifier :\n• Votre photo de profil\n• Votre prénom, nom et pseudo\n• Votre mot de passe\n\nVous pouvez aussi supprimer votre compte depuis cette page.",
  },
  {
    keys: ['supprimer compte', 'effacer compte', 'désinscrire'],
    reply: "Pour supprimer votre compte, rendez-vous dans 👤 Profil → faites défiler jusqu'en bas → « Supprimer mon compte ». Toutes vos données (voyages, articles, commentaires) seront effacées définitivement.",
  },
  {
    keys: ['météo', 'temps', 'climat', 'saison', 'quand partir'],
    reply: "Talaria ne propose pas encore de météo intégrée, mais voici quelques astuces :\n🌍 Google « météo [destination] » pour les prévisions\n📅 Privilégiez les épaules de saison pour éviter la foule et les prix élevés",
  },
  {
    keys: ['destination', 'où aller', 'idée', 'inspiration', 'pays', 'ville'],
    reply: "Besoin d'inspiration ? Consultez la section « Destinations tendance » sur la page d'accueil, ou parcourez la communauté pour découvrir les itinéraires partagés par d'autres voyageurs ! 🌍",
  },
  {
    keys: ['aide', 'comment', 'utiliser', 'fonctionner', 'tutoriel', 'guide'],
    reply: "Je suis là pour vous aider ! Voici les principales fonctionnalités de Talaria :\n\n🏠 Accueil — Vue d'ensemble\n🗺 Carte — Explorez des lieux\n👥 Communauté — Partagez vos voyages\n✈️ Voyages — Planifiez et budgétez\n👤 Profil — Gérez votre compte\n\nQue souhaitez-vous savoir ?",
  },
  {
    keys: ['talaria', 'application', 'app', "c'est quoi"],
    reply: "Talaria est une application de voyage tout-en-un qui vous aide à :\n✈️ Planifier vos voyages avec budget détaillé\n🗺 Découvrir et partager des lieux sur une carte\n👥 Rejoindre une communauté de voyageurs\n\nMon nom vient des sandales ailées du dieu Hermès 🐦",
  },
];

const FALLBACK = "Je n'ai pas bien compris votre question 😅\nVoici ce que je peux vous expliquer :\n• Créer un voyage\n• Gérer votre budget\n• Utiliser la carte\n• La communauté\n• Votre profil\n\nQue souhaitez-vous savoir ?";

function findReply(text) {
  const low = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const r of RESPONSES) {
    if (r.keys.some(k => low.includes(k.normalize('NFD').replace(/[̀-ͯ]/g, '')))) {
      return r.reply;
    }
  }
  return FALLBACK;
}

/* ── Indicateur de frappe ─────────────────────── */
function TypingDots() {
  const dots = [useRef(new Animated.Value(0)).current,
                useRef(new Animated.Value(0)).current,
                useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 200),
        Animated.timing(d, { toValue: -6, duration: 300, useNativeDriver: true }),
        Animated.timing(d, { toValue: 0,  duration: 300, useNativeDriver: true }),
        Animated.delay(600 - i * 200),
      ]))
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={t.typingRow}>
      <Image source={MASCOT} style={t.avatar} resizeMode="contain" />
      <View style={t.typingBubble}>
        {dots.map((d, i) => (
          <Animated.View key={i} style={[t.dot, { transform: [{ translateY: d }] }]} />
        ))}
      </View>
    </View>
  );
}

/* ── Message ─────────────────────────────────── */
function Message({ msg }) {
  const isBot = msg.from === 'bot';
  return (
    <View style={[t.msgRow, isBot ? t.msgRowBot : t.msgRowUser]}>
      {isBot && <Image source={MASCOT} style={t.avatar} resizeMode="contain" />}
      <View style={[t.bubble, isBot ? t.bubbleBot : t.bubbleUser]}>
        <Text style={[t.bubbleText, isBot ? t.bubbleTextBot : t.bubbleTextUser]}>
          {msg.text}
        </Text>
        <Text style={t.bubbleTime}>{msg.time}</Text>
      </View>
    </View>
  );
}

/* ── Modal principal ─────────────────────────── */
export default function ChatbotModal({ visible, onClose }) {
  const insets   = useSafeAreaInsets();
  const listRef  = useRef(null);
  const [input,   setInput]   = useState('');
  const [msgs,    setMsgs]    = useState([
    { id: '0', from: 'bot', text: "Bonjour ! Je suis Tali, votre assistant voyage 🐦\nComment puis-je vous aider ?", time: now() },
  ]);
  const [typing,  setTyping]  = useState(false);

  function now() {
    return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setInput('');

    const userMsg = { id: Date.now().toString(), from: 'user', text, time: now() };
    setMsgs(m => [...m, userMsg]);
    setTyping(true);

    setTimeout(() => {
      setTyping(false);
      const botMsg = { id: (Date.now() + 1).toString(), from: 'bot', text: findReply(text), time: now() };
      setMsgs(m => [...m, botMsg]);
    }, 900 + Math.random() * 400);
  };

  useEffect(() => {
    if (msgs.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [msgs, typing]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={t.root} edges={['top']}>
        {/* Header */}
        <View style={t.header}>
          <Image source={MASCOT} style={t.headerAvatar} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={t.headerName}>Tali</Text>
            <Text style={t.headerSub}>Assistant Talaria · En ligne</Text>
          </View>
          <TouchableOpacity style={t.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <FlatList
            ref={listRef}
            data={msgs}
            keyExtractor={m => m.id}
            contentContainerStyle={t.list}
            renderItem={({ item }) => <Message msg={item} />}
            ListFooterComponent={typing ? <TypingDots /> : null}
            showsVerticalScrollIndicator={false}
          />

          {/* Input */}
          <View style={[t.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TextInput
              style={t.input}
              placeholder="Posez votre question..."
              placeholderTextColor={Colors.textMuted}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={send}
              returnKeyType="send"
              multiline
            />
            <TouchableOpacity
              style={[t.sendBtn, !input.trim() && { opacity: 0.4 }]}
              onPress={send}
              disabled={!input.trim()}
            >
              <Ionicons name="send" size={18} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const t = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f0f7' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerAvatar: { width: 42, height: 42 },
  headerName:  { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 16, color: Colors.text },
  headerSub:   { fontFamily: 'BricolageGrotesque_400Regular',  fontSize: 12, color: '#22c55e' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.inputBg,
    alignItems: 'center', justifyContent: 'center',
  },

  list: { padding: 16, gap: 12, paddingBottom: 8 },

  msgRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowBot:  { justifyContent: 'flex-start' },
  msgRowUser: { justifyContent: 'flex-end' },

  avatar: { width: 32, height: 32, borderRadius: 16 },

  bubble: {
    maxWidth: '75%', borderRadius: 18, padding: 12,
  },
  bubbleBot:  { backgroundColor: Colors.white, borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: Colors.parme, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20, fontFamily: 'BricolageGrotesque_400Regular' },
  bubbleTextBot:  { color: Colors.text },
  bubbleTextUser: { color: Colors.white },
  bubbleTime: {
    fontSize: 10, fontFamily: 'BricolageGrotesque_400Regular',
    color: 'rgba(128,128,128,0.7)', marginTop: 4, textAlign: 'right',
  },

  typingRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 4 },
  typingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.white, borderRadius: 18, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.orchidee },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    backgroundColor: Colors.white,
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  input: {
    flex: 1, backgroundColor: Colors.inputBg,
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, fontFamily: 'BricolageGrotesque_400Regular',
    color: Colors.text, maxHeight: 100,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.parme,
    alignItems: 'center', justifyContent: 'center',
  },
});
