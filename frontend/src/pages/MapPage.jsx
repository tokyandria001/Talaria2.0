import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import AddPlaceModal from '../components/AddPlaceModal';
import './MapPage.css';

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

const MAP_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
  : 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

const TERRAIN_SOURCE = MAPTILER_KEY
  ? `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`
  : null;

const CATEGORY_FILTERS = [
  { value: 'restaurant', label: 'Restaurants', icon: '🍽' },
  { value: 'bar',        label: 'Bars',        icon: '🍸' },
  { value: 'hotel',      label: 'Hôtels',      icon: '🛏' },
  { value: 'visite',     label: 'Visites',      icon: '🏛' },
];

const TRANSPORTS = [
  { value: 'voiture', label: 'Voiture', icon: '🚗' },
  { value: 'avion',   label: 'Avion',   icon: '✈️' },
  { value: 'train',   label: 'Train',   icon: '🚄' },
];

const TAG_ICONS = {
  restaurant: '🍽', bar: '🍸', hotel: '🛏', visite: '🏛',
  plage: '🏖', sport: '🏄', culture: '🎨',
};

export default function MapPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const markersRef      = useRef([]);
  const popupsRef       = useRef([]);

  const [mapLoaded,    setMapLoaded]    = useState(false);
  const [is3D,         setIs3D]         = useState(false);
  const [places,       setPlaces]       = useState([]);
  const [activeTags,   setActiveTags]   = useState([]);
  const [search,       setSearch]       = useState('');
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addCoords,    setAddCoords]    = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Sidebar state
  const [from,      setFrom]      = useState('');
  const [to,        setTo]        = useState('');
  const [date,      setDate]      = useState(new Date().toISOString().slice(0, 10));
  const [travelers, setTravelers] = useState(1);
  const [transport, setTransport] = useState('voiture');

  /* ── Init MapLibre ── */
  useEffect(() => {
    if (mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [5, 47.5],
      zoom: 5,
      pitch: 0,
      bearing: 0,
      antialias: true,
    });

    map.on('load', () => {
      /* ── Terrain 3D (MapTiler DEM) ── */
      if (TERRAIN_SOURCE) {
        map.addSource('maptiler-terrain', {
          type: 'raster-dem',
          url: TERRAIN_SOURCE,
          tileSize: 256,
        });

        /* Atmosphère / ciel */
        map.addLayer({
          id: 'sky',
          type: 'sky',
          paint: {
            'sky-type': 'atmosphere',
            'sky-atmosphere-sun': [0, 90],
            'sky-atmosphere-sun-intensity': 15,
            'sky-atmosphere-color': 'rgba(135, 206, 235, 1)',
            'sky-atmosphere-halo-color': 'rgba(255, 165, 0, 0.3)',
            'sky-atmosphere-horizon-blend': 0.04,
          },
        });
      }

      /* ── 3D Buildings ── */
      const buildingSource = MAPTILER_KEY ? 'maptiler_planet' : 'carto';

      /* Vérifier que la source existe avant d'ajouter la couche */
      const sources = map.getStyle().sources;
      const hasSource = Object.keys(sources).includes(buildingSource);

      if (hasSource) {
        map.addLayer({
          id: 'talaria-3d-buildings',
          source: buildingSource,
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 14,
          layout: { visibility: 'none' },
          paint: {
            'fill-extrusion-color': [
              'interpolate', ['linear'],
              ['coalesce', ['get', 'render_height'], ['get', 'height'], 0],
              0,   '#f0dacb',
              15,  '#c9b2d7',
              40,  '#8c5a7e',
              100, '#4f203f',
            ],
            'fill-extrusion-height': [
              'interpolate', ['linear'], ['zoom'],
              14, 0,
              14.5, ['coalesce', ['get', 'render_height'], ['get', 'height'], 8],
            ],
            'fill-extrusion-base': [
              'coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0,
            ],
            'fill-extrusion-opacity': 0.85,
          },
        });
      }

      setMapLoaded(true);
    });

    /* Right-click → add place */
    map.on('contextmenu', (e) => {
      setAddCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      setShowAddModal(true);
    });

    /* Close user menu on map click */
    map.on('click', () => setShowUserMenu(false));

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  /* ── Toggle 3D ── */
  const toggle3D = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const next = !is3D;
    setIs3D(next);

    map.easeTo({ pitch: next ? 60 : 0, bearing: next ? -15 : 0, duration: 900 });

    /* Terrain extrusion MapTiler */
    if (TERRAIN_SOURCE) {
      map.setTerrain(next ? { source: 'maptiler-terrain', exaggeration: 1.5 } : null);
    }

    /* Bâtiments 3D */
    if (map.getLayer('talaria-3d-buildings')) {
      map.setLayoutProperty('talaria-3d-buildings', 'visibility', next ? 'visible' : 'none');
    }
  }, [is3D]);

  /* ── Fetch places ── */
  const fetchPlaces = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeTags.length) params.set('tags', activeTags.join(','));
      if (search)            params.set('search', search);
      const { data } = await api.get(`/api/places?${params}`);
      setPlaces(data.places);
    } catch {/* silently fail if not authenticated yet */}
  }, [activeTags, search]);

  useEffect(() => { fetchPlaces(); }, [fetchPlaces]);

  /* ── Render markers ── */
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    // Clear old markers & popups
    markersRef.current.forEach(m => m.remove());
    popupsRef.current.forEach(p => p.remove());
    markersRef.current = [];
    popupsRef.current = [];

    places.forEach(place => {
      const icon = TAG_ICONS[place.tags?.[0]] || '📍';

      // Custom HTML marker
      const el = document.createElement('div');
      el.className = 'maplibre-marker';
      el.innerHTML = `<span class="marker-icon">${icon}</span>`;

      // Popup
      const popup = new maplibregl.Popup({
        offset: [0, -42],
        closeButton: true,
        closeOnClick: false,
        className: 'talaria-popup',
        maxWidth: '240px',
      }).setHTML(`
        <div class="popup-content">
          <p class="popup-name">${place.name}</p>
          ${place.description ? `<p class="popup-desc">${place.description}</p>` : ''}
          <div class="popup-tags">
            ${place.tags.map(t => `<span class="popup-tag">${TAG_ICONS[t] || ''} ${t}</span>`).join('')}
          </div>
          ${place.averagePrice ? `<p class="popup-price">~${place.averagePrice} €</p>` : ''}
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([place.longitude, place.latitude])
        .setPopup(popup)
        .addTo(mapRef.current);

      markersRef.current.push(marker);
      popupsRef.current.push(popup);
    });
  }, [places, mapLoaded]);

  /* ── Helpers ── */
  const toggleTag = (tag) =>
    setActiveTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const flyTo = (lat, lng, zoom = 14) => {
    mapRef.current?.flyTo({ center: [lng, lat], zoom, essential: true });
  };

  const handleLogout = () => { logout(); navigate('/'); };

  const initials = user
    ? ((user.firstName?.[0] || '') + (user.lastName?.[0] || '') || user.email[0]).toUpperCase()
    : 'GU';

  return (
    <div className="map-page">

      {/* ── Navbar ── */}
      <header className="map-nav">
        <div className="map-nav-inner">
          <div className="map-nav-left">
            <Link to="/">
              <img src="/logo-dark.svg" alt="Talaria" className="map-logo" />
            </Link>
            <div className="map-nav-icons">
              <button className="map-icon-btn active" title="Carte">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              </button>
              <button className="map-icon-btn" title="Mes voyages">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98z"/></svg>
              </button>
              <Link to="/community" className="map-icon-btn" title="Communauté">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
              </Link>
            </div>
          </div>

          <div className="map-search-wrap">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input
              className="map-search"
              placeholder="Rechercher un lieu..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="map-nav-right">
            <button className="btn-voyage" onClick={() => setShowAddModal(true)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Voyage
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

      {/* ── Layout ── */}
      <div className="map-layout">

        {/* Sidebar */}
        <aside className={`map-sidebar${sidebarOpen ? '' : ' map-sidebar--closed'}`}>
          <div className="sidebar-header">
            {sidebarOpen && (
              <div className="sidebar-title-wrap">
                <div className="sidebar-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
                </div>
                <div>
                  <p className="sidebar-title">Planifier</p>
                  <p className="sidebar-sub">Calculez votre itinéraire</p>
                </div>
              </div>
            )}
            <button className="sidebar-toggle" onClick={() => setSidebarOpen(v => !v)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                {sidebarOpen ? <path d="M15 18l-6-6 6-6"/> : <path d="M9 18l6-6-6-6"/>}
              </svg>
            </button>
          </div>

          {sidebarOpen && (
            <div className="sidebar-body">
              {/* Route */}
              <div className="route-inputs">
                <div className="route-row">
                  <span className="route-dot route-dot--from" />
                  <input className="route-input" placeholder="Ville de départ" value={from} onChange={e => setFrom(e.target.value)} />
                </div>
                <div className="route-line" />
                <div className="route-row">
                  <span className="route-dot route-dot--to" />
                  <input className="route-input" placeholder="Ville d'arrivée" value={to} onChange={e => setTo(e.target.value)} />
                  <button className="route-swap" onClick={() => { setFrom(to); setTo(from); }} title="Inverser">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>
                  </button>
                </div>
              </div>

              <button className="add-step-btn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                Ajouter une étape
              </button>

              {/* Fuel label */}
              <p className="sidebar-section-label">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM18 10c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>
                Carburant
              </p>

              {/* Date + Travelers */}
              <div className="sidebar-row-2">
                <div className="sidebar-field">
                  <label className="sidebar-label">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>
                    Date
                  </label>
                  <input type="date" className="sidebar-date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div className="sidebar-field">
                  <label className="sidebar-label">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    Voyageurs
                  </label>
                  <div className="counter">
                    <button onClick={() => setTravelers(v => Math.max(1, v - 1))}>−</button>
                    <span>{travelers}</span>
                    <button onClick={() => setTravelers(v => v + 1)}>+</button>
                  </div>
                </div>
              </div>

              {/* Transport */}
              <p className="sidebar-section-label">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
                Mode de transport
              </p>
              <div className="transport-grid">
                {TRANSPORTS.map(t => (
                  <button
                    key={t.value}
                    className={`transport-btn${transport === t.value ? ' active' : ''}`}
                    onClick={() => setTransport(t.value)}
                  >
                    <span className="transport-icon">{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
                <button className="transport-btn transport-btn--soon" disabled>
                  <span className="transport-icon">⚡</span>
                  <span>Bientôt</span>
                </button>
              </div>

              <button className="search-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                Rechercher
              </button>
            </div>
          )}
        </aside>

        {/* Map area */}
        <div className="map-area">
          {/* Category filters */}
          <div className="category-filters">
            {CATEGORY_FILTERS.map(f => (
              <button
                key={f.value}
                className={`category-pill${activeTags.includes(f.value) ? ' active' : ''}`}
                onClick={() => toggleTag(f.value)}
              >
                <span>{f.icon}</span>
                {f.label}
              </button>
            ))}
          </div>

          {/* MapLibre container */}
          <div ref={mapContainerRef} className="maplibre-container" />

          {/* Custom controls */}
          <div className="map-controls">
            <button
              className={`map-ctrl-btn${is3D ? ' active' : ''}`}
              onClick={toggle3D}
              title={is3D ? 'Vue 2D' : 'Vue 3D'}
            >
              <span style={{ fontSize: 11, fontWeight: 700 }}>{is3D ? '2D' : '3D'}</span>
            </button>
            <div className="map-ctrl-sep" />
            <button className="map-ctrl-btn" onClick={() => mapRef.current?.zoomIn()} title="Zoom +">+</button>
            <button className="map-ctrl-btn" onClick={() => mapRef.current?.zoomOut()} title="Zoom −">−</button>
            <div className="map-ctrl-sep" />
            <button
              className="map-ctrl-btn"
              onClick={() => mapRef.current?.locate?.() || navigator.geolocation.getCurrentPosition(
                pos => flyTo(pos.coords.latitude, pos.coords.longitude)
              )}
              title="Ma position"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>
            </button>
          </div>

          {/* 3D hint */}
          {is3D && (
            <div className="map-3d-hint">
              <span>🌍 Vue 3D{MAPTILER_KEY ? ' · terrain activé' : ''} — clic droit pour ajouter un lieu · Ctrl + glisser pour tourner</span>
            </div>
          )}

        </div>
      </div>

      {showAddModal && (
        <AddPlaceModal
          coords={addCoords}
          onClose={() => { setShowAddModal(false); setAddCoords(null); }}
          onSaved={() => { setShowAddModal(false); setAddCoords(null); fetchPlaces(); }}
        />
      )}
    </div>
  );
}