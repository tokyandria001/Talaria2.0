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

export default function CGUScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Conditions générales d'utilisation</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.meta}>Dernière mise à jour : {LAST_UPDATE}</Text>

        <Section title="1. Présentation">
          <P>
            Bienvenue sur {APP_NAME}, une application de planification de voyages permettant
            de gérer vos itinéraires, budgets et réservations, et de partager vos expériences
            avec une communauté de voyageurs.
          </P>
          <P>
            En utilisant {APP_NAME}, vous acceptez pleinement et sans réserve les présentes
            conditions générales d'utilisation. Si vous n'acceptez pas ces conditions, veuillez
            ne pas utiliser l'application.
          </P>
        </Section>

        <Section title="2. Accès au service">
          <P>L'accès à {APP_NAME} nécessite la création d'un compte personnel. Vous devez :</P>
          <Li>Être âgé d'au moins 16 ans.</Li>
          <Li>Fournir des informations exactes et à jour lors de l'inscription.</Li>
          <Li>Maintenir la confidentialité de vos identifiants de connexion.</Li>
          <Li>Notifier immédiatement tout accès non autorisé à votre compte.</Li>
        </Section>

        <Section title="3. Utilisation acceptable">
          <P>Vous vous engagez à utiliser {APP_NAME} de manière licite et respectueuse. Il est notamment interdit de :</P>
          <Li>Publier des contenus illicites, diffamatoires, haineux ou trompeurs.</Li>
          <Li>Usurper l'identité d'un tiers.</Li>
          <Li>Tenter de contourner les mesures de sécurité de l'application.</Li>
          <Li>Collecter des données sur d'autres utilisateurs sans leur consentement.</Li>
          <Li>Utiliser l'application à des fins commerciales sans autorisation préalable.</Li>
        </Section>

        <Section title="4. Contenu utilisateur">
          <P>
            Vous conservez la propriété intellectuelle des contenus que vous publiez (articles,
            commentaires, photos). En les publiant sur {APP_NAME}, vous accordez à la plateforme
            une licence non exclusive, mondiale et gratuite pour les afficher et les distribuer
            dans le cadre du service.
          </P>
          <P>
            {APP_NAME} se réserve le droit de supprimer tout contenu qui violerait les présentes
            conditions ou serait contraire aux lois en vigueur, sans préavis.
          </P>
        </Section>

        <Section title="5. Données personnelles">
          <P>
            {APP_NAME} collecte et traite vos données personnelles conformément au Règlement
            Général sur la Protection des Données (RGPD). Les données collectées incluent vos
            informations de profil, vos voyages planifiés et votre activité sur l'application.
          </P>
          <P>Vous disposez des droits suivants concernant vos données :</P>
          <Li>Droit d'accès, de rectification et d'effacement.</Li>
          <Li>Droit à la portabilité des données.</Li>
          <Li>Droit d'opposition au traitement.</Li>
          <P>
            Pour exercer ces droits, contactez-nous à : {CONTACT}
          </P>
        </Section>

        <Section title="6. Liens externes">
          <P>
            {APP_NAME} peut contenir des liens vers des services tiers (Booking.com, Airbnb,
            Skyscanner, etc.). Ces liens sont fournis à titre indicatif. {APP_NAME} n'est pas
            responsable du contenu, de la disponibilité ou des pratiques de ces sites.
          </P>
        </Section>

        <Section title="7. Responsabilité">
          <P>
            {APP_NAME} est fourni "en l'état". Nous ne garantissons pas l'exactitude des
            informations publiées par les utilisateurs, ni la disponibilité permanente du service.
          </P>
          <P>
            En aucun cas {APP_NAME} ne saurait être tenu responsable des dommages directs ou
            indirects résultant de l'utilisation de l'application ou de l'impossibilité d'y
            accéder.
          </P>
        </Section>

        <Section title="8. Modification des conditions">
          <P>
            {APP_NAME} se réserve le droit de modifier les présentes conditions à tout moment.
            Les utilisateurs seront informés de toute modification significative par notification
            dans l'application. L'utilisation continue de l'application après modification vaut
            acceptation des nouvelles conditions.
          </P>
        </Section>

        <Section title="9. Résiliation">
          <P>
            Vous pouvez supprimer votre compte à tout moment depuis la page Profil. {APP_NAME}
            se réserve le droit de suspendre ou supprimer tout compte en violation des présentes
            conditions.
          </P>
        </Section>

        <Section title="10. Droit applicable">
          <P>
            Les présentes conditions sont régies par le droit français. Tout litige relatif à
            leur interprétation ou exécution relève de la compétence exclusive des tribunaux
            français.
          </P>
          <P>Pour toute question : {CONTACT}</P>
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.white },

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
    fontSize: 12, color: Colors.textMuted,
    marginBottom: 24,
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
