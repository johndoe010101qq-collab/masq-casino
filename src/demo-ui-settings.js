import { stakeLimits, adjustedStake } from './stake-limits.js';

// Presentation helpers read the committed Hall snapshot. They never draw an
// outcome, change a payout, or write a draft into the active session.
export const uiStakeLimits = (snapshot, game) => snapshot.stakeLimits?.[game] ?? stakeLimits(game);
export const uiBoundedStake = (value, limits) => adjustedStake(value, 1, Infinity, limits);
export const uiPlaybackSpeed = presentation => [1, 1.5, 2, 4].includes(presentation?.speed) ? presentation.speed : 1;
export function applyDemoAudio(audio, presentation) {
  // Master remains at the original level. SFX and music have independent
  // buses, so muting either slider cannot silence the other channel.
  audio?.setVolume(.62);
  audio?.setSfxVolume(presentation.sfxVolume / 100);
  audio?.setMusicVolume(.27 * (presentation.musicVolume / 100));
}
export function applyDemoUiSettings(session, draft, options, audio) {
  const changed = session.setDemoSettings(draft, options);
  if (changed) applyDemoAudio(audio, session.getSnapshot().presentation);
  return changed;
}
