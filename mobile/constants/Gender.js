/**
 * Accord des textes qui s'adressent à la personne (User.gender) : « Elle », « Il », ou neutre.
 * Sans choix (« Je préfère ne pas dire »), les formulations neutres s'affichent.
 * Les textes qui parlent de quelqu'un d'autre restent toujours neutres.
 */
export const GENDERS = [
  { value: 'feminin',  label: 'Elle' },
  { value: 'masculin', label: 'Il' },
  { value: 'neutre',   label: 'Je préfère ne pas dire' },
];

/** Valeur envoyée à l'API : « neutre » n'est pas stocké (null) */
export const genderPayload = (v) => (v === 'feminin' || v === 'masculin' ? v : null);

/** Texte au féminin, au masculin, ou neutre selon le choix de la personne */
export const accord = (user, feminin, masculin, neutre) => (
  user?.gender === 'feminin' ? feminin : user?.gender === 'masculin' ? masculin : neutre
);
