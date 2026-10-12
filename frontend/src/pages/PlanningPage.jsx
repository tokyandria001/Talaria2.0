import { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import './TripsPage.css';
import './PlanningPage.css';

const SLOTS = [
  { value: 'matin',      label: 'Matin',      icon: '🌅' },
  { value: 'midi',       label: 'Midi',       icon: '🍽' },
  { value: 'apres-midi', label: 'Après-midi', icon: '☀️' },
  { value: 'soir',       label: 'Soir',       icon: '🌙' },
];

const CATEGORIES = [
  { value: 'visite',     label: 'Visite',  icon: '🏛' },
  { value: 'culture',    label: 'Culture', icon: '🎨' },
  { value: 'restaurant', label: 'Resto',   icon: '🍽' },
  { value: 'bar',        label: 'Bar',     icon: '🍸' },
  { value: 'plage',      label: 'Plage',   icon: '🏖' },
  { value: 'sport',      label: 'Sport',   icon: '🏄' },
];

const EMPTY_ACTIVITY = {
  title: '', description: '', category: '', price: '',
  hasSpecialPrice: false, specialPriceNote: '',
};

const fmtEur  = (n) => `${(n ?? 0).toLocaleString('fr-FR')} €`;
const catIcon = (v) => CATEGORIES.find(c => c.value === v)?.icon ?? '📍';
const fmtDay  = (iso, opts) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC', ...opts });

/** Jours du voyage au format AAAA-MM-JJ (calculés en UTC pour éviter les décalages de fuseau). */
function tripDays(start, end) {
  const days = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (d <= last && days.length < 60) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

/** Coordonnées de la destination via OpenStreetMap (null si introuvable). */
async function geocode(destination) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(destination)}`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
    const [hit] = await res.json();
    return hit ? { lat: +hit.lat, lng: +hit.lon } : null;
  } catch {
    return null;
  }
}

/* ════════════════════════════════════════
   MODAL — ajout / modification d'activité
   ════════════════════════════════════════ */
function ActivityModal({ tripId, days, initial, onClose, onSaved }) {
  const isEdit = !!initial.id;
  const [form, setForm] = useState({
    title:            initial.title            ?? EMPTY_ACTIVITY.title,
    description:      initial.description      ?? EMPTY_ACTIVITY.description,
    category:         initial.category         ?? EMPTY_ACTIVITY.category,
    price:            initial.price            ?? EMPTY_ACTIVITY.price,
    hasSpecialPrice:  initial.hasSpecialPrice  ?? EMPTY_ACTIVITY.hasSpecialPrice,
    specialPriceNote: initial.specialPriceNote ?? EMPTY_ACTIVITY.specialPriceNote,
    date:             initial.date,
    slot:             initial.slot,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Donnez un titre à l\'activité.'); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...form, price: form.price !== '' ? +form.price : null };
      const res = isEdit
        ? await api.patch(`/api/trips/${tripId}/activities/${initial.id}`, payload)
        : await api.post(`/api/trips/${tripId}/activities`, payload);
      onSaved(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur serveur.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="trip-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="trip-modal">
        <div className="trip-modal-header">
          <div>
            <h2>{isEdit ? 'Modifier l\'activité' : 'Nouvelle activité'}</h2>
            <p>{fmtDay(form.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <button className="trip-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="trip-field">
          <label className="trip-label">Titre</label>
          <input className="trip-input" placeholder="Visite du Colisée" autoFocus
            value={form.title} onChange={set('title')} />
        </div>

        <div className="trip-row">
          <div className="trip-field">
            <label className="trip-label">Jour</label>
            <select className="trip-input" value={form.date} onChange={set('date')}>
              {days.map((d, i) => (
                <option key={d} value={d}>J{i + 1} · {fmtDay(d, { weekday: 'short', day: '2-digit', month: 'short' })}</option>
              ))}
            </select>
          </div>
          <div className="trip-field">
            <label className="trip-label">Créneau</label>
            <select className="trip-input" value={form.slot} onChange={set('slot')}>
              {SLOTS.map(sl => <option key={sl.value} value={sl.value}>{sl.icon} {sl.label}</option>)}
            </select>
          </div>
        </div>

        <div className="trip-field">
          <label className="trip-label">Type <span>(optionnel)</span></label>
          <div className="transport-pills">
            {CATEGORIES.map(c => (
              <button key={c.value} type="button"
                className={`transport-pill${form.category === c.value ? ' active' : ''}`}
                onClick={() => setForm(f => ({ ...f, category: f.category === c.value ? '' : c.value }))}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="trip-field">
          <label className="trip-label">Prix <span>(€, optionnel)</span></label>
          <input className="trip-input" type="number" min="0" placeholder="25" value={form.price} onChange={set('price')} />
        </div>

        <div className="trip-field">
          <div className="trip-check-row">
            <input type="checkbox" id="act-special" checked={form.hasSpecialPrice} onChange={set('hasSpecialPrice')} />
            <label htmlFor="act-special" className="trip-check-label">Tarif spécial (réduction CE, promo...)</label>
          </div>
          {form.hasSpecialPrice && (
            <input className="trip-input" placeholder="Ex: -15% avec la carte CE"
              value={form.specialPriceNote} onChange={set('specialPriceNote')} />
          )}
        </div>

        <div className="trip-field">
          <label className="trip-label">Notes <span>(optionnel)</span></label>
          <textarea className="trip-input" rows={3} placeholder="Réserver à l'avance, horaires..."
            value={form.description} onChange={set('description')} />
        </div>

        {error && <div className="trip-error">{error}</div>}

        <div className="trip-modal-footer">
          <button className="btn btn-outline" style={{ padding: '10px 20px' }} onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" style={{ padding: '10px 24px' }} disabled={saving} onClick={handleSave}>
            {saving ? 'Enregistrement...' : isEdit ? 'Sauvegarder' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   PAGE
   ════════════════════════════════════════ */
export default function PlanningPage() {
  const { id } = useParams();

  const [trip,           setTrip]           = useState(null);
  const [activities,     setActivities]     = useState([]);
  const [accommodations, setAccommodations] = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [loadError,      setLoadError]      = useState('');
  const [generating,     setGenerating]     = useState(false);
  const [generateMsg,    setGenerateMsg]    = useState('');
  const [askGenerate,    setAskGenerate]    = useState(false);
  const [selectedDay,    setSelectedDay]    = useState(null);
  const [modalInitial,   setModalInitial]   = useState(null);
  const [deleteActivity, setDeleteActivity] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get(`/api/trips/${id}`),
      api.get(`/api/trips/${id}/activities`),
      api.get(`/api/trips/${id}/accommodations`),
    ])
      .then(([t, a, acc]) => {
        if (cancelled) return;
        setTrip(t.data);
        setActivities(a.data);
        setAccommodations(acc.data);
      })
      .catch(err => !cancelled && setLoadError(err.response?.data?.message || 'Impossible de charger le planning.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [id]);

  const days = useMemo(() => trip ? tripDays(trip.startDate, trip.endDate) : [], [trip]);
  const currentDay = days.includes(selectedDay) ? selectedDay : days[0];

  const countByDay = useMemo(() => {
    const m = {};
    activities.forEach(a => { m[a.date] = (m[a.date] ?? 0) + 1; });
    return m;
  }, [activities]);

  /* Budget : transport + logements + activités, comparé au budget prévu (peut devenir négatif) */
  const costs = useMemo(() => {
    const act   = activities.reduce((sum, a) => sum + (a.price ?? 0), 0);
    const accom = accommodations.reduce((sum, a) => sum + (a.price ?? 0), 0);
    const trans = trip?.computedTotalCost ?? 0;
    return { act, accom, trans, total: act + accom + trans };
  }, [activities, accommodations, trip]);

  const remaining = trip?.budget != null ? trip.budget - costs.total : null;

  const runGenerate = async (replaceAuto) => {
    setAskGenerate(false);
    setGenerating(true);
    setGenerateMsg('');
    try {
      // Coordonnées de la destination pour proposer des lieux de la carte à proximité
      const coords = await geocode(trip.destination);
      const { data } = await api.post(`/api/trips/${id}/activities/generate`, { ...coords, replaceAuto });
      setActivities(data.activities);
      setGenerateMsg(data.created === 0
        ? 'Tous les créneaux du matin et du midi sont déjà remplis.'
        : `${data.created} activité${data.created > 1 ? 's' : ''} ajoutée${data.created > 1 ? 's' : ''}.`);
    } catch (err) {
      setGenerateMsg(err.response?.data?.message || 'Impossible de générer le planning.');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerate = () => {
    if (activities.some(a => a.isAuto)) setAskGenerate(true);
    else runGenerate(false);
  };

  const handleSaved = (activity) => {
    setActivities(prev => prev.some(a => a.id === activity.id)
      ? prev.map(a => a.id === activity.id ? activity : a)
      : [...prev, activity]);
    setSelectedDay(activity.date);
    setModalInitial(null);
  };

  const confirmDelete = async () => {
    const target = deleteActivity;
    setDeleteActivity(null);
    try {
      await api.delete(`/api/trips/${id}/activities/${target.id}`);
      setActivities(prev => prev.filter(a => a.id !== target.id));
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="trips-page">
        <Navbar />
        <div style={{ textAlign: 'center', padding: 80 }}><span className="spinner dark" /></div>
      </div>
    );
  }

  if (loadError || !trip) {
    return (
      <div className="trips-page">
        <Navbar />
        <main className="trips-main">
          <div className="trips-empty">
            <h2>{loadError || 'Voyage introuvable.'}</h2>
            <Link to="/trips" className="btn btn-primary">← Retour à mes voyages</Link>
          </div>
        </main>
      </div>
    );
  }

  const dayActivities = activities.filter(a => a.date === currentDay);
  const dayIndex = days.indexOf(currentDay);

  return (
    <div className="trips-page">
      <Navbar />

      <main className="trips-main">
        <Link to="/trips" className="planning-back">← Mes voyages</Link>
        <div className="trips-header">
          <div>
            <h1>Planning · {trip.destination}</h1>
            <p>
              {days.length} jour{days.length > 1 ? 's' : ''} · {activities.length} activité{activities.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="planning-layout">
          {/* ── Colonne latérale : budget + auto-remplissage ── */}
          <aside className="planning-side">
            <div className="trip-card-costs planning-budget">
              <div className="trip-cost-row"><span className="trip-cost-label">🎯 Activités</span><span className="trip-cost-value">{fmtEur(costs.act)}</span></div>
              <div className="trip-cost-row"><span className="trip-cost-label">🏨 Logements</span><span className="trip-cost-value">{fmtEur(costs.accom)}</span></div>
              <div className="trip-cost-row"><span className="trip-cost-label">🚗 Transport</span><span className="trip-cost-value">{fmtEur(costs.trans)}</span></div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '2px 0' }} />
              <div className="trip-cost-row trip-cost-total">
                <span className="trip-cost-label">Total estimé</span>
                <span className="trip-cost-value">{fmtEur(costs.total)}</span>
              </div>
              {remaining != null && (
                <div className="trip-cost-row">
                  <span className="trip-cost-label">Budget restant (sur {fmtEur(trip.budget)})</span>
                  <span className={`trip-cost-value ${remaining < 0 ? 'planning-negative' : 'planning-positive'}`}>{fmtEur(remaining)}</span>
                </div>
              )}
            </div>

            <button className="btn btn-primary planning-generate" disabled={generating} onClick={handleGenerate}>
              {generating ? 'Génération...' : '✨ Remplir automatiquement'}
            </button>
            <p className="planning-hint">2 activités par jour (matin + midi) selon vos préférences et les lieux de la carte.</p>
            {generateMsg && <div className="fuel-preview">{generateMsg}</div>}
          </aside>

          {/* ── Calendrier + journée ── */}
          <section className="planning-main">
            <div className="planning-days">
              {days.map((d, i) => (
                <button key={d} type="button"
                  className={`planning-day${d === currentDay ? ' active' : ''}`}
                  onClick={() => setSelectedDay(d)}>
                  <span className="planning-day-week">{fmtDay(d, { weekday: 'short' })}</span>
                  <span className="planning-day-num">{fmtDay(d, { day: '2-digit' })}</span>
                  <span className="planning-day-week">J{i + 1}</span>
                  <span className={`planning-day-dot${countByDay[d] ? '' : ' empty'}`} />
                </button>
              ))}
            </div>

            <h2 className="planning-day-title">
              Jour {dayIndex + 1} — {fmtDay(currentDay, { weekday: 'long', day: 'numeric', month: 'long' })}
            </h2>

            {SLOTS.map(sl => {
              const items = dayActivities.filter(a => a.slot === sl.value);
              return (
                <div key={sl.value} className="planning-slot">
                  <div className="planning-slot-header">
                    <h3>{sl.icon} {sl.label}</h3>
                    <button type="button" onClick={() => setModalInitial({ date: currentDay, slot: sl.value })}>+ Ajouter</button>
                  </div>
                  {items.length === 0 ? (
                    <div className="planning-slot-empty">Rien de prévu</div>
                  ) : items.map(a => (
                    <div key={a.id} className="planning-activity" onClick={() => setModalInitial(a)}>
                      <span className="planning-activity-icon">{catIcon(a.category)}</span>
                      <div className="planning-activity-body">
                        <strong>{a.title}</strong>
                        {a.description && <p>{a.description}</p>}
                        <div className="planning-activity-meta">
                          {a.price != null && <span>💰 {fmtEur(a.price)}</span>}
                          {a.hasSpecialPrice && <span className="accom-badge">🏷 {a.specialPriceNote || 'Prix spécial'}</span>}
                          {a.isAuto && <span className="accom-badge planning-badge-auto">✨ Suggestion</span>}
                        </div>
                      </div>
                      <button type="button" className="planning-activity-rm" title="Supprimer"
                        onClick={(e) => { e.stopPropagation(); setDeleteActivity(a); }}>✕</button>
                    </div>
                  ))}
                </div>
              );
            })}
          </section>
        </div>
      </main>

      {modalInitial && (
        <ActivityModal
          tripId={id}
          days={days}
          initial={modalInitial}
          onClose={() => setModalInitial(null)}
          onSaved={handleSaved}
        />
      )}

      {askGenerate && (
        <div className="trip-confirm-overlay">
          <div className="trip-confirm-box">
            <h3>Remplir le planning</h3>
            <p>Vos activités ajoutées ou modifiées à la main sont toujours conservées.</p>
            <div className="planning-confirm-actions">
              <button className="btn btn-primary" style={{ padding: '10px' }} onClick={() => runGenerate(false)}>
                Compléter les créneaux vides
              </button>
              <button className="btn btn-outline" style={{ padding: '10px' }} onClick={() => runGenerate(true)}>
                Refaire les suggestions
              </button>
              <button className="btn btn-ghost" style={{ padding: '10px' }} onClick={() => setAskGenerate(false)}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteActivity && (
        <div className="trip-confirm-overlay">
          <div className="trip-confirm-box">
            <h3>Supprimer cette activité ?</h3>
            <p>« {deleteActivity.title} »</p>
            <div className="trip-confirm-actions">
              <button className="btn btn-outline" style={{ padding: '10px' }} onClick={() => setDeleteActivity(null)}>Annuler</button>
              <button className="btn btn-primary" style={{ padding: '10px', background: '#dc2626' }} onClick={confirmDelete}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
