/**
 * Buton dili.
 *
 * Uygulamada aynı işi yapan butonlar farklı görünüyordu: kimi yuvarlak kimi
 * köşeli, kimi beyaz kimi turuncu. Kural burada tek yerde tanımlı.
 *
 * - primary: sayfadaki tek asıl eylem (paylaş, kaydet, gönder)
 * - secondary: alternatif eylem (vazgeç, geri dön, ikinci seçenek)
 * - ghost: liste içi hafif eylemler
 * - danger: geri alınamayan eylemler (sil, çıkış, engelle)
 *
 * Hepsi pill; köşeli buton kullanılmıyor. Dokunma alanı en az 44px.
 */

export const campusFocusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0d16]";

const base =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-sm font-black whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-45";

export const campusButton = {
  primary: `${base} bg-[#ff7a45] text-[#12100e] hover:bg-[#ff7a45]/90 ${campusFocusRing}`,
  secondary: `${base} border border-white/14 bg-transparent text-white hover:border-[#ff7a45]/40 hover:bg-[#ff7a45]/8 ${campusFocusRing}`,
  ghost: `${base} bg-transparent px-3 text-white/62 hover:bg-white/7 hover:text-white ${campusFocusRing}`,
  danger: `${base} border border-[#ffb199]/35 bg-transparent text-[#ffb199] hover:bg-[#ffb199]/10 ${campusFocusRing}`,
} as const;

/** Yalnızca ikon taşıyan yuvarlak buton. */
export const campusIconButton = `grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-white/62 transition-colors hover:bg-white/8 hover:text-white ${campusFocusRing}`;

/** Form alanı hata mesajı. */
export const campusFieldError =
  "mt-2 flex items-start gap-1.5 text-xs font-bold text-[#ffb199]";
