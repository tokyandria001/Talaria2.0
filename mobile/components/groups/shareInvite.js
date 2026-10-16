import { Share, Alert } from 'react-native';

/** Partage le code d'invitation d'un groupe (lien talaria:// + code à saisir dans l'app) */
export async function shareInvite(group) {
  if (!group?.inviteCode) {
    Alert.alert('Lien indisponible', 'Dans un groupe privé, seule la personne qui organise peut partager le lien d\'invitation.');
    return;
  }
  const link = `talaria://groups/join?code=${group.inviteCode}`;
  try {
    await Share.share({
      message:
        `Rejoins mon groupe « ${group.name} » sur Talaria !\n\n` +
        `Code d'invitation : ${group.inviteCode}\n` +
        `(Talaria → Mes groupes → Rejoindre avec un code)\n\n${link}`,
    });
  } catch { /* partage annulé */ }
}
