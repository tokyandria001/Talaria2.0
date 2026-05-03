import { useState, useRef } from 'react';
import api from '../api/axios';
import './WriteArticleModal.css';

const CATEGORIES = ['Itinéraires', 'Aventures', 'Éco-Tourisme', 'Logements', 'Conseils'];

export default function WriteArticleModal({ onClose, onSaved, article }) {
  const editing = !!article;

  const [form, setForm] = useState({
    title:    article?.title    ?? '',
    category: article?.category ?? '',
    content:  article?.content  ?? '',
    excerpt:  article?.excerpt  ?? '',
  });
  // coverImage stores the server path (relative URL)
  const [coverPath,    setCoverPath]    = useState(article?.coverImage ?? null);
  // previewUrl is a local object URL for instant preview before upload finishes
  const [previewUrl,   setPreviewUrl]   = useState(article?.coverImage ?? null);
  const [uploading,    setUploading]    = useState(false);
  const [uploadError,  setUploadError]  = useState('');
  const [errors,       setErrors]       = useState({});
  const [saving,       setSaving]       = useState(false);
  const fileInputRef = useRef(null);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  /* ── Handle file selection ── */
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant local preview
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    setCoverPath(null);
    setUploadError('');
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append('cover', file);
      const { data } = await api.post('/api/articles/upload-cover', fd);
      setCoverPath(data.path);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || err.response?.data?.detail || err.message;
      setUploadError(msg ? `Erreur ${status ?? ''} : ${msg}` : `Erreur réseau (backend démarré ?)`);
      setPreviewUrl(null);
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-selected if needed
      e.target.value = '';
    }
  };

  const removeCover = () => {
    setCoverPath(null);
    setPreviewUrl(null);
    setUploadError('');
  };

  /* ── Submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.title.trim())    errs.title    = 'Le titre est requis.';
    if (!form.category)        errs.category = 'Choisissez une catégorie.';
    if (!form.content.trim())  errs.content  = 'Le contenu est requis.';
    if (uploading)             errs.global   = 'Attendez la fin de l\'upload.';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setErrors({});
    setSaving(true);
    try {
      const payload = {
        title:      form.title.trim(),
        category:   form.category,
        content:    form.content.trim(),
        coverImage: coverPath ?? null,
        excerpt:    form.excerpt.trim() || null,
      };
      if (editing) {
        await api.put(`/api/articles/${article.id}`, payload);
      } else {
        await api.post('/api/articles', payload);
      }
      onSaved();
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors) setErrors(data.errors);
      else setErrors({ global: data?.message || 'Une erreur est survenue.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="write-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editing ? 'Modifier l\'article' : 'Écrire un article'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="write-form">

          {/* Cover image upload */}
          <div className="write-field">
            <label className="label">Image de couverture</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {previewUrl ? (
              <div className="write-cover-preview">
                <img src={previewUrl} alt="Couverture" className="write-cover-img" />
                {uploading && (
                  <div className="write-cover-uploading">
                    <span className="spinner" />
                    <span>Upload en cours...</span>
                  </div>
                )}
                {!uploading && (
                  <div className="write-cover-actions">
                    <button type="button" className="write-cover-change" onClick={() => fileInputRef.current?.click()}>
                      Changer
                    </button>
                    <button type="button" className="write-cover-remove" onClick={removeCover}>
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="write-upload-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 12l3-3 3 3M12 9v7"/></svg>
                <span>Choisir une image</span>
                <span className="write-upload-hint">JPEG, PNG, WebP · max 5 Mo</span>
              </button>
            )}
            {uploadError && <p className="error-msg">{uploadError}</p>}
          </div>

          {/* Title */}
          <div className="write-field">
            <label className="label">Titre *</label>
            <input
              className={`input${errors.title ? ' error' : ''}`}
              placeholder="Un titre accrocheur..."
              value={form.title}
              onChange={set('title')}
              autoFocus
            />
            {errors.title && <p className="error-msg">{errors.title}</p>}
          </div>

          {/* Category */}
          <div className="write-field">
            <label className="label">Catégorie *</label>
            <select
              className={`input write-select${errors.category ? ' error' : ''}`}
              value={form.category}
              onChange={set('category')}
            >
              <option value="">Choisir une catégorie...</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.category && <p className="error-msg">{errors.category}</p>}
          </div>

          {/* Excerpt */}
          <div className="write-field">
            <label className="label">
              Résumé
              <span className="write-optional">optionnel — affiché sur la carte</span>
            </label>
            <input
              className="input"
              placeholder="Une phrase pour accrocher le lecteur..."
              value={form.excerpt}
              onChange={set('excerpt')}
            />
          </div>

          {/* Content */}
          <div className="write-field">
            <label className="label">
              Contenu *
              <span className="write-char-count">{form.content.length} car.</span>
            </label>
            <textarea
              className={`input write-textarea${errors.content ? ' error' : ''}`}
              placeholder="Racontez votre voyage, partagez vos conseils..."
              value={form.content}
              onChange={set('content')}
            />
            {errors.content && <p className="error-msg">{errors.content}</p>}
          </div>

          {errors.global && <p className="error-msg">{errors.global}</p>}

          <div className="write-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={saving || uploading}>
              {saving ? <span className="spinner" /> : (editing ? 'Enregistrer' : 'Publier l\'article')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}