import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

const LAST_UPDATE = '1er mai 2026';
const APP_NAME    = 'Talaria';
const CONTACT     = 'contact@talaria.app';

const Section = ({ title, children }) => (
  <View style={s.section}>
    <Text style={s.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const P = ({ children }) => <Text style={s.body}>{children}</Text>;
const Li = ({ children }) => (
  <View style={s.liRow}>
    <Text style={s.liDot}>•</Text>
    <Text style={[s.body, { flex: 1 }]}>{children}</Text>
  </View>
);

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Politique de confidentialité</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.meta}>Dernière mise à jour : {LAST_UPDATE}</Text>

        <Section title="1. Introduction">
          <P>
            {APP_NAME} attache une grande importance à la protection de vos données personnelles.
            La présente politique décrit quelles données nous collectons, comment nous les
            utilisons et quels sont vos droits conformément au Règlement Général sur la
            Protection des Données (RGPD — UE 2016/679).
          </P>
        </Section>

        <Section title="2. Données collectées">
          <P>Nous collectons les données suivantes :</P>
          <Li>
            <Text style={{ fontWeight: '700' }}>Données de compte</Text> — prénom, nom,
            adresse e-mail, pseudonyme, photo de profil.
          </Li>
          <Li>
            <Text style={{ fontWeight: '700' }}>Données de voyage</Text> — destinations,
            dates, budget, mode de transport, liens de réservation.
          </Li>
          <Li>
            <Text style={{ fontWeight: '700' }}>Contenu publié</Text> — articles, commentaires,
            lieux ajoutés sur la carte.
          </Li>
          <Li>
            <Text style={{ fontWeight: '700' }}>Données de localisation</Text> — uniquement
            avec votre consentement explicite, pour afficher votre position sur la carte.
          </Li>
          <Li>
            <Text style={{ fontWeight: '700' }}>Données techniques</Text> — type d'appareil,
            version du système d'exploitation, journaux d'erreurs anonymisés.
          </Li>
        </Section>

        <Section title="3. Finalités du traitement">
          <P>Vos données sont utilisées pour :</P>
          <Li>Gérer votre compte et authentifier vos connexions.</Li>
          <Li>Afficher et sauvegarder vos voyages et votre activité communautaire.</Li>
          <Li>Vous permettre de partager du contenu avec la communauté.</Li>
          <Li>Améliorer les fonctionnalités de l'application.</Li>
          <Li>Vous contacter en cas de problème lié à votre compte.</Li>
        </Section>

        <Section title="4. Base légale">
          <P>Le traitement de vos données repose sur :</P>
          <Li>L'exécution du contrat (fourniture du service) pour les données de compte et de voyage.</Li>
          <Li>Votre consentement pour la géolocalisation.</Li>
          <Li>Notre intérêt légitime pour l'amélioration et la sécurité du service.</Li>
        </Section>

        <Section title="5. Conservation des données">
          <P>
            Vos données sont conservées pendant toute la durée d'activité de votre compte.
            Après suppression de votre compte, vos données personnelles sont effacées sous
            30 jours, à l'exception des données requises par la loi (ex. données de facturation).
          </P>
          <P>
            Le contenu que vous avez publié dans la communauté (articles, commentaires) peut
            être anonymisé plutôt que supprimé afin de préserver la cohérence des échanges.
          </P>
        </Section>

        <Section title="6. Partage des données">
          <P>
            Nous ne vendons jamais vos données personnelles à des tiers. Vos données peuvent
            être partagées uniquement dans les cas suivants :
          </P>
          <Li>Prestataires techniques hébergeant l'infrastructure de {APP_NAME} (sous contrat de confidentialité).</Li>
          <Li>Obligations légales ou injonctions judiciaires.</Li>
        </Section>

        <Section title="7. Sécurité">
          <P>
            Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour
            protéger vos données : chiffrement des mots de passe (bcrypt), authentification
            par token JWT, connexions HTTPS, accès restreint aux données en interne.
          </P>
          <P>
            Aucun système n'est infaillible. En cas de violation de données vous affectant,
            vous serez notifié conformément aux obligations du RGPD.
          </P>
        </Section>

        <Section title="8. Vos droits">
          <P>Conformément au RGPD, vous disposez des droits suivants :</P>
          <Li><Text style={{ fontWeight: '700' }}>Accès</Text> — obtenir une copie de vos données.</Li>
          <Li><Text style={{ fontWeight: '700' }}>Rectification</Text> — corriger des données inexactes.</Li>
          <Li><Text style={{ fontWeight: '700' }}>Effacement</Text> — supprimer votre compte et vos données.</Li>
          <Li><Text style={{ fontWeight: '700' }}>Portabilité</Text> — recevoir vos données dans un format structuré.</Li>
          <Li><Text style={{ fontWeight: '700' }}>Opposition</Text> — vous opposer à certains traitements.</Li>
          <Li><Text style={{ fontWeight: '700' }}>Limitation</Text> — demander la suspension temporaire d'un traitement.</Li>
          <P style={{ marginTop: 8 }}>
            Pour exercer ces droits : {CONTACT}{'\n'}
            Vous pouvez également introduire une réclamation auprès de la CNIL (www.cnil.fr).
          </P>
        </Section>

        <Section title="9. Cookies et traceurs">
          <P>
            {APP_NAME} est une application mobile et n'utilise pas de cookies au sens
            traditionnel. Nous utilisons un stockage sécurisé local (Expo SecureStore) pour
            conserver votre token d'authentification sur votre appareil. Aucune donnée de
            navigation n'est transmise à des régies publicitaires.
          </P>
        </Section>

        <Section title="10. Modifications">
          <P>
            Cette politique peut être mise à jour. Toute modification significative sera
            signalée par une notification dans l'application. La date de dernière mise à jour
            est indiquée en haut de cette page.
          </P>
        </Section>

        <Section title="11. Contact">
          <P>
            Pour toute question relative à la protection de vos données personnelles,
            contactez notre responsable de traitement à : {CONTACT}
          </P>
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.inputBg,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'BricolageGrotesque_700Bold',
    fontSize: 16, color: Colors.text, flex: 1,
  },

  content: { paddingHorizontal: 20, paddingTop: 16 },

  meta: {
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 12, color: Colors.textMuted, marginBottom: 24,
  },

  section:      { marginBottom: 28 },
  sectionTitle: {
    fontFamily: 'BricolageGrotesque_800ExtraBold',
    fontSize: 15, color: Colors.parme, marginBottom: 10,
  },
  body: {
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 13, color: Colors.text, lineHeight: 20, marginBottom: 8,
  },
  liRow:  { flexDirection: 'row', gap: 8, marginBottom: 6, paddingLeft: 4 },
  liDot:  {
    fontFamily: 'BricolageGrotesque_700Bold',
    fontSize: 13, color: Colors.parme, marginTop: 1,
  },
});
