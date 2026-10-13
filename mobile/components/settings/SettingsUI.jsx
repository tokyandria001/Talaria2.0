import { Fragment, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Switch, ScrollView, StyleSheet, PanResponder } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import GroupHero from '../groups/GroupHero';
import { Colors } from '../../constants/Colors';

/** Écran de paramètres (maquettes 28 à 37) : bandeau « Paramètres » + titre, contenu défilant */
export function SettingsPage({ label = 'Paramètres', title, children, footer }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={s.root}>
      <GroupHero label={label} title={title} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + (footer ? 100 : 32) }]}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      {footer ? <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>{footer}</View> : null}
    </View>
  );
}

/** Groupe de lignes : libellé en capitales + carte blanche, lignes séparées par un filet */
export function Section({ title, children, style }) {
  const rows = (Array.isArray(children) ? children : [children]).flat().filter(Boolean);
  return (
    <View style={[{ marginTop: 18 }, style]}>
      {title ? <Text style={s.sectionTitle}>{title}</Text> : null}
      <View style={s.card}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 && <View style={s.divider} />}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

/** Ligne : icône, titre, sous-titre, valeur ou chevron à droite */
export function Row({ icon, title, subtitle, value, onPress, danger, right, soon }) {
  const color = danger ? Colors.error : Colors.text;
  const content = (
    <View style={s.row}>
      {icon ? (
        <View style={[s.icon, danger && { backgroundColor: '#fdecec' }]}>
          <Ionicons name={icon} size={17} color={danger ? Colors.error : Colors.parme} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[s.title, { color }]}>{title}</Text>
        {subtitle ? <Text style={s.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {soon ? <Text style={s.soon}>Bientôt</Text> : null}
      {value != null ? <Text style={s.value} numberOfLines={1}>{value}</Text> : null}
      {right}
      {onPress && !right && !soon ? <Ionicons name="chevron-forward" size={18} color={Colors.parme} /> : null}
    </View>
  );
  return onPress ? <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{content}</TouchableOpacity> : content;
}

/** Ligne avec interrupteur */
export function SwitchRow({ icon, title, subtitle, value, onChange, disabled }) {
  return (
    <Row icon={icon} title={title} subtitle={subtitle} right={(
      <Switch value={!!value} onValueChange={onChange} disabled={disabled}
        thumbColor={Colors.white} trackColor={{ true: Colors.parme, false: '#d9cfd4' }} />
    )} />
  );
}

/** Ligne de choix unique (bouton radio) */
export function RadioRow({ title, subtitle, selected, onPress, disabled }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.7} style={disabled && { opacity: 0.45 }}>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{title}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={[s.radio, selected && s.radioOn]}>{selected && <View style={s.radioDot} />}</View>
      </View>
    </TouchableOpacity>
  );
}

/** Puces de choix (multiple par défaut, unique avec `single`) */
export function Chips({ options, selected, onChange, single }) {
  const isOn = (v) => (single ? selected === v : (selected ?? []).includes(v));
  const toggle = (v) => {
    if (single) onChange(v);
    else onChange(isOn(v) ? selected.filter(x => x !== v) : [...(selected ?? []), v]);
  };
  return (
    <View style={s.chips}>
      {options.map(o => (
        <TouchableOpacity key={o.value} style={[s.chip, isOn(o.value) && s.chipOn]} onPress={() => toggle(o.value)} activeOpacity={0.8}>
          <Text style={[s.chipText, isOn(o.value) && s.chipTextOn]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const THUMB = 24;

/**
 * Curseur à une poignée (budget habituel). onChange pendant le glissement, onDone au relâchement
 * (pour n'enregistrer qu'une fois).
 */
export function ValueSlider({ min, max, step, value, onChange, onDone, format = (v) => v }) {
  const [width, setWidth] = useState(0);
  const live = useRef({});
  live.current = { min, max, step, value, width, onChange, onDone };
  const toX = (v) => ((Math.min(Math.max(v, min), max) - min) / (max - min)) * width;

  const responder = useRef((() => {
    let startX = 0;
    let last = null;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const c = live.current;
        startX = ((Math.min(Math.max(c.value, c.min), c.max) - c.min) / (c.max - c.min)) * c.width;
        last = c.value;
      },
      onPanResponderMove: (_, g) => {
        const c = live.current;
        const x = Math.min(Math.max(startX + g.dx, 0), c.width);
        last = Math.round((c.min + (x / c.width) * (c.max - c.min)) / c.step) * c.step;
        c.onChange(last);
      },
      onPanResponderRelease: () => { if (last != null) live.current.onDone?.(last); },
    });
  })()).current;

  return (
    <View>
      <View style={s.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width - THUMB)}>
        <View style={s.rail} />
        {width > 0 && (
          <>
            <View style={[s.railOn, { width: toX(value) + THUMB / 2 }]} />
            <View {...responder.panHandlers} style={[s.thumb, { left: toX(value) }]} hitSlop={12} />
          </>
        )}
      </View>
      <View style={s.sliderLabels}>
        <Text style={s.sliderLabel}>{format(min)}</Text>
        <Text style={[s.sliderLabel, { fontFamily: 'BricolageGrotesque_600SemiBold' }]}>{format(value)}</Text>
        <Text style={s.sliderLabel}>{format(max)}{'+'}</Text>
      </View>
    </View>
  );
}

/** Titre de bloc hors carte (préférences, profil) */
export const Label = ({ children, style }) => <Text style={[s.label, style]}>{children}</Text>;

/** « Il y a 3 mois » à partir d'une date ISO */
export function since(iso) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - Date.parse(iso)) / 864e5);
  if (days < 1) return "aujourd'hui";
  if (days < 30) return `il y a ${days} jour${days > 1 ? 's' : ''}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `il y a ${months} mois`;
  const years = Math.floor(months / 12);
  return `il y a ${years} an${years > 1 ? 's' : ''}`;
}

export const settingsStyles = StyleSheet.create({
  primaryBtn: { backgroundColor: Colors.parme, borderRadius: 100, height: 50, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.white },
  outlineBtn: { borderWidth: 1.5, borderColor: Colors.parme, borderRadius: 100, height: 50, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  outlineText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.parme },
  input: {
    backgroundColor: Colors.white, borderRadius: 100, borderWidth: 1, borderColor: '#ece3e7',
    paddingHorizontal: 18, paddingVertical: 12, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text,
  },
  note: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 8, lineHeight: 16 },
});

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.sableLune },
  scroll: { paddingHorizontal: 18, paddingTop: 4 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 12, backgroundColor: Colors.sableLune },

  sectionTitle: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: Colors.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  card:    { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: '#efe6e9', overflow: 'hidden' },
  divider: { height: 1, backgroundColor: '#f2ebee', marginLeft: 14 },

  row:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 52 },
  icon: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.parmeLight, alignItems: 'center', justifyContent: 'center' },
  title:    { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text },
  subtitle: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  value:    { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, maxWidth: 140 },
  soon: {
    fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 10, color: Colors.parme,
    backgroundColor: Colors.sableOr, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden',
  },

  radio:    { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#cbbcc4', alignItems: 'center', justifyContent: 'center' },
  radioOn:  { borderColor: Colors.parme },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.parme },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:  { borderWidth: 1.5, borderColor: Colors.parme, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.white },
  chipOn: { backgroundColor: Colors.parme },
  chipText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.parme },
  chipTextOn: { color: Colors.white },

  label: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.text, marginTop: 20, marginBottom: 10 },

  track:  { height: THUMB, justifyContent: 'center' },
  rail:   { position: 'absolute', left: THUMB / 2, right: THUMB / 2, height: 4, borderRadius: 2, backgroundColor: '#e3d6dd' },
  railOn: { position: 'absolute', left: 0, height: 4, borderRadius: 2, backgroundColor: Colors.parme },
  thumb:  { position: 'absolute', width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: Colors.white, borderWidth: 2, borderColor: Colors.parme },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  sliderLabel:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.text },
});
