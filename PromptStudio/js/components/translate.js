// ==========================================================================
// components/translate.js — best-effort IT -> EN translation for custom
// options the user types (e.g. "capelli bianchi" -> "white hair"), so a
// custom button still produces an English prompt fragment like the built-in
// ones. Uses MyMemory's free, keyless, CORS-enabled translation endpoint.
//
// Never presented as guaranteed: on any failure (offline, rate-limited,
// unreachable) the caller falls back to letting the user type the English
// text themselves — see customOptionDialog.js.
// ==========================================================================

const ENDPOINT = "https://api.mymemory.translated.net/get";
const TIMEOUT_MS = 6000;

export async function translateItToEn(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `${ENDPOINT}?q=${encodeURIComponent(trimmed)}&langpair=it|en`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error("Servizio di traduzione non disponibile");
    const json = await res.json();
    const translated = json && json.responseData && json.responseData.translatedText;
    if (!translated || /INVALID|MYMEMORY WARNING|QUERY LENGTH/i.test(translated)) {
      throw new Error("Traduzione non riuscita");
    }
    return translated;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
