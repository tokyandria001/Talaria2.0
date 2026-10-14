import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Linking, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { SettingsPage, settingsStyles as ss } from '../../components/settings/SettingsUI';
import { FAQ, SUPPORT_EMAIL } from '../../constants/Settings';
import { Colors } from '../../constants/Colors';

/** Retire les accents pour la recherche (« reserver » trouve « réserve ») */
const plain = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Aide & support (maquette 34) : questions fréquentes, contact du support */
export default function HelpScreen() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(0);

  const results = FAQ.filter(f => !query.trim() || plain(`${f.q} ${f.a}`).includes(plain(query.trim())));

  const mail = async (subject) => {
    const body = `\n\n—\nTalaria v${Constants.expoConfig?.version ?? '?'} · ${Platform.OS} ${Platform.Version}`;
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try { await Linking.openURL(url); }
    catch { Alert.alert('Support', `Écris-nous à ${SUPPORT_EMAIL}`); }
  };

  return (
    <SettingsPage title="Aide & support">
      <View style={s.search}>
        <Ionicons name="search" size={16} color={Colors.textMuted} />
        <TextInput style={s.searchInput} placeholder="Rechercher dans l'aide" placeholderTextColor={Colors.textMuted}
          value={query} onChangeText={setQuery} />
      </View>

      <Text style={s.title}>Questions fréquentes</Text>
      {results.length === 0 && <Text style={s.empty}>Aucune réponse trouvée.{SUPPORT_EMAIL ? ' Écris-nous, on te répond vite.' : ''}</Text>}
      {results.map((f) => {
        const index = FAQ.indexOf(f);
        const expanded = open === index || !!query.trim();
        return (
          <TouchableOpacity key={f.q} style={s.item} onPress={() => setOpen(expanded && !query.trim() ? -1 : index)} activeOpacity={0.8}>
            <View style={s.itemHead}>
              <Text style={s.question}>{f.q}</Text>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.parme} />
            </View>
            {expanded && <Text style={s.answer}>{f.a}</Text>}
          </TouchableOpacity>
        );
      })}

      {/* Contact : affiché seulement quand une adresse de support existe (constants/Settings.js) */}
      {SUPPORT_EMAIL && (
        <>
          <Text style={s.title}>Besoin d'aide ?</Text>
          <TouchableOpacity style={ss.primaryBtn} onPress={() => mail('Aide Talaria')}>
            <Ionicons name="chatbox-outline" size={16} color={Colors.white} />
            <Text style={ss.primaryText}>Écrire au support</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[ss.outlineBtn, { marginTop: 10 }]} onPress={() => mail('Bug Talaria')}>
            <Ionicons name="bug-outline" size={16} color={Colors.parme} />
            <Text style={ss.outlineText}>Signaler un bug</Text>
          </TouchableOpacity>
        </>
      )}
    </SettingsPage>
  );
}

const s = StyleSheet.create({
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6,
    backgroundColor: Colors.white, borderRadius: 100, paddingHorizontal: 16, paddingVertical: 11, borderWidth: 1, borderColor: '#ece3e7',
  },
  searchInput: { flex: 1, fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text, padding: 0 },
  title: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.text, marginTop: 22, marginBottom: 10 },
  empty: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.textMuted },
  item: { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: '#efe6e9', padding: 14, marginBottom: 8 },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  question: { flex: 1, fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text },
  answer: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted, lineHeight: 18, marginTop: 8 },
});
