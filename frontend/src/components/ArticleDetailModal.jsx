import { useEffect, useState, useRef } from 'react';
import api from '../api/axios';
import './ArticleDetailModal.css';

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

export default function ArticleDetailModal({ articleId, currentUser, onClose, onLikeToggle }) {
  const [article,     setArticle]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [likedByMe,   setLikedByMe]   = useState(false);
  const [likesCount,  setLikesCount]  = useState(0);
  const [liking,      setLiking]      = useState(false);
  const [comments,    setComments]    = useState([]);
  const [commentText, setCommentText] = useState('');
  const [posting,     setPosting]     = useState(false);
  const [commentErr,  setCommentErr]  = useState('');
  const commentRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    api.get(`/api/articles/${articleId}`)
      .then(({ data }) => {
        setArticle(data);
        setLikedByMe(data.likedByMe);
        setLikesCount(data.likesCount);
        setComments(data.comments || []);
      })
      .finally(() => setLoading(false));
  }, [articleId]);

  const toggleLike = async () => {
    if (liking) return;
    setLiking(true);
    const prev = likedByMe;
    setLikedByMe(!prev);
    setLikesCount(c => prev ? c - 1 : c + 1);
    try {
      const { data } = await api.post(`/api/articles/${articleId}/like`);
      setLikedByMe(data.liked);
      setLikesCount(data.likesCount);
      onLikeToggle?.(articleId, data.liked, data.likesCount);
    } catch {
      setLikedByMe(prev);
      setLikesCount(c => prev ? c + 1 : c - 1);
    } finally {
      setLiking(false);
    }
  };

  const submitComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setCommentErr('');
    setPosting(true);
    try {
      const { data } = await api.post(`/api/articles/${articleId}/comments`, { content: commentText.trim() });
      setComments(prev => [...prev, data]);
      setCommentText('');
      setTimeout(() => commentRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err) {
      setCommentErr(err.response?.data?.errors?.content || 'Erreur lors de l\'envoi.');
    } finally {
      setPosting(false);
    }
  };

  const deleteComment = async (commentId) => {
    if (!window.confirm('Supprimer ce commentaire ?')) return;
    try {
      await api.delete(`/api/articles/${articleId}/comments/${commentId}`);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch { /* silent */ }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="article-modal" onClick={e => e.stopPropagation()}>
        <button className="article-modal-close" onClick={onClose}>✕</button>

        {loading ? (
          <div className="article-modal-loader">
            <span className="spinner dark" />
          </div>
        ) : article ? (
          <div className="article-modal-inner">
            {/* Cover image */}
            {article.coverImage && (
              <div className="article-cover-wrap">
                <img src={article.coverImage} alt={article.title} className="article-cover" />
                <div className="article-cover-overlay" />
              </div>
            )}

            <div className="article-body">
              {/* Category */}
              <span className="article-cat-badge">{article.category}</span>

              {/* Title */}
              <h1 className="article-title">{article.title}</h1>

              {/* Meta */}
              <div className="article-meta">
                <div
                  className="article-meta-avatar"
                  style={{ background: authorColor(article.author.id) }}
                >
                  {article.author.initials}
                </div>
                <span className="article-meta-name">
                  {article.author.firstName} {article.author.lastName}
                </span>
                <span className="article-meta-dot">·</span>
                <span>{timeAgo(article.createdAt)}</span>
                <span className="article-meta-dot">·</span>
                <span>{article.readTime} min de lecture</span>
              </div>

              {/* Like strip */}
              <div className="article-like-strip">
                <button
                  className={`article-like-btn${likedByMe ? ' liked' : ''}`}
                  onClick={toggleLike}
                  disabled={liking}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={likedByMe ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                  {likesCount} {likesCount > 1 ? 'j\'aime' : 'j\'aime'}
                </button>
                <span className="article-comment-count">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  {comments.length} commentaire{comments.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Content */}
              <div className="article-content">
                {article.content.split('\n').map((para, i) =>
                  para.trim() ? <p key={i}>{para}</p> : <br key={i} />
                )}
              </div>

              {/* Comments */}
              <div className="article-comments-section">
                <h3 className="article-comments-title">
                  Commentaires ({comments.length})
                </h3>

                {/* Add comment */}
                <form onSubmit={submitComment} className="article-add-comment">
                  <div
                    className="article-comment-me-avatar"
                    style={{ background: authorColor(currentUser?.id) }}
                  >
                    {((currentUser?.firstName?.[0] || '') + (currentUser?.lastName?.[0] || '') || currentUser?.email?.[0] || '?').toUpperCase()}
                  </div>
                  <div className="article-comment-input-wrap">
                    <textarea
                      className="article-comment-input"
                      placeholder="Ajouter un commentaire..."
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      rows={2}
                    />
                    {commentErr && <p className="error-msg" style={{ marginTop: 4 }}>{commentErr}</p>}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ padding: '7px 18px', fontSize: 13 }}
                        disabled={posting || !commentText.trim()}
                      >
                        {posting ? <span className="spinner" /> : 'Publier'}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Comments list */}
                <div className="article-comments-list">
                  {comments.map(c => (
                    <div key={c.id} className="article-comment">
                      <div
                        className="article-comment-avatar"
                        style={{ background: authorColor(c.author.id) }}
                      >
                        {c.author.initials || ((c.author.firstName?.[0] || '') + (c.author.lastName?.[0] || '')).toUpperCase()}
                      </div>
                      <div className="article-comment-body">
                        <div className="article-comment-header">
                          <span className="article-comment-author">
                            {c.author.firstName} {c.author.lastName}
                          </span>
                          <span className="article-comment-time">{timeAgo(c.createdAt)}</span>
                          {c.isOwner && (
                            <button
                              className="article-comment-delete"
                              onClick={() => deleteComment(c.id)}
                            >
                              Supprimer
                            </button>
                          )}
                        </div>
                        <p className="article-comment-text">{c.content}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={commentRef} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="article-modal-loader">
            <p style={{ color: 'var(--text-muted)' }}>Article introuvable.</p>
          </div>
        )}
      </div>
    </div>
  );
}