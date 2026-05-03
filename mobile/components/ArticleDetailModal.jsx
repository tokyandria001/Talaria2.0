import { useState, useEffect, useRef } from 'react';
import {
  View, Text, Image, ScrollView, TextInput, TouchableOpacity,
  Modal, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/Colors';

const AUTHOR_COLORS = ['#4f203f', '#16a34a', '#2563eb', '#d97706', '#db2777', '#0891b2'];
const authorColor = (id) => AUTHOR_COLORS[(id || 0) % AUTHOR_COLORS.length];
const API_BASE = client.defaults.baseURL;

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'à l\'instant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

export default function ArticleDetailModal({ articleId, visible, onClose, onLikeToggle }) {
  const { user } = useAuth();
  const [article,     setArticle]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [likedByMe,   setLikedByMe]   = useState(false);
  const [likesCount,  setLikesCount]  = useState(0);
  const [comments,    setComments]    = useState([]);
  const [commentText, setCommentText] = useState('');
  const [posting,     setPosting]     = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!visible || !articleId) return;
    setLoading(true);
    client.get(`/api/articles/${articleId}`)
      .then(({ data }) => {
        setArticle(data);
        setLikedByMe(data.likedByMe);
        setLikesCount(data.likesCount);
        setComments(data.comments ?? []);
      })
      .finally(() => setLoading(false));
  }, [visible, articleId]);

  const toggleLike = async () => {
    const prev = likedByMe;
    setLikedByMe(!prev);
    setLikesCount(c => prev ? c - 1 : c + 1);
    try {
      const { data } = await client.post(`/api/articles/${articleId}/like`);
      setLikedByMe(data.liked);
      setLikesCount(data.likesCount);
      onLikeToggle?.(articleId, data.liked, data.likesCount);
    } catch {
      setLikedByMe(prev);
      setLikesCount(c => prev ? c + 1 : c - 1);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    setPosting(true);
    try {
      const { data } = await client.post(`/api/articles/${articleId}/comments`, { content: commentText.trim() });
      setComments(prev => [...prev, data]);
      setCommentText('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } finally {
      setPosting(false);
    }
  };

  const deleteComment = async (commentId) => {
    try {
      await client.delete(`/api/articles/${articleId}/comments/${commentId}`);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch {}
  };

  const initials = user
    ? (((user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')) || (user.email?.[0] ?? '?')).toUpperCase()
    : '?';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={Colors.parme} />
          </View>
        ) : article ? (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>

              {/* Cover */}
              {article.coverImage && (
                <Image
                  source={{ uri: `${API_BASE}${article.coverImage}` }}
                  style={styles.cover}
                  resizeMode="cover"
                />
              )}

              <View style={styles.body}>
                {/* Category */}
                <View style={styles.catBadge}>
                  <Text style={styles.catText}>{article.category}</Text>
                </View>

                {/* Title */}
                <Text style={styles.title}>{article.title}</Text>

                {/* Meta */}
                <View style={styles.meta}>
                  <View style={[styles.avatar, { backgroundColor: authorColor(article.author.id) }]}>
                    <Text style={styles.avatarText}>{article.author.initials}</Text>
                  </View>
                  <Text style={styles.authorName}>{article.author.firstName} {article.author.lastName}</Text>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaText}>{timeAgo(article.createdAt)}</Text>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaText}>{article.readTime} min</Text>
                </View>

                {/* Like strip */}
                <View style={styles.likeStrip}>
                  <TouchableOpacity style={[styles.likeBtn, likedByMe && styles.likeBtnActive]} onPress={toggleLike}>
                    <Text style={{ fontSize: 14 }}>{likedByMe ? '❤️' : '🤍'}</Text>
                    <Text style={[styles.likeBtnText, likedByMe && { color: '#e74c3c' }]}>
                      {likesCount} j'aime
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.commentCount}>
                    <Text style={{ fontSize: 14 }}>💬</Text>
                    <Text style={styles.commentCountText}>{comments.length} commentaire{comments.length !== 1 ? 's' : ''}</Text>
                  </View>
                </View>

                {/* Content */}
                <View style={styles.content}>
                  {article.content.split('\n').map((para, i) =>
                    para.trim()
                      ? <Text key={i} style={styles.paragraph}>{para}</Text>
                      : <View key={i} style={{ height: 8 }} />
                  )}
                </View>

                {/* Comments */}
                <View style={styles.commentsSection}>
                  <Text style={styles.commentsTitle}>Commentaires ({comments.length})</Text>

                  {/* Add comment */}
                  <View style={styles.addComment}>
                    <View style={[styles.avatar, { backgroundColor: authorColor(user?.id) }]}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 8 }}>
                      <TextInput
                        style={styles.commentInput}
                        placeholder="Ajouter un commentaire..."
                        placeholderTextColor={Colors.textMuted}
                        value={commentText}
                        onChangeText={setCommentText}
                        multiline
                        maxLength={1000}
                      />
                      <TouchableOpacity
                        style={[styles.publishBtn, (!commentText.trim() || posting) && { opacity: 0.4 }]}
                        onPress={submitComment}
                        disabled={!commentText.trim() || posting}
                      >
                        <Text style={styles.publishBtnText}>{posting ? '...' : 'Publier'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Comments list */}
                  {comments.map((c) => (
                    <View key={c.id} style={styles.comment}>
                      <View style={[styles.avatar, { backgroundColor: authorColor(c.author.id) }]}>
                        <Text style={styles.avatarText}>
                          {c.author.initials || ((c.author.firstName?.[0] ?? '') + (c.author.lastName?.[0] ?? '')).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.commentHeader}>
                          <Text style={styles.commentAuthor}>{c.author.firstName} {c.author.lastName}</Text>
                          <Text style={styles.commentTime}>{timeAgo(c.createdAt)}</Text>
                          {c.isOwner && (
                            <TouchableOpacity onPress={() => deleteComment(c.id)}>
                              <Text style={styles.deleteBtn}>Supprimer</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <Text style={styles.commentText}>{c.content}</Text>
                      </View>
                    </View>
                  ))}
                  {comments.length === 0 && (
                    <Text style={styles.noComments}>Soyez le premier à commenter !</Text>
                  )}
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        ) : (
          <View style={styles.loader}>
            <Text style={{ color: Colors.textMuted }}>Article introuvable.</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.white },
  header: { paddingHorizontal: 16, paddingVertical: 12, alignItems: 'flex-end' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  closeIcon: { fontSize: 13, color: Colors.textMuted },
  loader:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  cover: { width: '100%', height: 260 },
  body:  { padding: 20 },

  catBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.parmeLight,
    borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4,
    marginBottom: 10,
  },
  catText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 12, color: Colors.parme },

  title: {
    fontFamily: 'BricolageGrotesque_800ExtraBold',
    fontSize: 22, color: Colors.text, lineHeight: 30, marginBottom: 14,
  },

  meta:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  avatar:     { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 9, color: Colors.white },
  authorName: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text },
  metaDot:    { color: Colors.textMuted, opacity: 0.5 },
  metaText:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.textMuted },

  likeStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 14,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border,
    marginBottom: 20,
  },
  likeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  likeBtnActive:  { borderColor: '#e74c3c', backgroundColor: '#fef2f2' },
  likeBtnText:    { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.textMuted },
  commentCount:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commentCountText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 13, color: Colors.textMuted },

  content:   { marginBottom: 28 },
  paragraph: {
    fontFamily: 'BricolageGrotesque_400Regular',
    fontSize: 15, color: Colors.text, lineHeight: 26, marginBottom: 12,
  },

  commentsSection: { borderTopWidth: 1, borderColor: Colors.border, paddingTop: 20 },
  commentsTitle:   {
    fontFamily: 'BricolageGrotesque_800ExtraBold',
    fontSize: 16, color: Colors.text, marginBottom: 16,
  },

  addComment: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  commentInput: {
    backgroundColor: Colors.inputBg, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, fontFamily: 'BricolageGrotesque_400Regular',
    color: Colors.text, minHeight: 48, textAlignVertical: 'top',
  },
  publishBtn: {
    backgroundColor: Colors.parme,
    borderRadius: 100, paddingVertical: 8, alignItems: 'center',
  },
  publishBtnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 13, color: Colors.white },

  comment: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  commentAuthor: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 13, color: Colors.text },
  commentTime:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted },
  deleteBtn:     { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 11, color: Colors.error, marginLeft: 'auto' },
  commentText:   { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.text, lineHeight: 20 },
  noComments:    { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingVertical: 20 },
});
