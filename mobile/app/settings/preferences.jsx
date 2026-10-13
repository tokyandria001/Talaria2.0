import { useState, useRef } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { SettingsPage, Section, SwitchRow, Chips, Label, ValueSlider } from '../../components/settings/SettingsUI';
import { ACTIVITY_TAGS } from '../../constants/Preferences';
import { TRANSPORTS, ACCOMMODATIONS, DIETS } from '../../constants/Settings';

const INTERESTS = ACTIVITY_TAGS.map(t => ({ value: t.value, label: t.label.replace(/^\S+\s/, '') }));
const DIET_OPTIONS = [{ value: 'aucun', label: 'Aucun' }, ...DIETS];

/**
 * Préférences de voyage (maquette 32). Enregistrement automatique à chaque choix ;
 * elles servent au planning automatique et aux recommandations de lieux.
 */
export default function PreferencesScreen() {
  const { user, updateProfile } = useAuth();
  const [tags, setTags] = useState(user?.activityTags ?? []);
  const [budget, setBudget] = useState(user?.averageBudget ?? 300);
  const [prefs, setPrefs] = useState(user?.travelPreferences ?? { transports: [], accommodations: [], diets: [] });
  const saving = useRef(Promise.resolve());

  // Enregistrements à la suite (pas de réponses qui se croisent)
  const save = (payload) => {
    saving.current = saving.current.then(() => updateProfile(payload)).catch(() => {
      Alert.alert('Préférences', "Impossible d'enregistrer ce choix.");
    });
  };

  const setPref = (key, value) => {
    setPrefs(p => ({ ...p, [key]: value }));
    save({ travelPreferences: { [key]: value } });
  };

  const diets = prefs.diets?.length ? prefs.diets : ['aucun'];
  const pickDiets = (list) => {
    // « Aucun » choisi après un régime : on vide ; un régime choisi : « Aucun » disparaît
    const added = list.find(v => !diets.includes(v));
    setPref('diets', added === 'aucun' ? [] : list.filter(v => v !== 'aucun'));
  };

  return (
    <SettingsPage title="Préférences">
      <Label style={{ marginTop: 8 }}>Centres d'intérêt</Label>
      <Chips options={INTERESTS} selected={tags} onChange={(v) => { setTags(v); save({ activityTags: v }); }} />

      <Label>Budget habituel par voyage</Label>
      <ValueSlider min={100} max={1000} step={50} value={budget} format={(v) => `${v} €`}
        onChange={setBudget} onDone={(v) => save({ averageBudget: v })} />

      <Label>Transport préféré</Label>
      <Chips options={TRANSPORTS} selected={prefs.transports} onChange={(v) => setPref('transports', v)} />

      <Label>Hébergement préféré</Label>
      <Chips options={ACCOMMODATIONS} selected={prefs.accommodations} onChange={(v) => setPref('accommodations', v)} />

      <Label>Régime alimentaire</Label>
      <Chips options={DIET_OPTIONS} selected={diets} onChange={pickDiets} />

      <Section>
        <SwitchRow icon="leaf-outline" title="Privilégier les options éco-responsables" subtitle="Trains, hébergements labellisés"
          value={prefs.ecoFriendly} onChange={(v) => setPref('ecoFriendly', v)} />
        <SwitchRow icon="airplane-outline" title="Vols directs uniquement"
          value={prefs.directFlightsOnly} onChange={(v) => setPref('directFlightsOnly', v)} />
      </Section>
    </SettingsPage>
  );
}
