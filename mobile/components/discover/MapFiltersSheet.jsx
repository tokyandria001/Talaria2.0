import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import BottomSheet, { Chip, SheetLabel } from '../BottomSheet';
import RangeSlider from './RangeSlider';
import { comingSoon } from '../AuthUI';
import { Colors } from '../../constants/Colors';
import { FILTER_CATEGORIES, distanceMeters } from '../../constants/PlaceCategories';

export const BUDGET_MAX = 100; // « 100 € + » = pas de plafond
const DISTANCES = [
  { value: 500,  label: '500 m' },
  { value: 1000, label: '1 km' },
  { value: 5000, label: '5 km' },
  { value: null, label: '10 km +' },
];

export const DEFAULT_FILTERS = { categories: [], budget: [0, BUDGET_MAX], distance: null };

/** Applique les filtres (côté client) à la liste des lieux */
export function applyFilters(places, filters, userLoc) {
  const tags = FILTER_CATEGORIES.filter(c => filters.categories.includes(c.value)).flatMap(c => c.tags);
  const [low, high] = filters.budget;
  return places.filter(p => {
    if (tags.length && !(p.tags ?? []).some(t => tags.includes(t))) return false;
    if (low > 0 || high < BUDGET_MAX) {
      if (p.averagePrice == null) return false;
      if (p.averagePrice < low || (high < BUDGET_MAX && p.averagePrice > high)) return false;
    }
    if (filters.distance && userLoc && distanceMeters(userLoc, p) > filters.distance) return false;
    return true;
  });
}

export default function MapFiltersSheet({ visible, filters, places, userLoc, onApply, onClose }) {
  const [draft, setDraft] = useState(filters);
  useEffect(() => { if (visible) setDraft(filters); }, [visible, filters]);

  const toggleCategory = (value) => setDraft(d => ({
    ...d,
    categories: d.categories.includes(value) ? d.categories.filter(c => c !== value) : [...d.categories, value],
  }));

  const count = applyFilters(places, draft, userLoc).length;

  return (
    <BottomSheet
      visible={visible}
      title="Filtres"
      onClose={onClose}
      footer={(
        <View style={s.footer}>
          <TouchableOpacity style={s.reset} onPress={() => setDraft(DEFAULT_FILTERS)}>
            <Text style={s.resetText}>Réinitialiser</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.apply} onPress={() => onApply(draft)}>
            <Text style={s.applyText}>Voir {count} lieu{count > 1 ? 'x' : ''}</Text>
          </TouchableOpacity>
        </View>
      )}
    >
      <SheetLabel style={{ marginTop: 4 }}>Catégories</SheetLabel>
      <View style={s.chips}>
        {FILTER_CATEGORIES.map(c => (
          <Chip key={c.value} label={c.plural} active={draft.categories.includes(c.value)} onPress={() => toggleCategory(c.value)} />
        ))}
      </View>

      <SheetLabel>Budget par personne</SheetLabel>
      <RangeSlider
        min={0} max={BUDGET_MAX} step={5}
        low={draft.budget[0]} high={draft.budget[1]}
        onChange={(l, h) => setDraft(d => ({ ...d, budget: [l, h] }))}
        format={(v) => (v >= BUDGET_MAX ? `${v} € +` : `${v} €`)}
      />

      <SheetLabel>Distance</SheetLabel>
      <View style={s.chips}>
        {DISTANCES.map(d => (
          <Chip
            key={d.label} label={d.label}
            active={draft.distance === d.value}
            disabled={!userLoc && d.value !== null}
            onPress={() => setDraft(f => ({ ...f, distance: d.value }))}
          />
        ))}
      </View>
      {!userLoc && <Text style={s.hint}>Activez la localisation pour filtrer par distance.</Text>}

      <SheetLabel>Préférences</SheetLabel>
      <PrefRow title="Ouvert maintenant" subtitle="Bientôt disponible" value={false} onChange={() => comingSoon('Le filtre « Ouvert maintenant »')} />
      <PrefRow title="Lieux éco-responsables" subtitle="Label vert vérifié par Talaria — bientôt" value={false} onChange={() => comingSoon('Le label éco-responsable')} />
    </BottomSheet>
  );
}

function PrefRow({ title, subtitle, value, onChange }) {
  return (
    <View style={s.pref}>
      <View style={{ flex: 1 }}>
        <Text style={s.prefTitle}>{title}</Text>
        {subtitle ? <Text style={s.prefSub}>{subtitle}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} thumbColor={Colors.white} trackColor={{ true: Colors.parme, false: '#d9cfd4' }} />
    </View>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 6 },

  pref:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  prefTitle: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text },
  prefSub:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 1 },

  footer: { flexDirection: 'row', gap: 12 },
  reset:  { flex: 1, borderWidth: 1.5, borderColor: Colors.parme, borderRadius: 100, paddingVertical: 14, alignItems: 'center' },
  resetText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.parme },
  apply:  { flex: 1, backgroundColor: Colors.parme, borderRadius: 100, paddingVertical: 14, alignItems: 'center' },
  applyText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.white },
});
