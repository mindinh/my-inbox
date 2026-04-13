import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import vi from './locales/vi.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'en',
        interpolation: { escapeValue: false },
        resources: {
            en: { translation: en },
            vi: { translation: vi },
        },
        detection: {
            // Only read from navigator.language — no localStorage/cookie caching
            // so changes to browser language take effect immediately.
            order: ['navigator'],
            caches: [],
        },
    });
// Expose to window for local testing from browser console
if (typeof window !== 'undefined') {
    (window as any).i18n = i18n;
}

export default i18n;
