import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'à l\'instant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

const TYPE_ICON  = { like: '❤️', comment: '💬', friend_request: '👋', friend_accept: '🤝' };

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [notifs,      setNotifs]      = useState([]);
  const [panelOpen,   setPanelOpen]   = useState(false);
  const panelRef = useRef(null);

  const fetchNotifs = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/api/notifications');
      setNotifs(data);
    } catch { /* notifications indisponibles : on réessaie au prochain polling */ }
  }, [user]);

  // Chargement initial + polling toutes les 30s
  useEffect(() => {
    fetchNotifs();
    const id = setInterval(fetchNotifs, 30_000);
    return () => clearInterval(id);
  }, [fetchNotifs]);

  // Fermer le panel si clic extérieur
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = notifs.filter(n => !n.isRead).length;

  const markRead = async (id) => {
    await api.post(`/api/notifications/${id}/read`);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllRead = async () => {
    await api.post('/api/notifications/read-all');
    setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handleLogout = () => { logout(); navigate('/login'); };

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
      <Link to="/map" style={{ textDecoration: 'none' }}>
        <img src="/logo-dark.svg" alt="Talaria" style={{ height: 24 }} />
      </Link>

      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

          {/* ── Cloche notifications ── */}
          <div ref={panelRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setPanelOpen(o => !o)}
              style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--parme-light)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
              title="Notifications"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill={panelOpen ? 'var(--parme)' : 'var(--text-muted)'}>
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6V11c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
              </svg>
              {unread > 0 && (
                <span style={{
                  position: 'absolute', top: 3, right: 3,
                  minWidth: 16, height: 16, borderRadius: 8,
                  background: '#ef4444', color: '#fff',
                  fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 3px', border: '1.5px solid #fff',
                }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {/* Panel */}
            {panelOpen && (
              <div style={{
                position: 'absolute', top: 48, right: 0,
                width: 340, maxHeight: 440,
                background: '#fff', borderRadius: 16,
                boxShadow: '0 12px 40px rgba(30,5,20,0.15)',
                border: '1px solid var(--border)',
                overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
                zIndex: 200,
              }}>
                {/* Header panel */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>
                    Notifications {unread > 0 && <span style={{ color: 'var(--parme)' }}>({unread})</span>}
                  </span>
                  {unread > 0 && (
                    <button onClick={markAllRead} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 12, color: 'var(--parme)', fontWeight: 600,
                    }}>
                      Tout marquer lu
                    </button>
                  )}
                </div>

                {/* Liste */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {notifs.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                      Aucune notification
                    </div>
                  ) : notifs.map(n => (
                    <div
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border)',
                        background: n.isRead ? '#fff' : '#fdf4ff',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--sable-lune)'}
                      onMouseLeave={e => e.currentTarget.style.background = n.isRead ? '#fff' : '#fdf4ff'}
                    >
                      <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>
                        {TYPE_ICON[n.type] ?? '🔔'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
                          {n.message}
                        </p>
                        <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                          {timeAgo(n.createdAt)}
                        </p>
                      </div>
                      {!n.isRead && (
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: 'var(--parme)', flexShrink: 0, marginTop: 6,
                        }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Profil */}
          <Link to="/profile" className="btn btn-ghost" style={{ padding: '8px 16px' }}>
            {user.profilePicture ? (
              <img src={user.profilePicture} alt="avatar"
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
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
