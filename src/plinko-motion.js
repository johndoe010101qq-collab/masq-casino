// Prefix choices remain private; this renderer follows their peg contacts.
export function plinkoBallPose(path, progress) {
  const s = Math.max(0, Math.min(1, progress)) * 9;
  if (s < 1) return [0, 2.18 - .27 * s * s, .24];
  const row = Math.min(7, Math.floor(s) - 1);
  const u = s >= 9 ? 1 : s - row - 1;
  const x0 = path[row] * .28, x1 = path[row + 1] * .28;
  const y0 = 1.91 - row * .45;
  const last = row === 7, y1 = last ? -1.79 : 1.91 - (row + 1) * .45;
  return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u + 4 * (last ? .20 : .16) * u * (1 - u), .24];
}
