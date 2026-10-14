import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import client from '../../api/client';
import ArticleCard from '../../components/ArticleCard';
import ArticleDetailModal from '../../components/ArticleDetailModal';
import WriteArticleModal from '../../components/WriteArticleModal';
import { Colors } from '../../constants/Colors';
import { useTheme } from '../../context/ThemeContext';

/** « Mes articles » : filtre spécial (articles dont je suis l'auteur) */
const MINE = '__mine__';

const CATEGORIES = [
  { value: '',              label: 'Tous' },
  { value: MINE,            label: '✍️ Mes articles' },
  { value: 'Itinéraires',  label: '🗺 Itinéraires' },
  { value: 'Aventures',    label: '🧗 Aventures' },
  { value: 'Éco-Tourisme', label: '🌿 Éco' },
  { value: 'Logements',    label: '🛏 Logements' },
  { value: 'Conseils',     label: '💡 Conseils' },
];

export default function CommunityPanel({ header, autoWrite, onAutoWriteHandled, initialFilter, onFilterHandled, onWriteClosed }) {
  const { theme }  = useTheme();
  const insets      = useSafeAreaInsets();
  const tabBarH     = 64 + (insets.bottom || 16);

  const [articles,        setArticles]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]       = useState(false);
  const [search,          setSearch]          = useState('');
  const [activeCategory,  setActiveCategory]  = useState('');
  const [selectedId,      setSelectedId]      = useState(null);
  const [showDetail,      setShowDetail]      = useState(false);
  const [showWrite,       setShowWrite]       = useState(false);
  const [editArticle,     setEditArticle]     = useState(null);

  const fetchArticles = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = {};
      if (activeCategory === MINE) params.mine = 'true';
      else if (activeCategory) params.category = activeCategory;
      if (search)         params.search   = search;
      const { data } = await client.get('/api/articles', { params });
      setArticles(data.articles ?? []);
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeCategory, search]);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const handleRefresh = () => { setRefreshing(true); fetchArticles(true); };

  const handleLike = async (id) => {
    try {
      const { data } = await client.post(`/api/articles/${id}/like`);
      setArticles(prev => prev.map(a =>
        a.id === id ? { ...a, likedByMe: data.liked, likesCount: data.likesCount } : a
      ));
    } catch {}
  };

  const handleDelete = async (id) => {
    try {
      await client.delete(`/api/articles/${id}`);
      setArticles(prev => prev.filter(a => a.id !== id));
    } catch {}
  };

  const openArticle = (id) => { setSelectedId(id); setShowDetail(true); };

  const openWrite = (article = null) => {
    setEditArticle(article);
    setShowWrite(true);
  };

  // Ouverture sur « Mes articles » depuis le profil
  useEffect(() => {
    if (initialFilter === 'mine') { setActiveCategory(MINE); onFilterHandled?.(); }
  }, [initialFilter, onFilterHandled]);

  // Ouverture de la rédaction depuis le bouton +
  useEffect(() => {
    if (autoWrite) { setEditArticle(null); setShowWrite(true); onAutoWriteHandled?.(); }
  }, [autoWrite, onAutoWriteHandled]);


  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.sableLune }]} edges={['top']}>

      {/* En-tête Découvrir (Carte / Communauté) */}
      {header}

      <View style={styles.titleRow}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Communauté</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            {articles.length > 0
              ? `${articles.length} article${articles.length > 1 ? 's' : ''} disponible${articles.length > 1 ? 's' : ''}`
              : 'Articles & conseils de voyage'}
          </Text>
        </View>
        <TouchableOpacity style={styles.writeBtn} onPress={() => openWrite()}>
          <Text style={styles.writeBtnText}>✏️ Écrire</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un article..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={{ color: Colors.textMuted }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category filters */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.filtersWrap}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.value}
            style={[styles.pill, activeCategory === c.value && styles.pillActive]}
            onPress={() => setActiveCategory(c.value)}
          >
            <Text style={[styles.pillText, activeCategory === c.value && styles.pillTextActive]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Articles list */}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.parme} />
        </View>
      ) : (
        <FlatList
          data={articles}
          keyExtractor={(a) => String(a.id)}
          contentContainerStyle={[styles.list, { paddingBottom: tabBarH + 16 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.parme} />
          }
          renderItem={({ item }) => (
            <View>
              <ArticleCard
                article={item}
                onPress={() => openArticle(item.id)}
                onLike={() => handleLike(item.id)}
              />
              {item.isOwner && (
                <View style={styles.ownerActions}>
                  <TouchableOpacity style={styles.ownerBtn} onPress={() => openWrite(item)}>
                    <Text style={styles.ownerBtnText}>✏️ Modifier</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.ownerBtn, { borderColor: Colors.error }]}
                    onPress={() => handleDelete(item.id)}
                  >
                    <Text style={[styles.ownerBtnText, { color: Colors.error }]}>🗑 Supprimer</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>✈️</Text>
              <Text style={styles.emptyTitle}>Aucun article</Text>
              <Text style={styles.emptyText}>Soyez le premier à partager votre aventure !</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => openWrite()}>
                <Text style={styles.emptyBtnText}>Écrire un article</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Modals */}
      <ArticleDetailModal
        articleId={selectedId}
        visible={showDetail}
        onClose={() => setShowDetail(false)}
        onLikeToggle={(id, liked, count) =>
          setArticles(prev => prev.map(a => a.id === id ? { ...a, likedByMe: liked, likesCount: count } : a))
        }
      />

      <WriteArticleModal
        visible={showWrite}
        article={editArticle}
        onClose={() => { setShowWrite(false); setEditArticle(null); onWriteClosed?.(false); }}
        onSaved={() => {
          onWriteClosed?.(true);
          setShowWrite(false);
          setEditArticle(null);
          fetchArticles(true);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.sableLune },

  header: {
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },

  titleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  title:    { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 22, color: Colors.text },
  subtitle: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.textMuted, marginTop: 2 },

  writeBtn: {
    backgroundColor: Colors.parme,
    borderRadius: 100, paddingHorizontal: 16, paddingVertical: 9,
  },
  writeBtnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 13, color: Colors.white },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.white, marginHorizontal: 16, marginBottom: 10,
    borderRadius: 100, paddingHorizontal: 16, paddingVertical: 11,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchIcon:  { fontSize: 15 },
  searchInput: {
    flex: 1, fontSize: 14,
    fontFamily: 'BricolageGrotesque_400Regular', color: Colors.text,
  },

  filtersWrap: { marginBottom: 14, flexGrow: 0 },
  pill: {
    borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.white,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  pillActive:    { backgroundColor: Colors.parme, borderColor: Colors.parme },
  pillText:      { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.textMuted },
  pillTextActive: { color: Colors.white },

  list:   { paddingHorizontal: 16, paddingBottom: 32 },
  // paddingBottom dynamique appliqué via tabBarH dans le composant
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },

  ownerActions: {
    flexDirection: 'row', gap: 8, marginTop: -8, marginBottom: 14,
    paddingHorizontal: 16,
  },
  ownerBtn: {
    borderWidth: 1.5, borderColor: Colors.parme,
    borderRadius: 100, paddingHorizontal: 14, paddingVertical: 6,
  },
  ownerBtnText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.parme },

  empty:      { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 18, color: Colors.text },
  emptyText:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  emptyBtn:   { backgroundColor: Colors.parme, borderRadius: 100, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  emptyBtnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14, color: Colors.white },
});
