// A decoded media frame advances only its own public presentation step.
// Old clips, backward seeks and large time jumps cannot consume the next card.
export function advanceBlackjackDealerMedia(presentation, stepId, timeMs, ended = false) {
  if (!presentation?.step || presentation.motion?.stepId !== stepId || !Number.isFinite(timeMs)) return false;
  const target = ended ? presentation.step.duration : Math.min(presentation.step.duration, Math.max(0, timeMs));
  let guard = 0;
  while (presentation.step && presentation.motion?.stepId === stepId && presentation.elapsed + 1e-7 < target && guard++ < 100) {
    presentation.advance(Math.min(100, target - presentation.elapsed));
  }
  // Include an exact end frame despite media/container rounding to six decimals.
  if (ended && presentation.step && presentation.motion?.stepId === stepId) {
    presentation.elapsed = presentation.step.duration;
    presentation.advance(0);
  }
  return true;
}
