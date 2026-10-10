// Translation editions from api.alquran.cloud. A curated list is bundled so the
// picker works offline; the full catalogue is loaded on demand in Settings.
export interface TranslationEdition {
  id: string;
  language: string; // ISO code
  name: string;
  direction?: 'ltr' | 'rtl';
}

export const CURATED_TRANSLATIONS: TranslationEdition[] = [
  { id: 'id.indonesian', language: 'id', name: 'Bahasa Indonesia — Kemenag' },
  { id: 'en.sahih', language: 'en', name: 'English — Saheeh International' },
  { id: 'en.transliteration', language: 'en', name: 'Transliteration (Latin)' },
  { id: 'ms.basmeih', language: 'ms', name: 'Bahasa Melayu — Basmeih' },
  { id: 'en.pickthall', language: 'en', name: 'English — Pickthall' },
  { id: 'ar.muyassar', language: 'ar', name: 'العربية — التفسير الميسر', direction: 'rtl' },
  { id: 'ur.jalandhry', language: 'ur', name: 'اردو — Jalandhry', direction: 'rtl' },
  { id: 'tr.diyanet', language: 'tr', name: 'Türkçe — Diyanet İşleri' },
  { id: 'fr.hamidullah', language: 'fr', name: 'Français — Hamidullah' },
  { id: 'de.aburida', language: 'de', name: 'Deutsch — Abu Rida' },
  { id: 'es.cortes', language: 'es', name: 'Español — Cortes' },
  { id: 'nl.keyzer', language: 'nl', name: 'Nederlands — Keyzer' },
  { id: 'ru.kuliev', language: 'ru', name: 'Русский — Kuliev' },
  { id: 'bn.bengali', language: 'bn', name: 'বাংলা — Muhiuddin Khan' },
  { id: 'hi.hindi', language: 'hi', name: 'हिन्दी — Farooq Khan & Nadeem' },
  { id: 'zh.jian', language: 'zh', name: '中文 — Ma Jian' },
  { id: 'ja.japanese', language: 'ja', name: '日本語 — Japanese' },
  { id: 'ko.korean', language: 'ko', name: '한국어 — Korean' },
  { id: 'fa.makarem', language: 'fa', name: 'فارسی — Makarem Shirazi', direction: 'rtl' },
  { id: 'it.piccardo', language: 'it', name: 'Italiano — Piccardo' },
  { id: 'pt.elhayek', language: 'pt', name: 'Português — El-Hayek' },
  { id: 'sw.barwani', language: 'sw', name: 'Kiswahili — Al-Barwani' },
  { id: 'th.thai', language: 'th', name: 'ไทย — Thai' },
  { id: 'bs.korkut', language: 'bs', name: 'Bosanski — Korkut' },
];

const RTL_LANGS = new Set(['ar', 'ur', 'fa', 'ps', 'dv', 'ku', 'sd', 'ug', 'he', 'yi']);

let catalogue: TranslationEdition[] | null = null;

export async function loadAllTranslations(): Promise<TranslationEdition[]> {
  if (catalogue) return catalogue;
  const res = await fetch('https://api.alquran.cloud/v1/edition?format=text&type=translation');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    data: { identifier: string; language: string; name: string; englishName: string; direction?: string }[];
  };
  const fetched: TranslationEdition[] = json.data.map((e) => ({
    id: e.identifier,
    language: e.language,
    name: `${e.language.toUpperCase()} — ${e.englishName}${e.name && e.name !== e.englishName ? ` (${e.name})` : ''}`,
    direction: e.direction === 'rtl' || RTL_LANGS.has(e.language) ? 'rtl' : 'ltr',
  }));
  const ids = new Set(CURATED_TRANSLATIONS.map((t) => t.id));
  catalogue = [...CURATED_TRANSLATIONS, ...fetched.filter((t) => !ids.has(t.id))];
  return catalogue;
}

export function translationInfo(id: string): TranslationEdition {
  return (
    catalogue?.find((t) => t.id === id) ??
    CURATED_TRANSLATIONS.find((t) => t.id === id) ?? { id, language: id.split('.')[0], name: id }
  );
}

export function isRtl(id: string): boolean {
  const t = translationInfo(id);
  return t.direction === 'rtl' || RTL_LANGS.has(t.language);
}
