import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const { user } = useAuth();

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bonne après-midi';
    return 'Bonsoir';
  };

  return (
    <div style={{ minHeight: '100svh', background: 'var(--sable-lune)' }}>
      <Navbar />
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--parme)' }}>
            {greeting()}, {user?.firstName || user?.email.split('@')[0]} 👋
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>
            Prêt à planifier ton prochain voyage ?
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          <PlaceholderCard
            emoji="✈️"
            title="Recherche de vols"
            desc="Agrégateur de vols bientôt disponible"
            comingSoon
          />
          <PlaceholderCard
            emoji="🏨"
            title="Logements"
            desc="Comparez hôtels & Airbnb bientôt"
            comingSoon
          />
          <PlaceholderCard
            emoji="🎯"
            title="Activités"
            desc="Planning intelligent bientôt disponible"
            comingSoon
          />
          <PlaceholderCard
            emoji="💰"
            title="Budget groupe"
            desc="Gestion des dépenses partagées bientôt"
            comingSoon
          />
        </div>

        <div style={{ marginTop: 32 }} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)', marginBottom: 4 }}>
                Complète ton profil voyageur
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                Définis tes préférences pour des recommandations personnalisées.
              </p>
            </div>
            <Link to="/profile" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
              Mon profil →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function PlaceholderCard({ emoji, title, desc, comingSoon }) {
  return (
    <div className="card" style={{ opacity: comingSoon ? 0.7 : 1 }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>{emoji}</div>
      <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{title}</h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{desc}</p>
      {comingSoon && (
        <span style={{
          display: 'inline-block', marginTop: 12,
          background: 'var(--parme-light)', color: 'var(--parme)',
          borderRadius: 100, padding: '3px 10px', fontSize: 12, fontWeight: 600,
        }}>
          Bientôt
        </span>
      )}
    </div>
  );
}
