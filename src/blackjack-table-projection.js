// Native 1920 × 1080 coordinates shared by the dealer video and DOM cards.
// Camera/table values are copied from the approved offline scene metadata;
// this module has no renderer, clock, card identity, or gameplay dependency.
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export const BLACKJACK_TABLE_SCENE = freeze({
  width: 1920,
  height: 1080,
  mobileCrop: [656, 1264],
  shoe: { x: 1187, y: 564 },
  camera: { fov: 24, target: [0, 16.5, 14], dir: [0, 0.38, 1], distance: 94 },
  table: {
    top: 12.4, back: 5, halfWidth: 44, frontCenter: 33, frontEdge: 20,
    shoe: { pos: [11, 12.4, 9.8], yaw: 0.45, mouth: [8.7, 14.4, 11.1] },
    areas: { dealer: [0, 12.4, 13], player: [0, 12.4, 25] },
  },
  // Guide outlines identify anchors, not a clipping mask. Larger portrait
  // cards occupy the surrounding clear felt without moving the video scene.
  areas: {
    dealer: [[754, 607], [1166, 607], [1176, 658], [744, 658]],
    player: [[700, 733], [1220, 733], [1238, 812], [682, 812]],
  },
  centers: { dealer: [960, 632], player: [960, 771] },
  renderBounds: {
    dealer: { left: -8, right: 8, back: 9.4, front: 16.6 },
    player: { left: -9, right: 9, back: 21.4, front: 28.6 },
  },
  card: { width: 200, height: 300, worldWidth: 4.4, worldHeight: 6.6 },
});

const { width, height, camera, table, card: cardSize } = BLACKJACK_TABLE_SCENE;
const directionLength = Math.hypot(...camera.dir);
const directionY = camera.dir[1] / directionLength;
const directionZ = camera.dir[2] / directionLength;
const focal = (height / 2) / Math.tan(camera.fov * Math.PI / 360);
const cameraPosition = {
  x: camera.target[0],
  y: camera.target[1] + directionY * camera.distance,
  z: camera.target[2] + directionZ * camera.distance,
};
const rect = freeze({ width: cardSize.width, height: cardSize.height });
const maxFanAngle = 0.035;

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite.`);
  return value;
}

/** Project a source-scene world point with the approved fixed camera. */
export function projectBlackjackTablePoint(point) {
  const x = finite(point?.x, 'Point x') - camera.target[0];
  const y = finite(point?.y, 'Point y') - camera.target[1];
  const z = finite(point?.z, 'Point z') - camera.target[2];
  const depth = camera.distance - directionY * y - directionZ * z;
  if (depth <= 0) throw new RangeError('Point is behind the dealer camera.');
  const projected = {
    x: width / 2 + focal * x / depth,
    y: height / 2 - focal * (directionZ * y - directionY * z) / depth,
    depth,
  };
  if (!Object.values(projected).every(Number.isFinite)) throw new RangeError('Point projection overflowed.');
  return freeze(projected);
}

// Intersect a screen ray with a horizontal plane. The default shoe position
// uses the rounded, approved metadata coordinates exactly, rather than adding
// a half-pixel discrepancy from projecting its unrounded world position.
function screenPointAtHeight(point, worldY) {
  const rayX = (finite(point?.x, 'Origin x') - width / 2) / focal;
  const screenY = (height / 2 - finite(point?.y, 'Origin y')) / focal;
  const rayY = directionZ * screenY - directionY;
  const rayZ = -directionY * screenY - directionZ;
  if (Math.abs(rayY) < 1e-12) throw new RangeError('Origin ray is parallel to the card plane.');
  const distance = (worldY - cameraPosition.y) / rayY;
  if (distance <= 0) throw new RangeError('Origin is behind the dealer camera.');
  return { x: cameraPosition.x + rayX * distance, y: worldY, z: cameraPosition.z + rayZ * distance };
}

// Homography from a portrait source rectangle to TL, TR, BR, BL. CSS uses
// column-major matrix3d; its fourth row performs the perspective division.
function cardMatrix(corners) {
  const [p0, p1, p2, p3] = corners;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy3 = p0.y - p1.y + p2.y - p3.y;
  const determinant = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(determinant) < 1e-12) throw new RangeError('Card projection is degenerate.');
  const g = (dx3 * dy2 - dx2 * dy3) / determinant;
  const h = (dx1 * dy3 - dx3 * dy1) / determinant;
  const a = p1.x - p0.x + g * p1.x;
  const b = p3.x - p0.x + h * p3.x;
  const d = p1.y - p0.y + g * p1.y;
  const e = p3.y - p0.y + h * p3.y;
  return freeze([
    a / rect.width, d / rect.width, 0, g / rect.width,
    b / rect.height, e / rect.height, 0, h / rect.height,
    0, 0, 1, 0,
    p0.x, p0.y, 0, 1,
  ]);
}

function cardGeometry(index, side, worldCenter, angle) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const halfWidth = cardSize.worldWidth / 2, halfHeight = cardSize.worldHeight / 2;
  const worldCorners = [[-halfWidth, -halfHeight], [halfWidth, -halfHeight],
    [halfWidth, halfHeight], [-halfWidth, halfHeight]].map(([x, z]) => ({
      x: worldCenter.x + cos * x + sin * z,
      y: worldCenter.y,
      z: worldCenter.z - sin * x + cos * z,
    }));
  const corners = worldCorners.map(projectBlackjackTablePoint);
  const matrix3d = cardMatrix(corners);
  return freeze({
    index, side, rect, corners, worldCorners, matrix3d,
    cssTransform: `matrix3d(${matrix3d.join(',')})`,
    center: projectBlackjackTablePoint(worldCenter), worldCenter: { ...worldCenter }, angle,
  });
}

/** All actual cards remain on the felt, including compressed 21-card hands. */
export function blackjackTableHand(side, count) {
  if (side !== 'dealer' && side !== 'player') throw new RangeError('Hand side must be dealer or player.');
  const bounds = BLACKJACK_TABLE_SCENE.renderBounds[side];
  if (!Number.isInteger(count) || count < 0 || count > 21) {
    throw new RangeError('Hand count must be an integer from 0 to 21.');
  }
  if (count === 0) return freeze([]);
  const maximumWidth = cardSize.worldWidth * Math.cos(maxFanAngle) + cardSize.worldHeight * Math.sin(maxFanAngle);
  const availableSpan = bounds.right - bounds.left - maximumWidth - 0.5;
  const spacing = count === 1 ? 0 : Math.min(5.2, availableSpan / (count - 1));
  const centerZ = table.areas[side][2];
  return freeze(Array.from({ length: count }, (_, index) => {
    const fraction = count === 1 ? 0 : 2 * index / (count - 1) - 1;
    const center = { x: (index - (count - 1) / 2) * spacing, y: table.top,
      z: centerZ + 0.1 * fraction * fraction };
    return cardGeometry(index, side, center, -fraction * maxFanAngle);
  }));
}

/** A caller's presentation progress is the only clock. No extra deal timer. */
export function blackjackTableCardFlight(card, progress, {
  reducedMotion = false, origin = BLACKJACK_TABLE_SCENE.shoe, lift = 3,
} = {}) {
  if (!card?.worldCenter || !Number.isFinite(card.angle)) throw new TypeError('A projected table card is required.');
  if (reducedMotion) return card;
  const t = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  if (t === 1) return card;
  const source = screenPointAtHeight(origin, table.shoe.mouth[1]);
  const amount = t * t * (3 - 2 * t);
  const liftAmount = Math.max(0, Math.min(8, Number.isFinite(lift) ? lift : 3));
  const center = {
    x: source.x + (card.worldCenter.x - source.x) * amount,
    y: source.y + (card.worldCenter.y - source.y) * amount + Math.sin(Math.PI * t) ** 2 * liftAmount,
    z: source.z + (card.worldCenter.z - source.z) * amount,
  };
  const sourceAngle = table.shoe.yaw + Math.PI / 2;
  return cardGeometry(card.index, card.side, center, sourceAngle + (card.angle - sourceAngle) * amount);
}
