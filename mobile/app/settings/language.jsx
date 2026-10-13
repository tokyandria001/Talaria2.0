import { Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { SettingsPage, Section, Row, RadioRow, SwitchRow } from '../../components/settings/SettingsUI';
import { LANGUAGES, CURRENCIES } from '../../constants/Settings';
import { Colors } from '../../constants/Colors';

/**
 * Langue & devise (maquette 33). Seuls le français et l'euro sont disponibles pour l'instant :
 * les autres choix sont affichés, grisés.
 */
export default function LanguageScreen() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <SettingsPage title="Langue & devise">
      <Section title="Langue de l'application">
        {LANGUAGES.map(l => (
          <RadioRow key={l.value} title={l.label} subtitle={l.value === 'fr' ? null : 'Bientôt'} selected={l.value === 'fr'} disabled={l.value !== 'fr'} />
        ))}
      </Section>

      <Section title="Devise">
        {CURRENCIES.map(c => (
          <RadioRow key={c.value} title={c.label} subtitle={c.value === 'EUR' ? c.sub : `${c.sub} · bientôt`} selected={c.value === 'EUR'} disabled={c.value !== 'EUR'} />
        ))}
      </Section>

      <Section title="Formats">
        <Row title="Format de date" value="JJ/MM/AAAA" />
        <Row title="Unités de distance" value="Kilomètres" />
      </Section>

      <Section title="Affichage">
        <SwitchRow icon={isDark ? 'moon-outline' : 'sunny-outline'} title="Mode sombre" value={isDark} onChange={toggleTheme} />
      </Section>
      <Text style={s.note}>D'autres langues et devises arriveront avec l'ouverture de Talaria à l'international.</Text>
    </SettingsPage>
  );
}

const s = StyleSheet.create({
  note: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 14, textAlign: 'center' },
});
