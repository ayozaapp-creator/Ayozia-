import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import i18n from '../../i18n'; // Importiere i18n

const BG = '#050505';
const CARD = '#141414';
const BORDER = '#1f1f1f';
const TXT = '#ffffff';
const TXT_DIM = '#b5b5b5';
const ACCENT = '#ff4fd8';

type LanguageCode = 'de' | 'en' | 'sq' | 'fr' | 'es' | 'tr';

type LanguageItem = {
  code: LanguageCode;
  label: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const LANGUAGES: LanguageItem[] = [
  { code: 'de', label: 'Deutsch', subtitle: 'Empfohlen', icon: 'flag-outline' },
  { code: 'en', label: 'Englisch', subtitle: 'International', icon: 'earth-outline' },
  { code: 'sq', label: 'Albanisch', subtitle: 'Shqip', icon: 'flag-outline' },
  { code: 'fr', label: 'Französisch', subtitle: 'Français', icon: 'flag-outline' },
  { code: 'es', label: 'Spanisch', subtitle: 'Español', icon: 'flag-outline' },
  { code: 'tr', label: 'Türkisch', subtitle: 'Türkçe', icon: 'flag-outline' },
];

const DEFAULT_LANG: LanguageCode = 'de';
const STORAGE_KEY = 'language';

const LanguageSettingsScreen: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<LanguageCode>(DEFAULT_LANG);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setSelected(stored as LanguageCode);
        }
      } catch {
        Alert.alert('Fehler', 'Sprache konnte nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const changeLanguage = async (code: LanguageCode) => {
    try {
      setSaving(true);
      setSelected(code);

      await AsyncStorage.setItem(STORAGE_KEY, code); // Speichern der Sprache
      i18n.changeLanguage(code); // Globaler Sprachwechsel
    } catch (e) {
      Alert.alert('Fehler', 'Sprache konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const currentLang = LANGUAGES.find((l) => l.code === selected);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back-outline" size={24} color={TXT} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{i18n.t('language.title')}</Text>
          <View style={styles.headerAccentBar} />
        </View>

        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="small" color={ACCENT} />
        </View>
      ) : (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={20} color={ACCENT} />
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.infoTitle}>{i18n.t('language.activeLanguage')}</Text>
              <Text style={styles.infoText}>
                {currentLang?.label} <Text style={{ color: TXT_DIM }}>({currentLang?.code.toUpperCase()})</Text>
              </Text>
              <Text style={styles.infoHint}>
                {i18n.t('language.hint')}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            {LANGUAGES.map((lang, index) => {
              const isActive = lang.code === selected;
              const isLast = index === LANGUAGES.length - 1;

              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.row, !isLast && styles.rowBorder]}
                  onPress={() => changeLanguage(lang.code)}
                >
                  <View style={styles.rowLeft}>
                    <View style={styles.iconBubble}>
                      <Ionicons name={lang.icon} size={18} color={TXT} />
                    </View>
                    <View>
                      <Text style={styles.rowLabel}>{lang.label}</Text>
                      {lang.subtitle && (
                        <Text style={styles.rowSubtitle}>{lang.subtitle}</Text>
                      )}
                    </View>
                  </View>

                  <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
                    {isActive && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {saving && (
            <View style={styles.savingRow}>
              <ActivityIndicator size="small" color={ACCENT} />
              <Text style={styles.savingText}>{i18n.t('language.saving')}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default LanguageSettingsScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: ACCENT, fontSize: 18, fontWeight: '700' },
  headerAccentBar: { marginTop: 3, width: 40, height: 3, borderRadius: 999, backgroundColor: ACCENT },
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
  content: { padding: 16 },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  infoTitle: { color: TXT, fontSize: 14, fontWeight: '600' },
  infoText: { color: TXT, fontSize: 15, marginTop: 2 },
  infoHint: { color: TXT_DIM, fontSize: 12, marginTop: 4 },
  card: { backgroundColor: CARD, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: BORDER },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, justifyContent: 'space-between' },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  iconBubble: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: '#1f1f1f',
    borderWidth: 1,
    borderColor: ACCENT,
  },
  rowLabel: { color: TXT, fontSize: 15 },
  rowSubtitle: { color: TXT_DIM, fontSize: 12 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: TXT_DIM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: { borderColor: ACCENT },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  savingRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center' },
  savingText: { marginLeft: 8, color: TXT_DIM, fontSize: 12 },
});
