import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import sq from './locales/sq.json';
import tr from './locales/tr.json';

const resources = {
  de: { translation: de },
  en: { translation: en },
  sq: { translation: sq },
  fr: { translation: fr },
  es: { translation: es },
  tr: { translation: tr },
};

i18n.use(initReactI18next).init({
  resources,
  fallbackLng: 'en',
  lng: 'de',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

// 🔁 gespeicherte Sprache laden
(async () => {
  const savedLang = await AsyncStorage.getItem('language');
  if (savedLang) {
    i18n.changeLanguage(savedLang);
  }
})();

export default i18n;
