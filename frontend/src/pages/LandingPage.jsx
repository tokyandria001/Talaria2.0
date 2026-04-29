import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './LandingPage.css';

export default function LandingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate('/dashboard');
  }, [user, loading, navigate]);

  return (
    <div className="landing">
      <LandingNav />
      <HeroSection />
      <FeaturesSection />
      <PricingSection />
    </div>
  );
}

/* ── Navbar ─────────────────────────────────────────── */
function LandingNav() {
  return (
    <header className="landing-header">
      <nav className="landing-nav">
        <img src="/logo-dark.svg" alt="Talaria" className="nav-logo" />

        <ul className="nav-links">
          <li><a href="#hero">Accueil</a></li>
          <li><a href="#features">Fonctionnalités</a></li>
          <li><a href="#features">Pour qui&nbsp;?</a></li>
          <li><a href="#pricing">Tarifs</a></li>
          <li><a href="#pricing">À propos</a></li>
          <li><a href="#pricing">Contact</a></li>
        </ul>

        <div className="nav-actions">
          <div className="discord-wrap">
            <a
              href="https://discord.gg/"
              className="discord-btn"
              target="_blank"
              rel="noreferrer"
              aria-label="Discord"
            >
              <svg width="22" height="22" viewBox="0 0 71 55" fill="none">
                <path d="M60.1 4.9A58.6 58.6 0 0 0 45.6.5a40 40 0 0 0-1.8 3.7 54.2 54.2 0 0 0-16.3 0A38.5 38.5 0 0 0 25.7.5 58.5 58.5 0 0 0 11.2 4.9C1.6 19.1-1 33 .3 46.7a59 59 0 0 0 18 9.1 44.7 44.7 0 0 0 3.9-6.3 38.3 38.3 0 0 1-6.1-2.9l1.5-1.1a42.1 42.1 0 0 0 36 0l1.5 1.1a38.4 38.4 0 0 1-6.1 3 44.5 44.5 0 0 0 3.8 6.3 58.8 58.8 0 0 0 18.1-9.1C72.3 30.7 68.3 16.9 60.1 4.9ZM23.7 38.3c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1 6.4 3.2 6.4 7.1-2.9 7.1-6.4 7.1Zm23.6 0c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1 6.4 3.2 6.4 7.1-2.9 7.1-6.4 7.1Z" fill="currentColor"/>
              </svg>
            </a>
            <span className="discord-annotation">
              Rejoins notre communauté voyage
              <svg className="annotation-arrow" viewBox="0 0 80 50" fill="none">
                <path d="M70 5 C50 5, 10 20, 5 45" stroke="#49233d" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                <path d="M2 38 L5 46 L12 41" stroke="#49233d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </span>
          </div>

          <Link to="/login" className="nav-cta">
            Accéder à l'application
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        </div>
      </nav>
    </header>
  );
}

/* ── Hero ────────────────────────────────────────────── */
function HeroSection() {
  return (
    <section className="hero" id="hero">
      <div className="hero-content">
        <div className="hero-badge">
          Une seule app pour vols, logements, activités et budget
        </div>

        <h1 className="hero-title">
          Voyager mieux,<br />
          pour moins cher,<br />
          ensemble.
        </h1>

        <p className="hero-subtitle">
          Talaria regroupe tout pour ton voyage entre amis&nbsp;: prix optimisés,
          budget de groupe, planning intelligent et options plus responsables
          dans une seule app simple et fun.
        </p>

        <div className="hero-ctas">
          <Link to="/register" className="btn-hero-primary">
            Accéder à l'application
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
          <a href="https://discord.gg/" className="btn-hero-outline" target="_blank" rel="noreferrer">
            Rejoindre la communauté
          </a>
        </div>

        <div className="store-badges">
          <span>Disponible sur&nbsp;:</span>
          <button className="store-badge">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3.18 23.76c.37.21.8.24 1.2.07l12.93-7.47-2.83-2.83-11.3 10.23ZM.14 1.39A1.54 1.54 0 0 0 0 2.06v19.88c0 .24.05.47.14.67l.07.07L11.1 12V11.74L.21 1.32l-.07.07ZM20.53 9.7l-2.69-1.56-3.17 3.17 3.17 3.17 2.72-1.57c.78-.45.78-1.77-.03-2.21ZM4.38.17 17.31 7.64l-2.83 2.83L4.31.25c.02-.03.05-.06.07-.08Z"/></svg>
            Play Store
          </button>
          <button className="store-badge">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
            App Store
          </button>
        </div>
      </div>

      <div className="hero-phone-wrap">
        {/* Notification flottante haut */}
        <div className="floating-card card-top">
          <div className="notif-dot" />
          <div>
            <p className="notif-title">Alerte prix</p>
            <p className="notif-sub">Votre vol favoris est en réduction&nbsp;!</p>
          </div>
          <div className="notif-icon">🔖</div>
        </div>

        {/* Phone */}
        <div className="phone-frame">
          <div className="phone-notch" />
          <div className="phone-screen">
            <div className="app-screen-top">
              <img src="/logo-light.svg" alt="Talaria" className="app-logo" />
            </div>
            <div className="app-screen-body">
              <p className="app-screen-headline">Vols, hôtels et activités<br/>optimisés.</p>
              <p className="app-screen-sub">Trouvez les meilleurs prix, au bon moment.</p>
              <div className="app-screen-btn google">
                <svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="#fff"/></svg>
                Se connecter avec Google
              </div>
              <div className="app-screen-btn apple">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                Se connecter avec Apple
              </div>
            </div>
          </div>
        </div>

        {/* Notification flottante bas */}
        <div className="floating-card card-bottom">
          <div className="activity-dot">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          </div>
          <div>
            <p className="notif-title">Activité réservée</p>
            <p className="notif-sub">'Buggy au bord des falaises' a été pris par Marceau</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Features ────────────────────────────────────────── */
function FeaturesSection() {
  return (
    <section className="features" id="features">
      <div className="features-header">
        <h2>Tout ce que votre voyage mérite, au même endroit</h2>
        <p>
          Talaria simplifie chaque étape de votre voyage entre amis&nbsp;: de l'idée de
          destination jusqu'au dernier euro dépensé, tout est centralisé dans une
          expérience fluide et collaborative.
        </p>
      </div>

      <div className="features-grid">
        {/* Card 1 */}
        <div className="feature-card">
          <div className="feature-num">1</div>
          <div className="feature-text">
            <h3>Planning intelligent,<br/>jour par jour</h3>
            <p>
              Générez un itinéraire automatique avec 2 activités par jour adaptées
              au profil du groupe. Modifiez, ajoutez ou supprimez des activités en
              un clic, tout le planning et les budgets se mettent à jour instantanément.
            </p>
          </div>
          <div className="feature-illu">
            <img src="/illu-planning.svg" alt="Planning intelligent" />
          </div>
        </div>

        {/* Card 2 */}
        <div className="feature-card">
          <div className="feature-num">2</div>
          <div className="feature-text">
            <h3>Agrégateur intelligent</h3>
            <p>
              Comparez vols, logements et activités en quelques secondes et
              construisez un voyage complet sans jongler entre dix onglets.
            </p>
          </div>
          <div className="feature-illu feature-illu--right">
            <img src="/illu-agregateur.svg" alt="Agrégateur" />
          </div>
        </div>

        {/* Card 3 */}
        <div className="feature-card">
          <div className="feature-num">3</div>
          <div className="feature-text">
            <h3>Outils de décision<br/>pour le groupe</h3>
            <p>
              Votes sur les activités, commentaires et notifications pour décider
              ensemble sans chaos dans les discussions.
            </p>
            <p style={{ marginTop: 10 }}>
              Chaque membre voit le voyage complet, les décisions validées et les
              changements récents au même endroit.
            </p>
          </div>
          <div className="feature-illu">
            <IlluDecision />
          </div>
        </div>

        {/* Card 4 */}
        <div className="feature-card">
          <div className="feature-num">4</div>
          <div className="feature-text">
            <h3>Budget de groupe<br/>sans prise de tête</h3>
            <p>
              Suivez qui paie quoi, combien il reste à chacun et le coût total du
              voyage en temps réel. Le budget de chaque ami s'ajuste automatiquement
              avec les transports, logements et activités ajoutés au planning.
            </p>
          </div>
          <div className="feature-illu feature-illu--right">
            <IlluBudget />
          </div>
        </div>
      </div>

      {/* Social proof badge */}
      <div className="social-proof">
        <span className="social-proof-badge">
          <span className="social-dot" />
          Rejoignez une communauté de&nbsp;<strong>12 600 utilisateurs actifs</strong>
        </span>
      </div>
    </section>
  );
}

function IlluDecision() {
  return (
    <svg viewBox="0 0 260 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="illu-svg">
      {/* Clipboard 1 — check */}
      <rect x="20" y="40" width="90" height="110" rx="10" fill="none" stroke="#49233d" strokeWidth="3.5"/>
      <rect x="50" y="30" width="30" height="18" rx="5" fill="none" stroke="#49233d" strokeWidth="3"/>
      <line x1="36" y1="75" x2="94" y2="75" stroke="#49233d" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="36" y1="93" x2="94" y2="93" stroke="#49233d" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="36" y1="111" x2="75" y2="111" stroke="#49233d" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="65" cy="170" r="22" fill="none" stroke="#49233d" strokeWidth="3.5"/>
      <path d="M55 170 l7 7 12-14" stroke="#49233d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Clipboard 2 — cross */}
      <rect x="128" y="40" width="90" height="110" rx="10" fill="none" stroke="#49233d" strokeWidth="3.5"/>
      <rect x="158" y="30" width="30" height="18" rx="5" fill="none" stroke="#49233d" strokeWidth="3"/>
      <line x1="144" y1="75" x2="202" y2="75" stroke="#49233d" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="144" y1="93" x2="202" y2="93" stroke="#49233d" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="144" y1="111" x2="183" y2="111" stroke="#49233d" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="173" cy="170" r="22" fill="none" stroke="#49233d" strokeWidth="3.5"/>
      <line x1="163" y1="160" x2="183" y2="180" stroke="#49233d" strokeWidth="3" strokeLinecap="round"/>
      <line x1="183" y1="160" x2="163" y2="180" stroke="#49233d" strokeWidth="3" strokeLinecap="round"/>
      {/* Pigeon body */}
      <ellipse cx="130" cy="120" rx="28" ry="22" fill="none" stroke="#49233d" strokeWidth="3"/>
      <path d="M115 105 Q118 90 130 88 Q142 90 145 105" fill="#49233d" stroke="#49233d" strokeWidth="1"/>
      <circle cx="138" cy="92" r="5" fill="white" stroke="#49233d" strokeWidth="2"/>
      <circle cx="139" cy="92" r="2.5" fill="#49233d"/>
      <path d="M112 94 L106 96 L110 99" fill="none" stroke="#49233d" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M125 140 L122 155 L127 155" fill="none" stroke="#49233d" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M135 140 L138 155 L133 155" fill="none" stroke="#49233d" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

function IlluBudget() {
  return (
    <svg viewBox="0 0 260 240" fill="none" xmlns="http://www.w3.org/2000/svg" className="illu-svg">
      {/* Coins stack */}
      <ellipse cx="80" cy="185" rx="34" ry="10" fill="#49233d" opacity=".12"/>
      <rect x="46" y="158" width="68" height="27" rx="6" fill="none" stroke="#49233d" strokeWidth="3"/>
      <ellipse cx="80" cy="158" rx="34" ry="9" fill="white" stroke="#49233d" strokeWidth="3"/>
      <ellipse cx="80" cy="152" rx="34" ry="9" fill="white" stroke="#49233d" strokeWidth="3"/>
      <ellipse cx="80" cy="146" rx="34" ry="9" fill="white" stroke="#49233d" strokeWidth="3"/>
      <text x="75" y="150" fontSize="12" fill="#49233d" fontWeight="700" fontFamily="system-ui">$</text>
      {/* Dollar bill */}
      <rect x="110" y="110" width="100" height="60" rx="8" fill="none" stroke="#49233d" strokeWidth="3" transform="rotate(-12 110 110)"/>
      <text x="132" y="148" fontSize="22" fill="#49233d" fontWeight="800" fontFamily="system-ui" transform="rotate(-12 110 110)">$</text>
      {/* Pigeon body */}
      <ellipse cx="130" cy="90" rx="28" ry="22" fill="none" stroke="#49233d" strokeWidth="3"/>
      <path d="M115 75 Q118 60 130 58 Q142 60 145 75" fill="#49233d" stroke="#49233d" strokeWidth="1"/>
      <circle cx="138" cy="62" r="5" fill="white" stroke="#49233d" strokeWidth="2"/>
      <circle cx="139" cy="62" r="2.5" fill="#49233d"/>
      <path d="M112 64 L106 66 L110 69" fill="none" stroke="#49233d" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M148 85 Q158 80 155 90" fill="none" stroke="#49233d" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M125 110 L122 125 L127 125" fill="none" stroke="#49233d" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M135 110 L138 125 L133 125" fill="none" stroke="#49233d" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

/* ── Pricing ─────────────────────────────────────────── */
function PricingSection() {
  const plans = [
    {
      name: 'Gratuit',
      features: ['Créer voyages illimités', 'Budget groupe  live', 'Votes + chat  illimités'],
    },
    {
      name: 'Premium',
      features: [
        'Créer voyages illimités',
        'Budget groupe  live',
        'Votes + chat  illimités',
        'Alertes prix',
        'Optimisation coût total',
        'Score éco détaillé',
        'Support prioritaire',
      ],
    },
    {
      name: 'Entreprises',
      features: [
        'Créer voyages illimités',
        'Budget groupe  live',
        'Votes + chat  illimités',
        'Alertes prix',
        'Optimisation coût total',
        'Score éco détaillé',
        'Support prioritaire',
      ],
    },
  ];

  return (
    <section className="pricing" id="pricing">
      <div className="pricing-top">
        <div>
          <h2>Simple. Transparent. Évolutif.</h2>
          <p>
            Pensée pour les voyages en groupe — des week-ends entre amis aux
            déplacements d'équipes — Talaria simplifie l'organisation, optimise
            le budget et rend chaque voyage plus responsable.
          </p>
        </div>
        <Link to="/register" className="btn-pricing-cta">
          Télécharger l'App
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </Link>
      </div>

      <div className="pricing-cards">
        {plans.map((plan) => (
          <div key={plan.name} className="pricing-card">
            <h3 className="plan-name">{plan.name}</h3>
            <ul className="plan-features">
              {plan.features.map((f) => (
                <li key={f}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link to="/register" className="plan-cta">Commencer gratuitement</Link>
          </div>
        ))}
      </div>
    </section>
  );
}