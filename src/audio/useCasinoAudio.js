import { useCallback, useEffect, useRef, useState } from 'react';
import { GameAudio } from './GameAudio.js';
import { readAudioPreferences, saveAudioPreferences } from './audioPreferences.js';
function storage() { try { return globalThis.localStorage; } catch { return undefined; } }
export function useCasinoAudio() {
  const [prefs, setPrefs] = useState(() => (typeof location!=='undefined'&&new URLSearchParams(location.search).get('silent')==='1'?{music:false,sfx:false}:readAudioPreferences(storage())));
  const desired = useRef(prefs);
  const ref = useRef(null);
  const [audio, setAudio] = useState(null);
  useEffect(() => {
    const instance = new GameAudio({ volume: 0.62, musicVolume: 0.27 });
    instance.setPreferences(desired.current);
    instance.attach();
    ref.current = instance;
    setAudio(instance);
    const unlock = event => {
      if (event.type === 'keydown' && (event.repeat || event.ctrlKey || event.metaKey || event.altKey)) return;
      void instance.unlock();
    };
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
    return () => {
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      if (ref.current === instance) ref.current = null;
      instance.dispose();
    };
  }, []);
  const toggle = useCallback(channel => {
    const next = { ...desired.current, [channel]: !desired.current[channel] };
    desired.current = next;
    setPrefs(next);
    saveAudioPreferences(storage(), next);
    const instance = ref.current;
    if (instance) { instance.setPreferences(next); void instance.unlock(); }
  }, []);
  const toggleMusic = useCallback(() => toggle('music'), [toggle]);
  const toggleSfx = useCallback(() => toggle('sfx'), [toggle]);
  return { audio, musicEnabled: prefs.music, sfxEnabled: prefs.sfx, toggleMusic, toggleSfx };
}
