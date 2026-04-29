import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav style={{
      background: '#fff',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px',
      height: 64,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <Link to="/dashboard" style={{ textDecoration: 'none' }}>
        <img src="/logo-dark.svg" alt="Talaria" style={{ height: 24 }} />
      </Link>

      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/profile" className="btn btn-ghost" style={{ padding: '8px 16px' }}>
            {user.profilePicture ? (
              <img
                src={user.profilePicture}
                alt="avatar"
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--parme)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 14,
              }}>
                {(user.firstName?.[0] || user.email[0]).toUpperCase()}
              </div>
            )}
            <span style={{ fontSize: 14 }}>{user.firstName || user.email.split('@')[0]}</span>
          </Link>
          <button className="btn btn-ghost" onClick={handleLogout} style={{ padding: '8px 16px', fontSize: 14 }}>
            Déconnexion
          </button>
        </div>
      )}
    </nav>
  );
}
