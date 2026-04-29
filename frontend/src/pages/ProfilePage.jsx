import { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import Navbar from '../components/Navbar';

const ACTIVITY_TAGS = [
  { value: 'culture', label: '🏛️ Culture' },
  { value: 'nature', label: '🌿 Nature' },
  { value: 'nightlife', label: '🎉 Nightlife' },
  { value: 'sport', label: '🏄 Sport' },
  { value: 'gastronomie', label: '🍽️ Gastronomie' },
  { value: 'aventure', label: '🧗 Aventure' },
  { value: 'plage', label: '🏖️ Plage' },
  { value: 'shopping', label: '🛍️ Shopping' },
  { value: 'bien-etre', label: '🧘 Bien-être' },
  { value: 'art', label: '🎨 Art' },
];

const TRAVEL_STYLES = [
  { value: 'budget', label: '💸 Budget' },
  { value: 'confort', label: '🛋️ Confort' },
  { value: 'luxe', label: '✨ Luxe' },
];

const TRAVEL_PACES = [
  { value: 'slow', label: '🐢 Slow travel' },
  { value: 'fast', label: '⚡ Rythme rapide' },
];

const TRANSPORTS = [
  { value: 'avion', label: '✈️ Avion' },
  { value: 'train', label: '🚄 Train' },
  { value: 'voiture', label: '🚗 Voiture' },
  { value: 'bateau', label: '⛵ Bateau' },
  { value: 'mixte', label: '🔀 Mixte' },
];

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    username: user?.username || '',
    averageBudget: user?.averageBudget || '',
    activityTags: user?.activityTags || [],
    travelStyle: user?.travelStyle || '',
    travelPace: user?.travelPace || '',
    favoriteTransport: user?.favoriteTransport || '',
    interests: user?.interests || [],
  });
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);
  const [pwdMsg, setPwdMsg] = useState(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [interestInput, setInterestInput] = useState('');
  const fileRef = useRef();

  const toggleTag = (val) => {
    setForm(f => ({
      ...f,
      activityTags: f.activityTags.includes(val)
        ? f.activityTags.filter(t => t !== val)
        : [...f.activityTags, val],
    }));
  };

  const addInterest = (e) => {
    if (e.key === 'Enter' && interestInput.trim()) {
      e.preventDefault();
      const val = interestInput.trim();
      if (!form.interests.includes(val)) {
        setForm(f => ({ ...f, interests: [...f.interests, val] }));
      }
      setInterestInput('');
    }
  };

  const removeInterest = (val) => {
    setForm(f => ({ ...f, interests: f.interests.filter(i => i !== val) }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setProfileMsg(null);
    try {
      await api.put('/api/profile', {
        ...form,
        averageBudget: form.averageBudget ? parseInt(form.averageBudget) : null,
      });
      await refreshUser();
      setProfileMsg({ type: 'success', text: 'Profil mis à jour ✓' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.message || 'Erreur lors de la sauvegarde.' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdMsg({ type: 'error', text: 'Les mots de passe ne correspondent pas.' });
      return;
    }
    setSavingPwd(true);
    setPwdMsg(null);
    try {
      await api.put('/api/profile/password', {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      });
      setPwdMsg({ type: 'success', text: 'Mot de passe modifié ✓' });
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwdMsg({ type: 'error', text: err.response?.data?.message || 'Erreur.' });
    } finally {
      setSavingPwd(false);
    }
  };

  const handlePictureUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('picture', file);
    setUploadingPic(true);
    try {
      await api.post('/api/profile/picture', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await refreshUser();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur upload.');
    } finally {
      setUploadingPic(false);
    }
  };

  return (
    <div style={{ minHeight: '100svh', background: 'var(--sable-lune)' }}>
      <Navbar />
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        <h1 style={{ fontWeight: 800, fontSize: 28, color: 'var(--parme)' }}>Mon profil</h1>

        {/* Avatar */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ position: 'relative' }}>
            {user?.profilePicture ? (
              <img
                src={user.profilePicture}
                alt="avatar"
                style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--border)' }}
              />
            ) : (
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'var(--parme)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 28,
              }}>
                {(user?.firstName?.[0] || user?.email[0] || '?').toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 16 }}>{user?.firstName || ''} {user?.lastName || ''}</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{user?.email}</p>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePictureUpload} />
            <button
              className="btn btn-outline"
              style={{ padding: '8px 16px', fontSize: 13 }}
              onClick={() => fileRef.current?.click()}
              disabled={uploadingPic}
            >
              {uploadingPic ? <><span className="spinner dark" /> Envoi...</> : 'Changer la photo'}
            </button>
          </div>
        </div>

        {/* Informations personnelles */}
        <form className="card" onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h2 style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>Informations personnelles</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="label">Prénom</label>
              <input className="input" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Prénom" />
            </div>
            <div>
              <label className="label">Nom</label>
              <input className="input" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Nom" />
            </div>
          </div>

          <div>
            <label className="label">Pseudo</label>
            <input className="input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="@mon_pseudo" />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
          <h2 style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>Préférences voyage</h2>

          <div>
            <label className="label">Budget moyen par voyage (€)</label>
            <input
              className="input" type="number" min="0" placeholder="ex: 800"
              value={form.averageBudget}
              onChange={e => setForm(f => ({ ...f, averageBudget: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Style de voyage</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {TRAVEL_STYLES.map(s => (
                <button
                  key={s.value} type="button"
                  className={`tag${form.travelStyle === s.value ? ' active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, travelStyle: f.travelStyle === s.value ? '' : s.value }))}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Rythme de voyage</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {TRAVEL_PACES.map(p => (
                <button
                  key={p.value} type="button"
                  className={`tag${form.travelPace === p.value ? ' active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, travelPace: f.travelPace === p.value ? '' : p.value }))}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Transport favori</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {TRANSPORTS.map(t => (
                <button
                  key={t.value} type="button"
                  className={`tag${form.favoriteTransport === t.value ? ' active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, favoriteTransport: f.favoriteTransport === t.value ? '' : t.value }))}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Activités préférées</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {ACTIVITY_TAGS.map(tag => (
                <button
                  key={tag.value} type="button"
                  className={`tag${form.activityTags.includes(tag.value) ? ' active' : ''}`}
                  onClick={() => toggleTag(tag.value)}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Centres d'intérêt libres</label>
            <input
              className="input"
              placeholder="Tape un intérêt et appuie sur Entrée..."
              value={interestInput}
              onChange={e => setInterestInput(e.target.value)}
              onKeyDown={addInterest}
            />
            {form.interests.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {form.interests.map(i => (
                  <span key={i} className="tag active" style={{ cursor: 'default' }}>
                    {i}
                    <button
                      type="button"
                      onClick={() => removeInterest(i)}
                      style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 0 0 4px', fontSize: 14, lineHeight: 1 }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {profileMsg && (
            <p style={{ fontSize: 14, color: profileMsg.type === 'success' ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
              {profileMsg.text}
            </p>
          )}

          <button className="btn btn-primary" type="submit" disabled={saving} style={{ alignSelf: 'flex-start' }}>
            {saving ? <><span className="spinner" /> Sauvegarde...</> : 'Sauvegarder'}
          </button>
        </form>

        {/* Changer le mot de passe */}
        <form className="card" onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>Changer le mot de passe</h2>

          <div>
            <label className="label">Mot de passe actuel</label>
            <input
              className="input" type="password" placeholder="••••••••"
              value={pwdForm.currentPassword}
              onChange={e => setPwdForm(f => ({ ...f, currentPassword: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">Nouveau mot de passe</label>
            <input
              className="input" type="password" placeholder="••••••••"
              value={pwdForm.newPassword}
              onChange={e => setPwdForm(f => ({ ...f, newPassword: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">Confirmer le nouveau mot de passe</label>
            <input
              className="input" type="password" placeholder="••••••••"
              value={pwdForm.confirmPassword}
              onChange={e => setPwdForm(f => ({ ...f, confirmPassword: e.target.value }))}
              required
            />
          </div>

          {pwdMsg && (
            <p style={{ fontSize: 14, color: pwdMsg.type === 'success' ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
              {pwdMsg.text}
            </p>
          )}

          <button className="btn btn-primary" type="submit" disabled={savingPwd} style={{ alignSelf: 'flex-start' }}>
            {savingPwd ? <><span className="spinner" /> Modification...</> : 'Modifier le mot de passe'}
          </button>
        </form>

      </main>
    </div>
  );
}
