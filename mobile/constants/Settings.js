/** Options des écrans de paramètres — mêmes valeurs que le backend (User::TRAVEL_PREFERENCES, DEFAULT_SETTINGS) */

/**
 * Adresse du support (Aide & support). Pas encore d'adresse : les boutons « Écrire au support »
 * et « Signaler un bug » sont masqués. Renseigner l'adresse (ex. 'support@talaria.world') les affiche.
 */
export const SUPPORT_EMAIL = null;

export const INVITE_POLICIES = [
  { value: 'everyone',           label: 'Tout le monde' },
  { value: 'friends',            label: 'Mes amis' },
  { value: 'friends_of_friends', label: "Amis d'amis" },
  { value: 'nobody',             label: 'Personne' },
];

export const TRANSPORTS = [
  { value: 'avion',       label: 'Avion' },
  { value: 'train',       label: 'Train' },
  { value: 'voiture',     label: 'Voiture' },
  { value: 'bus',         label: 'Bus' },
  { value: 'covoiturage', label: 'Covoiturage' },
];

export const ACCOMMODATIONS = [
  { value: 'hotel',   label: 'Hôtel' },
  { value: 'airbnb',  label: 'Airbnb' },
  { value: 'auberge', label: 'Auberge' },
  { value: 'camping', label: 'Camping' },
];

/** « Aucun » = liste vide */
export const DIETS = [
  { value: 'vegetarien',  label: 'Végétarien' },
  { value: 'vegan',       label: 'Vegan' },
  { value: 'sans-gluten', label: 'Sans gluten' },
  { value: 'halal',       label: 'Halal' },
];

/** Réglages de notifications, par rubrique de l'écran */
export const NOTIFICATION_GROUPS = [
  { title: null, items: [
    { key: 'push', title: 'Activer les notifications push', subtitle: 'Bientôt : alertes sur le téléphone' },
  ] },
  { title: 'Groupe & voyage', items: [
    { key: 'groupMessages',      title: 'Messages du groupe' },
    { key: 'votes',              title: 'Nouveaux votes', subtitle: 'Quand une activité est proposée' },
    { key: 'expenses',           title: 'Dépenses & remboursements' },
    { key: 'departureReminders', title: 'Rappels avant le départ', subtitle: 'J-7, J-1 et le jour J' },
  ] },
  { title: 'Découverte', items: [
    { key: 'deals',       title: 'Bons plans et baisses de prix' },
    { key: 'inspiration', title: 'Inspiration voyage' },
  ] },
  { title: 'E-mail', items: [
    { key: 'weeklyDigest', title: 'Récapitulatif hebdomadaire', subtitle: 'Bientôt' },
    { key: 'newsletter',   title: 'Newsletter Talaria', subtitle: 'Bientôt' },
  ] },
];

export const LANGUAGES = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Português' },
];

export const CURRENCIES = [
  { value: 'EUR', label: 'Euro', sub: 'EUR · €' },
  { value: 'USD', label: 'Dollar américain', sub: 'USD · $' },
  { value: 'MXN', label: 'Peso mexicain', sub: 'MXN · $' },
  { value: 'GBP', label: 'Livre sterling', sub: 'GBP · £' },
];

export const REIMBURSEMENT_TYPES = [
  { value: 'lydia',    label: 'Lydia',            icon: 'phone-portrait-outline', field: 'Numéro de téléphone', placeholder: '06 12 34 56 78' },
  { value: 'paypal',   label: 'PayPal',           icon: 'logo-paypal',            field: 'E-mail ou lien PayPal.me', placeholder: 'paypal.me/alec' },
  { value: 'wero',     label: 'Wero',             icon: 'swap-horizontal',        field: 'Numéro de téléphone', placeholder: '06 12 34 56 78' },
  { value: 'virement', label: 'Virement bancaire', icon: 'business-outline',      field: '4 derniers chiffres de l\'IBAN', placeholder: '4417' },
];

/** Aide & support : questions fréquentes */
export const FAQ = [
  {
    q: 'Comment inviter des amis dans un voyage ?',
    a: "Depuis la page du voyage, ouvre « Participants » puis « Ajouter ». Tu peux aussi partager le code d'invitation du groupe.",
  },
  {
    q: 'Comment sont calculées les parts du budget ?',
    a: "Chaque dépense est partagée à parts égales entre les personnes concernées. L'onglet Budget indique qui doit combien à qui, avec le moins de remboursements possible.",
  },
  {
    q: 'Talaria réserve-t-il les billets ?',
    a: "Pas encore : Talaria t'aide à comparer et à organiser. Les réservations se font sur les sites des transporteurs et des hébergeurs.",
  },
  {
    q: 'Comment quitter un groupe ?',
    a: "Ouvre le groupe, puis « Quitter le groupe ». Si tu es l'organisateur, le membre le plus ancien prend le relais.",
  },
  {
    q: 'Comment fonctionnent les votes ?',
    a: "Une activité proposée rejoint le planning dès que plus de la moitié des participants votent « Je participe ». Le vote se clôture la veille de l'activité.",
  },
  {
    q: 'Comment supprimer mon compte ?',
    a: 'Paramètres › Compte › Supprimer mon compte. La suppression devient définitive après 30 jours ; te reconnecter avant annule la demande.',
  },
];
