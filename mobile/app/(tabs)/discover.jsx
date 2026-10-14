import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPanel } from '../../components/discover/mapSupport';
import CommunityPanel from '../../components/discover/CommunityPanel';
import DiscoverHeader from '../../components/discover/DiscoverHeader';
import { TAB_BAR_HEIGHT } from '../../constants/Layout';

/**
 * Onglet Découvrir : la carte des lieux et la communauté (articles).
 * Paramètres (menu + et accueil) : view=map|community, action=add-place|write, shortcut=logements|activites,
 * from=écran d'origine (on y revient si la rédaction ouverte par le menu est annulée)
 */
export default function DiscoverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [view, setView] = useState('map');
  const returnTo = useRef(null);

  useEffect(() => {
    if (params.view !== 'map' && params.view !== 'community') return;
    // Rédaction ouverte depuis le menu + : on retient l'écran et la vue d'origine
    if (params.action === 'write') returnTo.current = { from: params.from, view };
    setView(params.view);
  }, [params.view, params.action]); // eslint-disable-line react-hooks/exhaustive-deps

  // Une fois l'action traitée, on retire les paramètres pour ne pas la rejouer
  const clearAction = useCallback(() => router.setParams({ action: undefined, view: undefined, shortcut: undefined, filter: undefined, from: undefined }), [router]);

  // Rédaction annulée : retour là où l'on était ; publiée : on reste sur la communauté pour voir l'article
  const onWriteClosed = useCallback((saved) => {
    const origin = returnTo.current;
    returnTo.current = null;
    if (!origin || saved) return;
    setView(origin.view);
    if (origin.from && origin.from !== '/discover') router.navigate(origin.from);
  }, [router]);

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
      onWriteClosed={onWriteClosed}
      initialFilter={params.filter}
      onFilterHandled={clearAction}
    />
  );
}
