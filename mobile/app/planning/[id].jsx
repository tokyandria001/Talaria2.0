import { Redirect, useLocalSearchParams } from 'expo-router';

/** Ancien écran « Planning » : remplacé par l'écran du voyage (onglets Planning, Budget, Votes, Chat) */
export default function PlanningRedirect() {
  const { id } = useLocalSearchParams();
  return <Redirect href={`/trip/${id}`} />;
}
