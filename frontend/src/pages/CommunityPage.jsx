import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import WriteArticleModal  from '../components/WriteArticleModal';
import ArticleDetailModal from '../components/ArticleDetailModal';
import './CommunityPage.css';

/* ── Static sidebar data ─────────────────────── */
const CATEGORIES = [
  { value: 'Itinéraires',  count: null, color: '#2563eb', icon: 'grid'     },
  { value: 'Aventures',    count: null, color: '#16a34a', icon: 'triangle' },
  { value: 'Éco-Tourisme', count: null, color: '#15803d', icon: 'leaf'     },
  { value: 'Logements',    count: null, color: '#d97706', icon: 'bed'      },
  { value: 'Conseils',     count: null, color: '#db2777', icon: 'pin'      },
];

const DESTINATIONS = [
  { rank: '01', name: 'Kyoto, Japon',           count: '1.2k' },
  { rank: '02', name: 'Reykjavik, Islande',     count: '980'  },
  { rank: '03', name: 'Séville, Espagne',       count: '850'  },
  { rank: '04', name: 'Lisbonne, Portugal',     count: '710'  },
  { rank: '05', name: 'Chiang Mai, Thaïlande',  count: '630'  },
];

const TAGS = ['#Japon', '#Budget', '#Solo', '#Vanlife', '#Éco', '#Europe', '#Asie', '#Randonnée', '#StreetFood', '#Nomade'];

const AUTHOR_COLORS = ['#4f203f', '#16a34a', '#2563eb', '#d97706', '#db2777', '#0891b2', '#7c3aed'];
const authorColor = (id) => AUTHOR_COLORS[(id || 0) % AUTHOR_COLORS.length];

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'à l\'instant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `il y a ${d}j`;
  return `il y a ${Math.floor(d / 30)} mois`;
}

/* ── Category icons ─────────────────────────── */
function CatIcon({ type, color }) {
  const s = { width: 14, height: 14, fill: color, flexShrink: 0 };
  switch (type) {
    case 'grid':
      return <svg style={s} viewBox="0 0 24 24"><path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z"/></svg>;
    case 'triangle':
      return <svg style={s} viewBox="0 0 24 24"><path d="M12 2L2 22h20z"/></svg>;
    case 'leaf':
      return <svg style={s} viewBox="0 0 24 24"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.88.66L7 19h2c4 0 8-2 8-7 0-1.88-.5-3.62-1.38-5.07A9.96 9.96 0 0119 10c0 5.52-4.48 10-10 10H8l-.35.86A10.02 10.02 0 0012 22c5.52 0 10-4.48 10-10 0-2.83-1.18-5.38-3.07-7.18L17 8z"/></svg>;
    case 'bed':
      return <svg style={s} viewBox="0 0 24 24"><path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z"/></svg>;
    case 'pin':
      return <svg style={s} viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>;
    default: return null;
  }
}

/* ── Component ───────────────────────────────── */
export default function CommunityPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [articles,       setArticles]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [filter,         setFilter]         = useState('all');
  const [activeCategory, setActiveCategory] = useState(null);
  const [search,         setSearch]         = useState('');
  const [sortBy,         setSortBy]         = useState('recent');
  const [showUserMenu,   setShowUserMenu]   = useState(false);
  const [showWrite,      setShowWrite]      = useState(false);
  const [editArticle,    setEditArticle]    = useState(null);
  const [detailId,       setDetailId]       = useState(null);

  /* ── Fetch articles ───────────────────────── */
  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory) params.set('category', activeCategory);
      if (search)         params.set('search', search);
      const { data } = await api.get(`/api/articles?${params}`);
      let list = data.articles || [];
      if (filter === 'popular') list = [...list].sort((a, b) => b.likesCount - a.likesCount);
      setArticles(list);
    } catch { setArticles([]); }
    finally { setLoading(false); }
  }, [activeCategory, search, filter]);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  /* ── Like toggle (from card, not modal) ──── */
  const handleLikeCard = async (articleId) => {
    try {
      const { data } = await api.post(`/api/articles/${articleId}/like`);
      setArticles(prev => prev.map(a =>
        a.id === articleId
          ? { ...a, likedByMe: data.liked, likesCount: data.likesCount }
          : a
      ));
    } catch { /* silent */ }
  };

  /* ── Like update from detail modal ───────── */
  const handleLikeFromModal = (articleId, liked, likesCount) => {
    setArticles(prev => prev.map(a =>
      a.id === articleId ? { ...a, likedByMe: liked, likesCount } : a
    ));
  };

  /* ── Delete article ───────────────────────── */
  const handleDelete = async (articleId) => {
    if (!window.confirm('Supprimer cet article ?')) return;
    try {
      await api.delete(`/api/articles/${articleId}`);
      setArticles(prev => prev.filter(a => a.id !== articleId));
    } catch { /* silent */ }
  };

  const handleLogout = () => { logout(); navigate('/'); };

  const initials = user
    ? ((user.firstName?.[0] || '') + (user.lastName?.[0] || '') || user.email[0]).toUpperCase()
    : 'GU';

  const featured = (!activeCategory && !search && filter === 'all') ? articles[0] : null;
  const cards    = featured ? articles.slice(1) : articles;

  return (
    <div className="community-page">

      {/* ── Navbar ── */}
      <header className="map-nav">
        <div className="map-nav-inner">
          <div className="map-nav-left">
            <Link to="/">
              <img src="/logo-dark.svg" alt="Talaria" className="map-logo" />
            </Link>
            <div className="map-nav-icons">
              <Link to="/map" className="map-icon-btn" title="Carte">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              </Link>
              <Link to="/trips" className="map-icon-btn" title="Mes voyages">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98z"/></svg>
              </Link>
              <button className="map-icon-btn active" title="Communauté">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
              </button>
            </div>
          </div>

          <div className="map-search-wrap">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input
              className="map-search"
              placeholder="Rechercher dans le blog..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="map-nav-right">
            <button className="btn-ecrire" onClick={() => { setEditArticle(null); setShowWrite(true); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
              Écrire
            </button>
            <button className="map-icon-btn notif-btn" title="Notifications">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6V11c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
              <span className="notif-badge" />
            </button>
            <div className="user-menu-wrap">
              <button className="user-pill" onClick={() => setShowUserMenu(v => !v)}>
                <div className="user-avatar">{initials}</div>
                <span>{user?.firstName || 'Connexion'}</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              {showUserMenu && (
                <div className="user-dropdown">
                  <Link to="/profile" onClick={() => setShowUserMenu(false)}>Mon profil</Link>
                  <button onClick={handleLogout}>Déconnexion</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── 3-column layout ── */}
      <div className="community-layout">

        {/* ── Left sidebar ── */}
        <aside className="comm-sidebar-left">
          <div className="comm-section">
            <p className="comm-section-label">Navigation</p>
            <nav className="comm-nav-list">
              {[
                { key: 'all',     label: 'Tout voir',   icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z"/></svg> },
                { key: 'popular', label: 'Populaires',  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="#e74c3c"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/></svg> },
                { key: 'mine',    label: 'Mes articles', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/></svg> },
              ].map(n => (
                <button
                  key={n.key}
                  className={`comm-nav-item${filter === n.key ? ' active' : ''}`}
                  onClick={() => { setFilter(n.key); setActiveCategory(null); }}
                >
                  {n.icon}
                  {n.label}
                  {n.key === 'all' && <span className="comm-count">{articles.length}</span>}
                </button>
              ))}
            </nav>
          </div>

          <div className="comm-section">
            <p className="comm-section-label">Catégories</p>
            <nav className="comm-nav-list">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  className={`comm-nav-item${activeCategory === cat.value ? ' active' : ''}`}
                  onClick={() => { setActiveCategory(prev => prev === cat.value ? null : cat.value); setFilter('all'); }}
                >
                  <CatIcon type={cat.icon} color={activeCategory === cat.value ? '#fff' : cat.color} />
                  {cat.value}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* ── Main feed ── */}
        <main className="comm-main">
          <div className="comm-main-header">
            <h1 className="comm-title">Blog Voyageurs</h1>
            <div className="comm-sort">
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="comm-sort-select">
                <option value="recent">Récents</option>
                <option value="popular">Populaires</option>
              </select>
            </div>
          </div>

          <div className="comm-search-bar">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input
              placeholder="Rechercher un article, un lieu, un auteur..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
              <span className="spinner dark" />
            </div>
          ) : articles.length === 0 ? (
            <div className="comm-empty">
              <p>Aucun article pour le moment.</p>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowWrite(true)}>
                Être le premier à écrire
              </button>
            </div>
          ) : (
            <>
              {/* Featured card */}
              {featured && (
                <div className="comm-article-featured" onClick={() => setDetailId(featured.id)} style={{ cursor: 'pointer' }}>
                  {featured.coverImage
                    ? <img src={featured.coverImage} alt={featured.title} className="comm-featured-img" />
                    : <div className="comm-featured-placeholder" />
                  }
                  <div className="comm-featured-overlay" />
                  <div className="comm-featured-badge">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11z"/></svg>
                    À LA UNE
                  </div>
                  <div className="comm-featured-bottom">
                    <div className="comm-featured-meta">
                      <div className="comm-article-avatar" style={{ background: authorColor(featured.author.id) }}>
                        {featured.author.initials}
                      </div>
                      <span className="comm-featured-author">
                        {featured.author.firstName} {featured.author.lastName}
                      </span>
                      <span className="comm-dot">·</span>
                      <span>{timeAgo(featured.createdAt)}</span>
                      <span className="comm-dot">·</span>
                      <span>{featured.readTime} min de lecture</span>
                    </div>
                    <h2 className="comm-featured-title">{featured.title}</h2>
                    <div className="comm-featured-footer">
                      <div className="comm-featured-stats">
                        <button
                          className={`comm-like-btn-overlay${featured.likedByMe ? ' liked' : ''}`}
                          onClick={e => { e.stopPropagation(); handleLikeCard(featured.id); }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill={featured.likedByMe ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                          {featured.likesCount}
                        </button>
                        <span>💬 {featured.commentsCount}</span>
                        <span className="comm-cat-tag-light">{featured.category}</span>
                      </div>
                      <button className="comm-read-btn-glass" onClick={e => { e.stopPropagation(); setDetailId(featured.id); }}>
                        Lire l'article →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Regular cards */}
              <div className="comm-cards-list">
                {cards.map(article => (
                  <div key={article.id} className="comm-article-card" onClick={() => setDetailId(article.id)} style={{ cursor: 'pointer' }}>
                    {article.coverImage
                      ? <img src={article.coverImage} alt={article.title} className="comm-card-img" />
                      : <div className="comm-card-img-placeholder" />
                    }
                    <div className="comm-card-body">
                      <div className="comm-card-meta">
                        <div className="comm-article-avatar sm" style={{ background: authorColor(article.author.id) }}>
                          {article.author.initials}
                        </div>
                        <span className="comm-card-author">
                          {article.author.firstName} {article.author.lastName}
                        </span>
                        <span className="comm-dot muted">·</span>
                        <span className="comm-card-time">{timeAgo(article.createdAt)}</span>
                        <span className="comm-dot muted">·</span>
                        <span className="comm-card-read">⏱ {article.readTime} min</span>
                      </div>
                      <h3 className="comm-card-title">{article.title}</h3>
                      <p className="comm-card-excerpt">{article.excerpt}</p>
                      <div className="comm-card-footer">
                        <div className="comm-card-stats">
                          <button
                            className={`comm-like-btn-card${article.likedByMe ? ' liked' : ''}`}
                            onClick={e => { e.stopPropagation(); handleLikeCard(article.id); }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill={article.likedByMe ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                            {article.likesCount}
                          </button>
                          <span>💬 {article.commentsCount}</span>
                          <span className="comm-cat-tag">{article.category}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {article.isOwner && (
                            <>
                              <button
                                className="comm-action-btn"
                                onClick={e => { e.stopPropagation(); setEditArticle(article); setShowWrite(true); }}
                                title="Modifier"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                              </button>
                              <button
                                className="comm-action-btn comm-action-btn--delete"
                                onClick={e => { e.stopPropagation(); handleDelete(article.id); }}
                                title="Supprimer"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                              </button>
                            </>
                          )}
                          <button className="comm-read-btn" onClick={e => { e.stopPropagation(); setDetailId(article.id); }}>
                            Lire →
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>

        {/* ── Right sidebar ── */}
        <aside className="comm-sidebar-right">
          <div className="comm-widget">
            <p className="comm-widget-title">🔥 Top Destinations</p>
            <div className="comm-destinations">
              {DESTINATIONS.map(d => (
                <div key={d.rank} className="comm-destination">
                  <span className="comm-dest-rank">{d.rank}</span>
                  <div>
                    <p className="comm-dest-name">{d.name}</p>
                    <p className="comm-dest-count">{d.count} voyages créés</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="comm-widget">
            <p className="comm-widget-title"># Tags populaires</p>
            <div className="comm-tags">
              {TAGS.map(tag => (
                <span key={tag} className="comm-tag">{tag}</span>
              ))}
            </div>
          </div>

          <button className="comm-write-btn" onClick={() => { setEditArticle(null); setShowWrite(true); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            Écrire un article
          </button>
        </aside>
      </div>

      {/* ── Modals ── */}
      {showWrite && (
        <WriteArticleModal
          article={editArticle}
          onClose={() => { setShowWrite(false); setEditArticle(null); }}
          onSaved={() => { setShowWrite(false); setEditArticle(null); fetchArticles(); }}
        />
      )}

      {detailId && (
        <ArticleDetailModal
          articleId={detailId}
          currentUser={user}
          onClose={() => setDetailId(null)}
          onLikeToggle={handleLikeFromModal}
        />
      )}
    </div>
  );
}