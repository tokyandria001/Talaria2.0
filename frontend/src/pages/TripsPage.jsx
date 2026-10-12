import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import './TripsPage.css';

const TRANSPORT_OPTIONS = [
  { value: 'voiture', label: 'Voiture', icon: '🚗' },
  { value: 'avion',   label: 'Avion',   icon: '✈️' },
  { value: 'train',   label: 'Train',   icon: '🚄' },
  { value: 'bus',     label: 'Bus',     icon: '🚌' },
];

const BOOKING_TYPES = [
  { value: 'vol',      label: 'Vol',      icon: '✈️' },
  { value: 'hotel',    label: 'Hôtel',    icon: '🏨' },
  { value: 'activite', label: 'Activité', icon: '🎯' },
  { value: 'autre',    label: 'Autre',    icon: '🔗' },
];

const ACCOM_TYPES = [
  { value: 'hotel',  label: 'Hôtel',  icon: '🏨' },
  { value: 'airbnb', label: 'Airbnb', icon: '🏠' },
  { value: 'autre',  label: 'Autre',  icon: '🔗' },
];

const EMPTY_ACCOM = {
  name: '', type: 'hotel', checkIn: '', checkOut: '',
  price: '', hasSpecialPrice: false, specialPriceNote: '', link: '',
};

const fmtDate = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
/** Ajoute https:// si l'utilisateur a saisi un lien sans protocole (ex. booking.com/...) */
const withScheme = (u) => { const v = (u ?? '').trim(); return v && !/^[a-z][a-z0-9+.-]*:/i.test(v) ? `https://${v}` : v; };
const fmtEur  = (n) => n != null ? `${n.toLocaleString('fr-FR')} €` : '—';
const nights  = (s, e) => Math.max(0, Math.round((new Date(e) - new Date(s)) / 86_400_000));
const transportIcon = (v) => TRANSPORT_OPTIONS.find(t => t.value === v)?.icon ?? '✈️';
const transportLabel = (v) => TRANSPORT_OPTIONS.find(t => t.value === v)?.label ?? v;

/* ── Fuel calculator ───────────────────── */
function computeFuel(distanceKm, fuelPrice, consumption) {
  const d = parseFloat(distanceKm);
  const p = parseFloat(fuelPrice);
  const c = parseFloat(consumption);
  if (!d || !p || !c) return null;
  return Math.round((d * 2) * (c / 100) * p);
}

/* ════════════════════════════════════════
   LOGEMENTS (étape 4 du modal, voyage existant)
   ════════════════════════════════════════ */
function AccommodationsStep({ trip }) {
  const [accommodations, setAccommodations] = useState([]);
  const [form,           setForm]           = useState(EMPTY_ACCOM);
  const [editingId,      setEditingId]      = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState('');

  useEffect(() => {
    api.get(`/api/trips/${trip.id}/accommodations`)
      .then(res => setAccommodations(res.data))
      .catch(() => setAccommodations([]));
  }, [trip.id]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const reset = () => { setForm(EMPTY_ACCOM); setEditingId(null); setError(''); };

  const startEdit = (a) => {
    setForm({
      name: a.name, type: a.type, checkIn: a.checkIn, checkOut: a.checkOut,
      price: a.price ?? '', hasSpecialPrice: a.hasSpecialPrice,
      specialPriceNote: a.specialPriceNote ?? '', link: a.link ?? '',
    });
    setEditingId(a.id);
    setError('');
  };

  const save = async () => {
    if (!form.name.trim() || !form.checkIn || !form.checkOut) {
      setError('Nom et dates sont requis.');
      return;
    }
    setSaving(true); setError('');
    try {
      const payload = { ...form, link: withScheme(form.link), price: form.price !== '' ? +form.price : null };
      const res = editingId
        ? await api.patch(`/api/trips/${trip.id}/accommodations/${editingId}`, payload)
        : await api.post(`/api/trips/${trip.id}/accommodations`, payload);
      setAccommodations(prev => {
        const next = editingId ? prev.map(a => a.id === res.data.id ? res.data : a) : [...prev, res.data];
        return [...next].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
      });
      reset();
    } catch (err) {
      setError(err.response?.data?.message || "Impossible d'enregistrer le logement.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a) => {
    if (!window.confirm(`Supprimer le logement « ${a.name} » ?`)) return;
    try {
      await api.delete(`/api/trips/${trip.id}/accommodations/${a.id}`);
      setAccommodations(prev => prev.filter(x => x.id !== a.id));
      if (editingId === a.id) reset();
    } catch { /* ignore */ }
  };

  return (
    <>
      {accommodations.length > 0 && (
        <div className="accom-list">
          {accommodations.map(a => (
            <div key={a.id} className="accom-card">
              <div className="accom-card-header">
                <strong>{ACCOM_TYPES.find(t => t.value === a.type)?.icon} {a.name}</strong>
                <div className="accom-card-actions">
                  <button type="button" onClick={() => startEdit(a)}>Modifier</button>
                  <button type="button" className="danger" onClick={() => remove(a)}>Supprimer</button>
                </div>
              </div>
              <div className="accom-card-dates">
                {fmtDate(a.checkIn)} → {fmtDate(a.checkOut)}
                <span> ({nights(a.checkIn, a.checkOut)} nuit{nights(a.checkIn, a.checkOut) > 1 ? 's' : ''})</span>
              </div>
              <div className="accom-card-meta">
                {a.price != null && <span>💰 {fmtEur(a.price)}</span>}
                {a.hasSpecialPrice && <span className="accom-badge">🏷 {a.specialPriceNote || 'Prix spécial'}</span>}
                {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer">🔗 Lien</a>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="trip-field">
        <label className="trip-label">{editingId ? 'Modifier le logement' : 'Ajouter un logement'}</label>
        <input className="trip-input" placeholder="Nom (ex: Hôtel Roma)" value={form.name} onChange={set('name')} />
      </div>

      <div className="transport-pills">
        {ACCOM_TYPES.map(t => (
          <button key={t.value} type="button"
            className={`transport-pill${form.type === t.value ? ' active' : ''}`}
            onClick={() => setForm(f => ({ ...f, type: t.value }))}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="trip-row">
        <div className="trip-field">
          <label className="trip-label">Arrivée</label>
          <input className="trip-input" type="date" min={trip.startDate} max={trip.endDate}
            value={form.checkIn} onChange={set('checkIn')} />
        </div>
        <div className="trip-field">
          <label className="trip-label">Départ</label>
          <input className="trip-input" type="date" min={form.checkIn || trip.startDate} max={trip.endDate}
            value={form.checkOut} onChange={set('checkOut')} />
        </div>
      </div>

      <div className="trip-row">
        <div className="trip-field">
          <label className="trip-label">Prix <span>(€, optionnel)</span></label>
          <input className="trip-input" type="number" min="0" placeholder="250" value={form.price} onChange={set('price')} />
        </div>
        <div className="trip-field">
          <label className="trip-label">Lien <span>(Airbnb, Booking...)</span></label>
          <input className="trip-input" placeholder="https://..." value={form.link} onChange={set('link')} />
        </div>
      </div>

      <div className="trip-field">
        <div className="trip-check-row">
          <input type="checkbox" id="accom-special" checked={form.hasSpecialPrice} onChange={set('hasSpecialPrice')} />
          <label htmlFor="accom-special" className="trip-check-label">Prix spécial (réduction CE, code promo...)</label>
        </div>
        {form.hasSpecialPrice && (
          <input className="trip-input" placeholder="Ex: -20% code CE2026"
            value={form.specialPriceNote} onChange={set('specialPriceNote')} />
        )}
      </div>

      {error && <div className="trip-error">{error}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        {editingId && (
          <button type="button" className="btn btn-outline" style={{ padding: '10px 20px' }} onClick={reset}>Annuler</button>
        )}
        <button type="button" className="btn btn-primary" style={{ padding: '10px 20px', flex: 1 }}
          disabled={saving} onClick={save}>
          {saving ? 'Enregistrement...' : editingId ? 'Mettre à jour' : '+ Ajouter le logement'}
        </button>
      </div>
    </>
  );
}

/* ════════════════════════════════════════
   MODAL — 4 steps
   ════════════════════════════════════════ */
const EMPTY_FORM = {
  title: '', destination: '', departureCity: '',
  startDate: '', endDate: '', travelers: 2, budget: '',
  transportMode: 'avion',
  distanceKm: '', fuelPricePerLiter: '', fuelConsumption: '', tollCost: '',
  needsRental: false, rentalLink: '', rentalCost: '',
  bookingLinks: [],
};

function TripModal({ trip, onClose, onSaved }) {
  const isEdit = !!trip;
  const [step,    setStep]    = useState(0);
  const [form,    setForm]    = useState(isEdit ? {
    title:            trip.title            ?? '',
    destination:      trip.destination,
    departureCity:    trip.departureCity,
    startDate:        trip.startDate,
    endDate:          trip.endDate,
    travelers:        trip.travelers,
    budget:           trip.budget           ?? '',
    transportMode:    trip.transportMode,
    distanceKm:       trip.distanceKm       ?? '',
    fuelPricePerLiter:trip.fuelPricePerLiter ?? '',
    fuelConsumption:  trip.fuelConsumption  ?? '',
    tollCost:         trip.tollCost         ?? '',
    needsRental:      trip.needsRental,
    rentalLink:       trip.rentalLink       ?? '',
    rentalCost:       trip.rentalCost       ?? '',
    bookingLinks:     trip.bookingLinks     ?? [],
  } : { ...EMPTY_FORM });

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // Booking link draft
  const [bType, setBType]   = useState('hotel');
  const [bLabel, setBLabel] = useState('');
  const [bUrl,   setBUrl]   = useState('');

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target ? e.target.value : e }));
  const setCheck = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.checked }));

  const fuelPreview = computeFuel(form.distanceKm, form.fuelPricePerLiter, form.fuelConsumption);

  const addBooking = () => {
    if (!bUrl.trim()) return;
    const label = bLabel.trim() || BOOKING_TYPES.find(t => t.value === bType)?.label || bType;
    setForm(f => ({ ...f, bookingLinks: [...f.bookingLinks, { type: bType, label, url: withScheme(bUrl) }] }));
    setBLabel(''); setBUrl('');
  };

  const removeBooking = (i) => {
    setForm(f => ({ ...f, bookingLinks: f.bookingLinks.filter((_, j) => j !== i) }));
  };

  const canNext = () => {
    if (step === 0) return form.destination.trim() && form.departureCity.trim() && form.startDate && form.endDate;
    return true;
  };

  const handleSubmit = async () => {
    setError(''); setLoading(true);
    try {
      const payload = {
        ...form,
        budget:           form.budget           !== '' ? +form.budget           : null,
        distanceKm:       form.distanceKm       !== '' ? +form.distanceKm       : null,
        fuelPricePerLiter:form.fuelPricePerLiter !== '' ? +form.fuelPricePerLiter : null,
        fuelConsumption:  form.fuelConsumption  !== '' ? +form.fuelConsumption  : null,
        tollCost:         form.tollCost         !== '' ? +form.tollCost         : null,
        rentalCost:       form.rentalCost       !== '' ? +form.rentalCost       : null,
        rentalLink:       withScheme(form.rentalLink),
      };
      const res = isEdit
        ? await api.patch(`/api/trips/${trip.id}`, payload)
        : await api.post('/api/trips', payload);
      onSaved(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur serveur.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="trip-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="trip-modal">
        {/* Header */}
        <div className="trip-modal-header">
          <div>
            <h2>{isEdit ? 'Modifier le voyage' : 'Nouveau voyage'}</h2>
            <p>
              {step === 0 && 'Infos de base'}
              {step === 1 && 'Transport'}
              {step === 2 && 'Réservations'}
              {step === 3 && 'Logements'}
            </p>
          </div>
          <button className="trip-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Steps */}
        <div className="trip-steps">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`trip-step-dot ${i < step ? 'done' : i === step ? 'active' : ''}`} />
          ))}
        </div>

        {/* ── Step 0 : infos de base ── */}
        {step === 0 && (
          <>
            <div className="trip-row">
              <div className="trip-field">
                <label className="trip-label">Ville de départ</label>
                <input className="trip-input" placeholder="Paris" value={form.departureCity} onChange={set('departureCity')} />
              </div>
              <div className="trip-field">
                <label className="trip-label">Destination</label>
                <input className="trip-input" placeholder="Rome" value={form.destination} onChange={set('destination')} />
              </div>
            </div>

            <div className="trip-row">
              <div className="trip-field">
                <label className="trip-label">Départ</label>
                <input className="trip-input" type="date" value={form.startDate} onChange={set('startDate')} />
              </div>
              <div className="trip-field">
                <label className="trip-label">Retour</label>
                <input className="trip-input" type="date" value={form.endDate} onChange={set('endDate')} />
              </div>
            </div>

            <div className="trip-row">
              <div className="trip-field">
                <label className="trip-label">Voyageurs</label>
                <input className="trip-input" type="number" min="1" max="20" value={form.travelers} onChange={set('travelers')} />
              </div>
              <div className="trip-field">
                <label className="trip-label">Budget prévu <span>(€, optionnel)</span></label>
                <input className="trip-input" type="number" min="0" placeholder="1200" value={form.budget} onChange={set('budget')} />
              </div>
            </div>

            <div className="trip-field">
              <label className="trip-label">Nom du voyage <span>(optionnel)</span></label>
              <input className="trip-input" placeholder="Week-end à Rome" value={form.title} onChange={set('title')} />
            </div>
          </>
        )}

        {/* ── Step 1 : transport ── */}
        {step === 1 && (
          <>
            <div className="trip-field">
              <label className="trip-label">Moyen de transport</label>
              <div className="transport-pills">
                {TRANSPORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`transport-pill${form.transportMode === opt.value ? ' active' : ''}`}
                    onClick={() => setForm(f => ({ ...f, transportMode: opt.value }))}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {form.transportMode === 'voiture' && (
              <div className="car-fields">
                <div className="trip-row">
                  <div className="trip-field">
                    <label className="trip-label">Distance aller (km)</label>
                    <input className="trip-input" type="number" min="0" placeholder="500"
                      value={form.distanceKm} onChange={set('distanceKm')} />
                  </div>
                  <div className="trip-field">
                    <label className="trip-label">Prix carburant (€/L)</label>
                    <input className="trip-input" type="number" min="0" step="0.001" placeholder="1.85"
                      value={form.fuelPricePerLiter} onChange={set('fuelPricePerLiter')} />
                  </div>
                </div>

                <div className="trip-row">
                  <div className="trip-field">
                    <label className="trip-label">Conso. (L/100km)</label>
                    <input className="trip-input" type="number" min="0" step="0.1" placeholder="6.5"
                      value={form.fuelConsumption} onChange={set('fuelConsumption')} />
                  </div>
                  <div className="trip-field">
                    <label className="trip-label">Péages A/R (€)</label>
                    <input className="trip-input" type="number" min="0" placeholder="40"
                      value={form.tollCost} onChange={set('tollCost')} />
                  </div>
                </div>

                {fuelPreview !== null && (
                  <div className="fuel-preview">
                    ⛽ Coût carburant A/R estimé : <strong>{fmtEur(fuelPreview)}</strong>
                    {form.tollCost ? ` + péages ${fmtEur(+form.tollCost)} = ${fmtEur(fuelPreview + +form.tollCost)}` : ''}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Step 2 : réservations ── */}
        {step === 2 && (
          <>
            {/* Booking links */}
            <div className="trip-field">
              <label className="trip-label">Liens de réservation <span>(optionnel)</span></label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <select
                  className="trip-input" style={{ width: 110, flexShrink: 0 }}
                  value={bType} onChange={e => setBType(e.target.value)}
                >
                  {BOOKING_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                </select>
                <input className="trip-input" placeholder="Libellé (ex: Hôtel Roma)" value={bLabel} onChange={e => setBLabel(e.target.value)} />
              </div>
              <div className="booking-add-row">
                <input className="trip-input" placeholder="https://booking.com/..." value={bUrl} onChange={e => setBUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addBooking()} />
                <button type="button" className="btn btn-primary" style={{ padding: '9px 16px', flexShrink: 0 }} onClick={addBooking}>
                  Ajouter
                </button>
              </div>
              {form.bookingLinks.length > 0 && (
                <div className="booking-chips">
                  {form.bookingLinks.map((b, i) => (
                    <div key={i} className="booking-chip-edit">
                      {BOOKING_TYPES.find(t => t.value === b.type)?.icon} {b.label}
                      <button className="booking-chip-rm" onClick={() => removeBooking(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rental */}
            <div className="trip-field">
              <div className="trip-check-row">
                <input type="checkbox" id="needs-rental" checked={form.needsRental} onChange={setCheck('needsRental')} />
                <label htmlFor="needs-rental" className="trip-check-label">Besoin d'une location de véhicule sur place ?</label>
              </div>
              {form.needsRental && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                  <div className="trip-row">
                    <div className="trip-field">
                      <label className="trip-label">Coût location (€)</label>
                      <input className="trip-input" type="number" min="0" placeholder="180"
                        value={form.rentalCost} onChange={set('rentalCost')} />
                    </div>
                    <div className="trip-field">
                      <label className="trip-label">Lien loueur <span>(optionnel)</span></label>
                      <input className="trip-input" placeholder="https://rentalcars.com/..." value={form.rentalLink} onChange={set('rentalLink')} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Step 3 : logements ── */}
        {step === 3 && (isEdit ? (
          <AccommodationsStep trip={trip} />
        ) : (
          <div className="fuel-preview">
            Créez d'abord le voyage, puis rouvrez-le avec « Modifier » pour ajouter ses logements
            (road trip = plusieurs logements à des dates différentes).
          </div>
        ))}

        {error && <div className="trip-error">{error}</div>}

        {/* Footer */}
        <div className="trip-modal-footer">
          <button
            className="btn btn-outline"
            style={{ padding: '10px 20px' }}
            onClick={() => step === 0 ? onClose() : setStep(s => s - 1)}
          >
            {step === 0 ? 'Annuler' : '← Retour'}
          </button>

          {step < 3 ? (
            <button
              className="btn btn-primary"
              style={{ padding: '10px 24px' }}
              disabled={!canNext()}
              onClick={() => setStep(s => s + 1)}
            >
              Suivant →
            </button>
          ) : (
            <button
              className="btn btn-primary"
              style={{ padding: '10px 24px' }}
              disabled={loading}
              onClick={handleSubmit}
            >
              {loading ? 'Enregistrement...' : isEdit ? 'Sauvegarder' : 'Créer le voyage'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   TRIP CARD
   ════════════════════════════════════════ */
function TripCard({ trip, onEdit, onDelete, onPlanning }) {
  const n = nights(trip.startDate, trip.endDate);

  return (
    <div className="trip-card">
      <div className="trip-card-header">
        <div>
          <div className="trip-card-dest">{trip.destination}</div>
          {trip.group && <div className="trip-group-tag">👥 {trip.group.name}</div>}
          {trip.title && <div className="trip-card-title">{trip.title}</div>}
        </div>
        <div className="trip-transport-badge">
          {transportIcon(trip.transportMode)} {transportLabel(trip.transportMode)}
        </div>
      </div>

      <div className="trip-card-dates">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
        <span>{fmtDate(trip.startDate)}</span>
        <span className="trip-date-arrow">→</span>
        <span>{fmtDate(trip.endDate)}</span>
        <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>({n} nuit{n > 1 ? 's' : ''})</span>
      </div>

      <div className="trip-card-meta">
        <div className="trip-meta-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <strong>{trip.travelers}</strong> voyageur{trip.travelers > 1 ? 's' : ''}
        </div>
        <div className="trip-meta-item">
          📍 Depuis <strong>{trip.departureCity}</strong>
        </div>
        {trip.budget && (
          <div className="trip-meta-item">
            💰 Budget <strong>{fmtEur(trip.budget)}</strong>
          </div>
        )}
      </div>

      {/* Coûts transport */}
      {(trip.transportMode === 'voiture' && (trip.computedFuelCost || trip.tollCost || trip.rentalCost)) ? (
        <div className="trip-card-costs">
          {trip.computedFuelCost != null && (
            <div className="trip-cost-row">
              <span className="trip-cost-label">⛽ Carburant A/R</span>
              <span className="trip-cost-value">{fmtEur(trip.computedFuelCost)}</span>
            </div>
          )}
          {trip.tollCost != null && (
            <div className="trip-cost-row">
              <span className="trip-cost-label">🛣 Péages</span>
              <span className="trip-cost-value">{fmtEur(trip.tollCost)}</span>
            </div>
          )}
          {trip.needsRental && trip.rentalCost != null && (
            <div className="trip-cost-row">
              <span className="trip-cost-label">🚙 Location</span>
              <span className="trip-cost-value">{fmtEur(trip.rentalCost)}</span>
            </div>
          )}
          {trip.computedTotalCost != null && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '2px 0' }} />
              <div className="trip-cost-row trip-cost-total">
                <span className="trip-cost-label">Total transport</span>
                <span className="trip-cost-value">{fmtEur(trip.computedTotalCost)}</span>
              </div>
            </>
          )}
        </div>
      ) : trip.needsRental && trip.rentalCost ? (
        <div className="trip-card-costs">
          <div className="trip-cost-row">
            <span className="trip-cost-label">🚙 Location sur place</span>
            <span className="trip-cost-value">{fmtEur(trip.rentalCost)}</span>
          </div>
        </div>
      ) : null}

      {/* Booking links */}
      {trip.bookingLinks?.length > 0 && (
        <div className="trip-bookings">
          {trip.bookingLinks.map((b, i) => (
            <a key={i} href={b.url} target="_blank" rel="noopener noreferrer" className="trip-booking-chip">
              {BOOKING_TYPES.find(t => t.value === b.type)?.icon} {b.label}
            </a>
          ))}
          {trip.rentalLink && (
            <a href={trip.rentalLink} target="_blank" rel="noopener noreferrer" className="trip-booking-chip">
              🚙 Location
            </a>
          )}
        </div>
      )}

      <div className="trip-card-actions">
        <button className="trip-action-btn primary" onClick={() => onPlanning(trip)}>📅 Planning</button>
        {/* Voyage de groupe : seuls son créateur et l'organisateur du groupe le modifient */}
        {trip.permissions?.canManage !== false && (
          <>
            <button className="trip-action-btn" onClick={() => onEdit(trip)}>Modifier</button>
            <button className="trip-action-btn danger" onClick={() => onDelete(trip)}>Supprimer</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   PAGE
   ════════════════════════════════════════ */
export default function TripsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [trips,       setTrips]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showCreate,  setShowCreate]  = useState(false);
  const [editTrip,    setEditTrip]    = useState(null);
  const [deleteTrip,  setDeleteTrip]  = useState(null);
  const [deleting,    setDeleting]    = useState(false);

  const fetchTrips = useCallback(async () => {
    try {
      const res = await api.get('/api/trips');
      setTrips(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  const handleSaved = (trip) => {
    setTrips(prev => {
      const idx = prev.findIndex(t => t.id === trip.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = trip; return n; }
      return [trip, ...prev];
    });
    setShowCreate(false);
    setEditTrip(null);
  };

  const handleDelete = async () => {
    if (!deleteTrip) return;
    setDeleting(true);
    try {
      await api.delete(`/api/trips/${deleteTrip.id}`);
      setTrips(prev => prev.filter(t => t.id !== deleteTrip.id));
    } finally {
      setDeleting(false);
      setDeleteTrip(null);
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="trips-page">
      {/* ── Navbar ── */}
      <nav className="trips-nav">
        <div className="trips-nav-inner">
          <Link to="/map"><img src="/Logo-08.png" alt="Talaria" className="trips-logo" /></Link>

          <div className="trips-nav-links">
            <Link to="/map"       className="trips-nav-link">Carte</Link>
            <Link to="/community" className="trips-nav-link">Communauté</Link>
            <Link to="/trips"     className="trips-nav-link active">Voyages</Link>
          </div>

          <div className="trips-nav-right">
            <button className="trips-user-btn" onClick={() => navigate('/profile')}>
              {user?.profilePicture ? (
                <img src={user.profilePicture} alt="avatar"
                  style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div className="trips-avatar">
                  {(user?.firstName?.[0] || user?.email?.[0] || '?').toUpperCase()}
                </div>
              )}
              <span className="trips-username">{user?.firstName || user?.email?.split('@')[0]}</span>
            </button>
            <button className="trips-logout-btn" onClick={handleLogout}>Déconnexion</button>
          </div>
        </div>
      </nav>

      {/* ── Main ── */}
      <main className="trips-main">
        <div className="trips-header">
          <div>
            <h1>Mes voyages</h1>
            <p>{trips.length > 0 ? `${trips.length} voyage${trips.length > 1 ? 's' : ''} planifié${trips.length > 1 ? 's' : ''}` : 'Planifiez votre prochain voyage'}</p>
          </div>
          <button className="btn btn-primary" style={{ padding: '10px 22px', fontSize: 14 }} onClick={() => setShowCreate(true)}>
            + Nouveau voyage
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <span className="spinner dark" />
          </div>
        ) : trips.length === 0 ? (
          <div className="trips-empty">
            <div className="trips-empty-icon">✈️</div>
            <h2>Aucun voyage planifié</h2>
            <p>Créez votre premier voyage et gérez votre budget, vos dates et vos réservations.</p>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              Créer mon premier voyage
            </button>
          </div>
        ) : (
          <div className="trips-grid">
            {trips.map(t => (
              <TripCard
                key={t.id}
                trip={t}
                onEdit={setEditTrip}
                onDelete={setDeleteTrip}
                onPlanning={(trip) => navigate(`/trips/${trip.id}/planning`)}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Modals ── */}
      {showCreate && (
        <TripModal onClose={() => setShowCreate(false)} onSaved={handleSaved} />
      )}
      {editTrip && (
        <TripModal trip={editTrip} onClose={() => setEditTrip(null)} onSaved={handleSaved} />
      )}
      {deleteTrip && (
        <div className="trip-confirm-overlay">
          <div className="trip-confirm-box">
            <h3>Supprimer ce voyage ?</h3>
            <p>"{deleteTrip.destination}" sera définitivement supprimé.</p>
            <div className="trip-confirm-actions">
              <button className="btn btn-outline" style={{ padding: '10px' }} onClick={() => setDeleteTrip(null)}>
                Annuler
              </button>
              <button
                className="btn btn-primary"
                style={{ padding: '10px', background: '#dc2626' }}
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
