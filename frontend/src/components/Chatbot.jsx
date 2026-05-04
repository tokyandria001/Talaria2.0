import { useState, useRef, useEffect } from 'react';
import './Chatbot.css';

const MASCOT = '/Logo-09.png';

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
    reply: "Pour créer un voyage, cliquez sur l'onglet ✈️ Voyages dans la barre de navigation, puis sur « + Nouveau voyage ».\n\nVous pourrez renseigner :\n• Destination et ville de départ\n• Dates aller/retour\n• Nombre de voyageurs\n• Budget prévu\n• Moyen de transport",
  },
  {
    keys: ['budget', 'argent', 'coût', 'dépense', 'prix', 'combien'],
    reply: "Lors de la création d'un voyage, vous pouvez renseigner un budget global. Si vous voyagez en voiture, Talaria calcule automatiquement le coût carburant (A/R) en fonction de la distance, du prix du carburant et de la consommation. 💰",
  },
  {
    keys: ['voiture', 'essence', 'carburant', 'péage', 'km', 'kilomètre'],
    reply: "Pour un voyage en voiture, renseignez :\n• Distance aller (km)\n• Prix du carburant (€/L)\n• Consommation (L/100km)\n• Péages A/R (€)\n\nTalaria calcule le coût total automatiquement ⛽",
  },
  {
    keys: ['avion', 'vol', 'train', 'bus', 'transport'],
    reply: "Talaria prend en charge 4 modes de transport :\n✈️ Avion — 🚄 Train — 🚌 Bus — 🚗 Voiture\n\nPour les vols et trains, vous pouvez ajouter des liens vers Skyscanner, Booking ou d'autres services dans l'étape Réservations.",
  },
  {
    keys: ['réservation', 'booking', 'hôtel', 'airbnb', 'skyscanner', 'lien'],
    reply: "Dans l'étape Réservations d'un voyage, ajoutez des liens vers :\n🏨 Hôtels (Booking, Airbnb)\n✈️ Vols (Skyscanner, Transavia)\n🎯 Activités\n\nChaque lien s'ouvre dans un nouvel onglet.",
  },
  {
    keys: ['location', 'louer', 'véhicule'],
    reply: "Cochez « Besoin d'une location de véhicule sur place » dans l'étape Réservations. Vous pourrez noter le coût et le lien du loueur. 🚙",
  },
  {
    keys: ['carte', 'map', 'lieu', 'endroit', 'ajouter lieu', 'restaurant', 'bar'],
    reply: "Dans l'onglet 🗺 Carte, vous pouvez :\n• Explorer des lieux\n• Filtrer par catégorie\n• Faire un clic long sur la carte pour ajouter un nouveau lieu\n• Visualiser les fiches en cliquant sur un marqueur",
  },
  {
    keys: ['communauté', 'article', 'partager', 'publier', 'écrire'],
    reply: "Dans l'onglet 👥 Communauté, vous pouvez :\n• Lire les articles des autres voyageurs\n• Publier votre propre article avec photo\n• Liker et commenter les publications\n• Filtrer par catégorie (Itinéraires, Aventures...)",
  },
  {
    keys: ['profil', 'compte', 'photo', 'pseudo', 'supprimer compte', 'déconnexion'],
    reply: "Dans la page 👤 Profil (en haut à droite), vous pouvez :\n• Modifier vos informations personnelles\n• Changer votre photo de profil\n• Mettre à jour votre mot de passe\n• Supprimer votre compte (zone dangereuse)",
  },
  {
    keys: ['météo', 'temps', 'climat', 'saison'],
    reply: "Talaria ne propose pas encore de météo intégrée. Consultez Google Météo ou Météo France pour les prévisions de votre destination. 🌤",
  },
  {
    keys: ['destination', 'où aller', 'idée', 'inspiration'],
    reply: "Parcourez la 👥 Communauté pour découvrir les itinéraires partagés par d'autres voyageurs, ou explorez la 🗺 Carte pour trouver des lieux inspirants ! 🌍",
  },
  {
    keys: ['aide', 'comment', 'utiliser', 'fonctionner', 'guide'],
    reply: "Bienvenue sur Talaria ! Voici les principales sections :\n\n🗺 Carte — Explorez et ajoutez des lieux\n👥 Communauté — Partagez vos voyages\n✈️ Voyages — Planifiez et budgétez\n👤 Profil — Gérez votre compte\n\nQue souhaitez-vous savoir ?",
  },
  {
    keys: ['talaria', 'application', "c'est quoi", 'présentation'],
    reply: "Talaria est une application de voyage tout-en-un :\n✈️ Planifiez vos voyages avec budget détaillé\n🗺 Découvrez et partagez des lieux sur une carte interactive\n👥 Rejoignez une communauté de voyageurs\n\nMon nom vient des sandales ailées d'Hermès 🐦",
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

function now() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

const INIT = [{ id: '0', from: 'bot', text: "Bonjour ! Je suis Tali, votre assistant voyage 🐦\nComment puis-je vous aider ?", time: now() }];

export default function Chatbot() {
  const [open,   setOpen]   = useState(false);
  const [msgs,   setMsgs]   = useState(INIT);
  const [input,  setInput]  = useState('');
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, typing]);

  useEffect(() => {
    if (open) { setUnread(0); inputRef.current?.focus(); }
  }, [open]);

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
      if (!open) setUnread(n => n + 1);
    }, 900 + Math.random() * 400);
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <>
      {/* ── FAB ── */}
      <button className="chat-fab" onClick={() => setOpen(o => !o)} title="Parler à Tali">
        <img src={MASCOT} alt="Tali" />
        {unread > 0 && !open && <span className="chat-badge">{unread}</span>}
      </button>

      {/* ── Panel ── */}
      {open && (
        <div className="chat-panel">
          {/* Header */}
          <div className="chat-header">
            <img src={MASCOT} alt="Tali" className="chat-header-avatar" />
            <div>
              <div className="chat-header-name">Tali</div>
              <div className="chat-header-status">Assistant Talaria · En ligne</div>
            </div>
            <button className="chat-header-close" onClick={() => setOpen(false)}>✕</button>
          </div>

          {/* Messages */}
          <div className="chat-messages">
            {msgs.map(msg => (
              <div key={msg.id} className={`msg-row ${msg.from}`}>
                {msg.from === 'bot' && (
                  <img src={MASCOT} alt="Tali" className="msg-avatar" />
                )}
                <div>
                  <div className={`msg-bubble ${msg.from}`}>{msg.text}</div>
                  <div className="msg-time">{msg.time}</div>
                </div>
              </div>
            ))}

            {typing && (
              <div className="typing-row">
                <img src={MASCOT} alt="Tali" className="msg-avatar" />
                <div className="typing-bubble">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="chat-input-row">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="Posez votre question..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={1}
            />
            <button className="chat-send" onClick={send} disabled={!input.trim()}>
              <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
