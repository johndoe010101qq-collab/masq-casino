// Presentation coordinates only; payouts are copied from the engine unchanged.
export function layoutBonanzaPayouts(wins = []) {
  const width = 30, height = 15;
  const options = wins.map(win => {
    const cells = win.cells || [];
    const center = cells.reduce((point, cell) => ({
      x: point.x + (cell.column + .5) / 6 * 100 / cells.length,
      y: point.y + (cell.row + .5) / 5 * 100 / cells.length
    }), {x: 0, y: 0});
    const candidates = cells.map(cell => ({
      x: Math.max(16, Math.min(84, (cell.column + .5) / 6 * 100)),
      y: (cell.row + .5) / 5 * 100,
      anchorId: cell.id
    }));
    return candidates.sort((a, b) =>
      Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y));
  });
  const placed = [];
  function fit(index) {
    if (index === wins.length) return true;
    for (const candidate of options[index]) {
      if (placed.some(other => Math.abs(other.x - candidate.x) < width + 1
        && Math.abs(other.y - candidate.y) < height + 1)) continue;
      placed.push(candidate);
      if (fit(index + 1)) return true;
      placed.pop();
    }
    return false;
  }
  // A 6×5 pay-anywhere board has at most three winning groups (8+ cells each).
  // Backtracking chooses disjoint labels anchored in those groups' own cells.
  if (wins.length && !fit(0)) throw new TypeError('Winning groups have no readable payout layout.');
  return Object.freeze(wins.map((win, index) => Object.freeze({
    kind: win.kind, count: win.count, payoutCents: win.payoutCents,
    cells: win.cells, ...placed[index], width, height,
    id: win.kind + ':' + win.cells.map(cell => cell.id).join(',')
  })));
}

// Feed these style values into the existing keyed slot-cell element.
export function slotCellPresentation(cell, visual) {
  const column = cell.column, row = cell.row;
  const fresh = (visual?.refill || []).filter(item => item.column === column);
  const isNew = fresh.some(item => item.cell.id === cell.id);
  return {
    style: {
      '--column': column, '--row': row,
      // All incoming cells start above the board, one full cell apart.
      '--spawn-row': isNew ? row - fresh.length : row
    },
    incoming: isNew,
    scatterActive: (visual?.scatterIds || []).includes(cell.id)
  };
}
