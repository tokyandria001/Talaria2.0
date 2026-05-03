import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Modal, ActivityIndicator, Image, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import client from '../api/client';
import { Colors } from '../constants/Colors';

const CATEGORIES = ['Itinéraires', 'Aventures', 'Éco-Tourisme', 'Logements', 'Conseils'];
const API_BASE = client.defaults.baseURL;

export default function WriteArticleModal({ visible, onClose, onSaved, article }) {
  const editing = !!article;

  const [form, setForm] = useState({
    title:    article?.title    ?? '',
    category: article?.category ?? '',
    content:  article?.content  ?? '',
    excerpt:  article?.excerpt  ?? '',
  });
  const [coverPath,   setCoverPath]   = useState(article?.coverImage ?? null);
  const [previewUri,  setPreviewUri]  = useState(article?.coverImage ? `${API_BASE}${article.coverImage}` : null);
  const [uploading,   setUploading]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [errors,      setErrors]      = useState({});

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission refusée', 'Autorise l\'accès à la galerie dans les paramètres.'); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setPreviewUri(asset.uri);
    setCoverPath(null);
    setUploading(true);

    try {
      const ext  = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const fd   = new FormData();
      fd.append('cover', { uri: asset.uri, name: `cover.${ext}`, type: mime });
      const { data } = await client.post('/api/articles/upload-cover', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCoverPath(data.path);
    } catch (err) {
      Alert.alert('Erreur upload', err.response?.data?.message ?? 'Impossible d\'uploader l\'image.');
      setPreviewUri(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    const errs = {};
    if (!form.title.trim())   errs.title    = 'Le titre est requis.';
    if (!form.category)       errs.category = 'Choisissez une catégorie.';
    if (!form.content.trim()) errs.content  = 'Le contenu est requis.';
    if (uploading)            errs.global   = 'Attendez la fin de l\'upload.';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setErrors({});
    setSaving(true);
    try {
      const payload = {
        title:      form.title.trim(),
        category:   form.category,
        content:    form.content.trim(),
        coverImage: coverPath ?? null,
        excerpt:    form.excerpt.trim() || null,
      };
      if (editing) await client.put(`/api/articles/${article.id}`, payload);
      else         await client.post('/api/articles', payload);
      onSaved();
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors) setErrors(data.errors);
      else setErrors({ global: data?.message ?? 'Une erreur est survenue.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>Annuler</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{editing ? 'Modifier' : 'Écrire un article'}</Text>
          <TouchableOpacity
            style={[styles.publishBtn, (saving || uploading) && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={saving || uploading}
          >
            {saving
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={styles.publishBtnText}>{editing ? 'Enregistrer' : 'Publier'}</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Cover image */}
          {previewUri ? (
            <View style={styles.coverWrap}>
              <Image source={{ uri: previewUri }} style={styles.coverPreview} resizeMode="cover" />
              {uploading && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="large" color={Colors.white} />
                  <Text style={styles.uploadingText}>Upload en cours...</Text>
                </View>
              )}
              {!uploading && (
                <View style={styles.coverActions}>
                  <TouchableOpacity style={styles.coverBtn} onPress={pickImage}>
                    <Text style={styles.coverBtnText}>Changer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.coverBtn, { backgroundColor: '#dc2626' }]}
                    onPress={() => { setPreviewUri(null); setCoverPath(null); }}
                  >
                    <Text style={styles.coverBtnText}>Supprimer</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
              <Text style={styles.uploadIcon}>🖼</Text>
              <Text style={styles.uploadLabel}>Ajouter une image de couverture</Text>
              <Text style={styles.uploadHint}>JPEG, PNG, WebP · max 5 Mo</Text>
            </TouchableOpacity>
          )}

          {/* Title */}
          <Text style={styles.fieldLabel}>Titre *</Text>
          <TextInput
            style={[styles.input, errors.title && styles.inputError]}
            placeholder="Un titre accrocheur..."
            placeholderTextColor={Colors.textMuted}
            value={form.title}
            onChangeText={set('title')}
          />
          {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

          {/* Category */}
          <Text style={styles.fieldLabel}>Catégorie *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.catPill, form.category === c && styles.catPillActive]}
                onPress={() => set('category')(c)}
              >
                <Text style={[styles.catPillText, form.category === c && styles.catPillTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}

          {/* Excerpt */}
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
            Résumé <Text style={{ color: Colors.textMuted, fontFamily: 'BricolageGrotesque_400Regular' }}>(optionnel)</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Une phrase pour accrocher le lecteur..."
            placeholderTextColor={Colors.textMuted}
            value={form.excerpt}
            onChangeText={set('excerpt')}
          />

          {/* Content */}
          <Text style={styles.fieldLabel}>
            Contenu * <Text style={{ color: Colors.textMuted }}>{form.content.length} car.</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.textarea, errors.content && styles.inputError]}
            placeholder="Racontez votre voyage, partagez vos conseils..."
            placeholderTextColor={Colors.textMuted}
            multiline
            value={form.content}
            onChangeText={set('content')}
            textAlignVertical="top"
          />
          {errors.content && <Text style={styles.errorText}>{errors.content}</Text>}

          {errors.global && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errors.global}</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderColor: Colors.border,
  },
  cancel: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 15, color: Colors.textMuted },
  title:  { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 16, color: Colors.text },
  publishBtn: {
    backgroundColor: Colors.parme,
    borderRadius: 100, paddingHorizontal: 16, paddingVertical: 8,
  },
  publishBtnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 13, color: Colors.white },

  scroll: { padding: 16, paddingBottom: 40 },

  uploadBtn: {
    backgroundColor: Colors.inputBg,
    borderRadius: 16, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed',
    padding: 28, alignItems: 'center', gap: 6, marginBottom: 20,
  },
  uploadIcon:  { fontSize: 28 },
  uploadLabel: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 14, color: Colors.text },
  uploadHint:  { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.textMuted },

  coverWrap:        { borderRadius: 16, overflow: 'hidden', marginBottom: 20, position: 'relative' },
  coverPreview:     { width: '100%', height: 180 },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  uploadingText: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.white },
  coverActions: {
    position: 'absolute', bottom: 10, right: 10,
    flexDirection: 'row', gap: 8,
  },
  coverBtn: {
    backgroundColor: Colors.parme,
    borderRadius: 100, paddingHorizontal: 14, paddingVertical: 7,
  },
  coverBtnText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 12, color: Colors.white },

  fieldLabel: {
    fontFamily: 'BricolageGrotesque_600SemiBold',
    fontSize: 13, color: Colors.text, marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.inputBg, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14, fontFamily: 'BricolageGrotesque_400Regular',
    color: Colors.text, marginBottom: 12,
  },
  textarea:   { height: 160 },
  inputError: { borderWidth: 1.5, borderColor: Colors.error },

  catPill: {
    borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.inputBg, marginRight: 8, marginBottom: 12,
  },
  catPillActive:    { backgroundColor: Colors.parme },
  catPillText:      { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.textMuted },
  catPillTextActive: { color: Colors.white },

  errorText: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 12, color: Colors.error, marginBottom: 8 },
  errorBox:  { backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginTop: 8 },
});
