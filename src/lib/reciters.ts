// Reciters served per-ayah by everyayah.com (proxied through /audio/).
export interface Reciter {
  id: string; // everyayah folder name
  name: string;
}

export const RECITERS: Reciter[] = [
  { id: 'Yasser_Ad-Dussary_128kbps', name: 'Yasser Al-Dossari' },
  { id: 'Alafasy_128kbps', name: 'Mishary Rashid Alafasy' },
  { id: 'Husary_128kbps', name: 'Mahmoud Khalil Al-Husary' },
  { id: 'Abdul_Basit_Murattal_192kbps', name: 'Abdul Basit (Murattal)' },
  { id: 'Minshawy_Murattal_128kbps', name: 'Muhammad Siddiq Al-Minshawi' },
  { id: 'Abdurrahmaan_As-Sudais_192kbps', name: 'Abdurrahman As-Sudais' },
  { id: 'Saood_ash-Shuraym_128kbps', name: "Sa'ud Ash-Shuraim" },
  { id: 'MaherAlMuaiqly128kbps', name: 'Maher Al-Muaiqly' },
  { id: 'Ghamadi_40kbps', name: "Sa'ad Al-Ghamdi" },
  { id: 'Nasser_Alqatami_128kbps', name: 'Nasser Al-Qatami' },
  { id: 'Hudhaify_128kbps', name: 'Ali Al-Hudhaify' },
  { id: 'Muhammad_Ayyoub_128kbps', name: 'Muhammad Ayyoub' },
];

export const DEFAULT_RECITER = RECITERS[0].id;
export const reciterName = (id: string) => RECITERS.find((r) => r.id === id)?.name ?? id;

const pad3 = (n: number) => String(n).padStart(3, '0');
export const audioFile = (surah: number, ayah: number) => `${pad3(surah)}${pad3(ayah)}.mp3`;
/** Same-origin (proxied, CORS-enabled, cacheable). */
export const proxiedAudioUrl = (reciter: string, surah: number, ayah: number) =>
  `/audio/${reciter}/${audioFile(surah, ayah)}`;
/** Direct fallback if the app is hosted somewhere without the proxy. */
export const directAudioUrl = (reciter: string, surah: number, ayah: number) =>
  `https://everyayah.com/data/${reciter}/${audioFile(surah, ayah)}`;
