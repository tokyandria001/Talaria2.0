import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';

const CAT_COLORS = {
  'Itinéraires':  '#f0dacb',
  'Aventures':    '#c9b2d7',
  'Éco-Tourisme': '#bbf7d0',
  'Logements':    '#fde68a',
  'Conseils':     '#bfdbfe',
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'à l\'instant';
  if (m < 60) return `il y a ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

const AUTHOR_COLORS = ['#4f203f', '#16a34a', '#2563eb', '#d97706', '#db2777', '#0891b2'];
const authorColor = (id) => AUTHOR_COLORS[(id || 0) % AUTHOR_COLORS.length];

export default function ArticleCard({ article, onPress, onLike }) {
  const catColor = CAT_COLORS[article.category] ?? Colors.parmeLight;
  const API_URL  = require('../api/client').default.defaults.baseURL;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
      {/* Cover */}
      {article.coverImage ? (
        <Image
          source={{ uri: `${API_URL}${article.coverImage}` }}
          style={styles.cover}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder, { backgroundColor: catColor }]}>
          <Text style={styles.placeholderIcon}>✈️</Text>
        </View>
      )}

      <View style={styles.body}>
        {/* Category */}
        <View style={[styles.catBadge, { backgroundColor: catColor }]}>
          <Text style={styles.catText}>{article.category}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>{article.title}</Text>

        {/* Excerpt */}
        {article.excerpt && (
          <Text style={styles.excerpt} numberOfLines={2}>{article.excerpt}</Text>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.author}>
            <View style={[styles.avatar, { backgroundColor: authorColor(article.author.id) }]}>
              <Text style={styles.avatarText}>{article.author.initials}</Text>
            </View>
            <Text style={styles.authorName}>
              {article.author.firstName} {article.author.lastName}
            </Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.meta}>{timeAgo(article.createdAt)}</Text>
          </View>

          <View style={styles.stats}>
            <TouchableOpacity style={styles.statBtn} onPress={onLike}>
              <Text style={{ fontSize: 13 }}>{article.likedByMe ? '❤️' : '🤍'}</Text>
              <Text style={styles.statText}>{article.likesCount}</Text>
            </TouchableOpacity>
            <View style={styles.statBtn}>
              <Text style={{ fontSize: 13 }}>💬</Text>
              <Text style={styles.statText}>{article.commentsCount}</Text>
            </View>
            <Text style={styles.readTime}>{article.readTime} min</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20, overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cover:            { width: '100%', height: 180 },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderIcon:  { fontSize: 36 },

  body: { padding: 16 },

  catBadge: {
    alignSelf: 'flex-start', borderRadius: 100,
    paddingHorizontal: 10, paddingVertical: 3, marginBottom: 8,
  },
  catText: {
    fontFamily: 'BricolageGrotesque_700Bold',
    fontSize: 11, color: Colors.parme,
  },

  title: {
    fontFamily: 'BricolageGrotesque_800ExtraBold',
    fontSize: 16, color: Colors.text, lineHeight: 22, marginBottom: 6,
  },
  excerpt: {
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 13, color: Colors.textMuted, lineHeight: 18, marginBottom: 12,
  },

  footer:     { gap: 8 },
  author:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatar:     { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 9, color: Colors.white },
  authorName: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.text },
  dot:        { fontSize: 12, color: Colors.textMuted },
  meta:       { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted },

  stats:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 12, color: Colors.textMuted },
  readTime: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginLeft: 'auto' },
});
