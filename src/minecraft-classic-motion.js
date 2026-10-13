import { rasterCoinPose } from './raster-coin-motion.js';
import { rasterRoulettePose } from './raster-roulette-motion.js';
import { upgradeTerminalPose, terminalCode } from './upgrader-presentation.js';

export const CLASSIC_DIE_FACES = Object.freeze([
  Object.freeze({ value: 1, normal: [0, 1, 0], at: [0, .551, 0], rotation: [-Math.PI / 2, 0, 0] }),
  Object.freeze({ value: 6, normal: [0, -1, 0], at: [0, -.551, 0], rotation: [Math.PI / 2, 0, 0] }),
  Object.freeze({ value: 2, normal: [0, 0, 1], at: [0, 0, .551], rotation: [0, 0, 0] }),
  Object.freeze({ value: 5, normal: [0, 0, -1], at: [0, 0, -.551], rotation: [0, Math.PI, 0] }),
  Object.freeze({ value: 3, normal: [1, 0, 0], at: [.551, 0, 0], rotation: [0, Math.PI / 2, 0] }),
  Object.freeze({ value: 4, normal: [-1, 0, 0], at: [-.551, 0, 0], rotation: [0, -Math.PI / 2, 0] }),
]);
export const CLASSIC_DIE_PIPS = Object.freeze({
  1: [[0, 0]], 2: [[-.23, .23], [.23, -.23]], 3: [[-.23, .23], [0, 0], [.23, -.23]],
  4: [[-.23, -.23], [-.23, .23], [.23, -.23], [.23, .23]],
  5: [[-.23, -.23], [-.23, .23], [0, 0], [.23, -.23], [.23, .23]],
  6: [[-.23, -.26], [-.23, 0], [-.23, .26], [.23, -.26], [.23, 0], [.23, .26]],
});
export const MINECRAFT_PLINKO_GEOMETRY = Object.freeze({ peg: [.05, .05, .20], pegFace: [.045, .045, .012], ball: [.14, .14, .14] });
export const classicProgress = (round, progress, playing, reduced = false) => reduced && round ? 1 : playing ? Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0)) : round ? 1 : 0;

// The private result is never read during the common, unrevealed coin motion.
export function minecraftCoinPose(round, progress, playing, reduced = false) {
  const p = classicProgress(round, progress, playing, reduced);
  const pose = rasterCoinPose(p, p >= .9 ? round?.face : 'heads');
  return Object.freeze({ ...pose, progress: p, radians: pose.turnDegrees * Math.PI / 180 });
}

export function minecraftRoulettePose(round, progress, playing, reduced = false) {
  const p = classicProgress(round, progress, playing, reduced);
  const pose = rasterRoulettePose(round?.pocketIndex ?? 0, p);
  const angle = Math.atan2(pose.ballX - 50, 50 - pose.ballY);
  return Object.freeze({ ...pose, progress: p, angle, radius: Math.hypot(pose.ballX - 50, pose.ballY - 50) / 43 * 2.35 });
}

export function minecraftTerminalState(round, progress, playing, targetChoice = 2, reduced = false) {
  const pose = upgradeTerminalPose(classicProgress(round, progress, playing, reduced), !!round);
  const outcome = pose.reveal ? round.won ? 'success' : 'denied' : 'pending';
  const title = pose.reveal ? round.won ? 'Доступ открыт' : 'Доступ закрыт'
    : pose.phase === 'idle' ? 'Готов к взлому' : pose.phase === 'connect' ? 'Подключение' : pose.phase === 'scan' ? 'Поиск ключа' : 'Расшифровка';
  return Object.freeze({ ...pose, outcome, title, multiplier: round?.targetMultiplier ?? targetChoice,
    code: pose.reveal ? round.won ? 'ACCESS GRANTED' : 'ACCESS DENIED' : terminalCode(pose.codeTick, pose.phase !== 'idle') });
}
