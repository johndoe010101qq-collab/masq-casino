export const AUDIO_PREFERENCES_KEY = 'indictus.audio.v1';
export function readAudioPreferences(storage) {
  const defaults = { music: true, sfx: true };
  try {
    const value = JSON.parse(storage?.getItem(AUDIO_PREFERENCES_KEY) ?? 'null');
    if (!value || typeof value !== 'object') return defaults;
    return { music: typeof value.music === 'boolean' ? value.music : true, sfx: typeof value.sfx === 'boolean' ? value.sfx : true };
  } catch { return defaults; }
}
export function saveAudioPreferences(storage, prefs) {
  try { storage?.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify(prefs)); } catch {}
}
