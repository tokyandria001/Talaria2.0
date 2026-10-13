import { useState, useEffect, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapPanel from '../../components/discover/MapPanel';
import CommunityPanel from '../../components/discover/CommunityPanel';
import DiscoverHeader from '../../components/discover/DiscoverHeader';
import { TAB_BAR_HEIGHT } from '../../constants/Layout';

/**
 * Onglet Découvrir : la carte des lieux et la communauté (articles).
 * Paramètres (menu + et accueil) : view=map|community, action=add-place|write, shortcut=logements|activites
 */
export default function DiscoverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [view, setView] = useState('map');

  useEffect(() => {
    if (params.view === 'map' || params.view === 'community') setView(params.view);
  }, [params.view]);

  // Une fois l'action traitée, on retire les paramètres pour ne pas la rejouer
  const clearAction = useCallback(() => router.setParams({ action: undefined, view: undefined, shortcut: undefined }), [router]);

  const header = <DiscoverHeader view={view} onChangeView={setView} />;

  return view === 'map' ? (
    <MapPanel
      header={header}
      autoAdd={params.action === 'add-place'}
      onAutoAddHandled={clearAction}
      initialShortcut={params.shortcut}
      onShortcutHandled={clearAction}
      bottomOffset={TAB_BAR_HEIGHT + Math.max(insets.bottom, 12)}
    />
  ) : (
    <CommunityPanel
      header={header}
      autoWrite={params.action === 'write'}
      onAutoWriteHandled={clearAction}
    />
  );
}
