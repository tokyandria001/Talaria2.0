/**
 * Style de la carte : le même que le site app.talaria.world (js/app.js, initMap).
 * Tuiles et polices OpenFreeMap (gratuites, sans clé), bâtiments en 3D à partir du zoom 14.
 * Si le style du site change, reporter les modifications ici.
 *
 * Crédits obligatoires (affichés sur la carte) : OpenFreeMap © OpenMapTiles, données © OpenStreetMap.
 */
const colors = {
  background: '#f8fafc',
  water: '#a5d8ff',
  waterDark: '#74c0fc',
  landuse: '#e9f5e9',
  park: '#d8f5d8',
  building: '#e2e8f0',
  roadMain: '#ffffff',
  roadSecondary: '#f1f5f9',
  roadOutline: '#e2e8f0',
  railway: '#94a3b8',
  text: '#334155',
  textHalo: '#ffffff',
};

/** Nom en français, sinon en alphabet latin, sinon le nom local */
const NAME = ['coalesce', ['get', 'name:fr'], ['get', 'name:latin'], ['get', 'name']];

export const MAP_ATTRIBUTION = 'OpenFreeMap © OpenMapTiles · © les contributeurs OpenStreetMap';

export const MAP_STYLE = {
  version: 8,
  sources: {
    openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
  },
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': colors.background } },
    {
      id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water',
      paint: { 'fill-color': colors.water, 'fill-outline-color': colors.waterDark },
    },
    {
      id: 'landuse-park', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse',
      filter: ['in', 'class', 'park', 'grass', 'cemetery'],
      paint: { 'fill-color': colors.park, 'fill-opacity': 0.7 },
    },
    {
      id: 'landuse-forest', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse',
      filter: ['==', 'class', 'wood'],
      paint: { 'fill-color': colors.landuse, 'fill-opacity': 0.6 },
    },
    // Bâtiments à plat jusqu'au zoom 14, en 3D ensuite (dernière couche)
    {
      id: 'building', type: 'fill', source: 'openmaptiles', 'source-layer': 'building', maxzoom: 14,
      paint: { 'fill-color': colors.building, 'fill-outline-color': '#cbd5e1' },
    },
    {
      id: 'road-outline', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      filter: ['in', 'class', 'motorway', 'trunk', 'primary', 'secondary', 'tertiary'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': colors.roadOutline, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1, 12, 4, 18, 20] },
    },
    {
      id: 'road-main', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      filter: ['in', 'class', 'motorway', 'trunk', 'primary'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': colors.roadMain, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 12, 3, 18, 16] },
    },
    {
      id: 'road-secondary', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      filter: ['in', 'class', 'secondary', 'tertiary', 'minor', 'service'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': colors.roadSecondary, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 14, 2, 18, 10] },
    },
    {
      id: 'railway', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      filter: ['==', 'class', 'rail'],
      paint: { 'line-color': colors.railway, 'line-width': 1.5, 'line-dasharray': [3, 3] },
    },
    {
      id: 'place-labels', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
      filter: ['in', 'class', 'city', 'town', 'village'],
      layout: {
        'text-field': NAME,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'],
          4, ['match', ['get', 'class'], 'city', 12, 8],
          10, ['match', ['get', 'class'], 'city', 18, 'town', 14, 11],
        ],
        'text-max-width': 8,
      },
      paint: { 'text-color': colors.text, 'text-halo-color': colors.textHalo, 'text-halo-width': 1.5 },
    },
    {
      id: 'country-labels', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
      filter: ['==', 'class', 'country'],
      layout: {
        'text-field': NAME,
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 2, 10, 6, 16],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.1,
      },
      paint: { 'text-color': '#64748b', 'text-halo-color': colors.textHalo, 'text-halo-width': 2 },
    },
    {
      id: '3d-buildings', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 14,
      paint: {
        'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'render_height'], 0, '#e2e8f0', 50, '#cbd5e1', 100, '#94a3b8'],
        'fill-extrusion-height': ['get', 'render_height'],
        'fill-extrusion-base': ['get', 'render_min_height'],
        'fill-extrusion-opacity': 0.85,
      },
    },
  ],
};
