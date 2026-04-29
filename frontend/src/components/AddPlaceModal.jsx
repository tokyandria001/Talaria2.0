import { useState } from 'react';
import api from '../api/axios';

const ALL_TAGS = [
  { value: 'restaurant', label: '🍽 Restaurant' },
  { value: 'bar',        label: '🍸 Bar' },
  { value: 'hotel',      label: '🛏 Hôtel' },
  { value: 'visite',     label: '🏛 Visite' },
  { value: 'plage',      label: '🏖 Plage' },
  { value: 'sport',      label: '🏄 Sport' },
  { value: 'culture',    label: '🎨 Culture' },
];

export default function AddPlaceModal({ coords, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    tags: [],
    averagePrice: '',
    latitude: coords?.lat?.toFixed(6) || '',
    longitude: coords?.lng?.toFixed(6) || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleTag = (val) => {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(val) ? f.tags.filter(t => t !== val) : [...f.tags, val],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/api/places', {
        ...form,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        averagePrice: form.averagePrice ? parseInt(form.averagePrice) : null,
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l\'ajout.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Ajouter un lieu</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">Nom *</label>
            <input
              className="input"
              placeholder="Nom du lieu"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input"
              placeholder="Décrivez ce lieu..."
              rows={3}
              style={{ resize: 'vertical' }}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Catégories</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {ALL_TAGS.map(t => (
                <button
                  key={t.value} type="button"
                  className={`tag${form.tags.includes(t.value) ? ' active' : ''}`}
                  onClick={() => toggleTag(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Prix moyen (€)</label>
            <input
              className="input" type="number" min="0" placeholder="Ex: 25"
              value={form.averagePrice}
              onChange={e => setForm(f => ({ ...f, averagePrice: e.target.value }))}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Latitude</label>
              <input
                className="input" type="number" step="any"
                value={form.latitude}
                onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Longitude</label>
              <input
                className="input" type="number" step="any"
                value={form.longitude}
                onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
                required
              />
            </div>
          </div>

          {coords && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              📍 Coordonnées issues du clic droit sur la carte
            </p>
          )}

          {error && <p className="error-msg">{error}</p>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : 'Ajouter le lieu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}