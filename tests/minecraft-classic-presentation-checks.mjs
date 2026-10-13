import assert from 'node:assert/strict';
import * as THREE from 'three';
import { rules, settle, ROULETTE_NUMBERS } from '../src/game-math.js';
import { CLASSIC_DIE_FACES, CLASSIC_DIE_PIPS, MINECRAFT_PLINKO_GEOMETRY, minecraftCoinPose, minecraftRoulettePose, minecraftTerminalState } from '../src/minecraft-classic-motion.js';
import { plinkoBallPose } from '../src/plinko-motion.js';

let checks = 0;
const close = (a, b, message) => { assert.ok(Math.abs(a - b) < 1e-9, message); checks++; };
const up = new THREE.Vector3(0, 1, 0), front = new THREE.Vector3(0, 0, 1);
for (const face of CLASSIC_DIE_FACES) {
  const drawn = front.clone().applyEuler(new THREE.Euler(...face.rotation));
  close(drawn.distanceTo(new THREE.Vector3(...face.normal)), 0, 'Pips lie on their actual cube face');
  assert.equal(CLASSIC_DIE_PIPS[face.value].length, face.value); checks++;
  const opposite = CLASSIC_DIE_FACES.find(item => item.value === 7 - face.value);
  close(new THREE.Vector3(...face.normal).dot(new THREE.Vector3(...opposite.normal)), -1, 'Opposite physical faces sum to seven');
}
for (let chosen = 1; chosen <= 6; chosen++) {
  const config = rules('dice', chosen);
  for (let ticket = 0; ticket < config.sampleSize; ticket++) {
    const round = settle('dice', chosen, 5, 1000, ticket);
    const face = CLASSIC_DIE_FACES.find(item => item.value === round.value);
    const final = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...face.normal), up)
      .premultiply(new THREE.Quaternion().setFromAxisAngle(up, .4));
    close(new THREE.Vector3(...face.normal).applyQuaternion(final).distanceTo(up), 0, 'The accepted ticket face is physically upward');
  }
}
for (let step = 0; step < 90; step++) {
  const neutral = minecraftCoinPose({ face: 'heads' }, step / 100, true);
  assert.deepEqual(minecraftCoinPose({ face: 'tails' }, step / 100, true), neutral); checks++;
  assert.doesNotThrow(() => minecraftCoinPose({ get face() { throw new Error('Private face read'); } }, step / 100, true)); checks++;
}
for (const face of ['heads', 'tails']) {
  const pose = minecraftCoinPose({ face }, 0, false);
  close(Math.cos(pose.radians), face === 'heads' ? 1 : -1, 'Settled coin exposes the actual physical side');
}
for (const chosen of ['red', 'black', 'green', ...ROULETTE_NUMBERS]) {
  const config = rules('roulette', chosen);
  for (let ticket = 0; ticket < config.sampleSize; ticket++) {
    const round = settle('roulette', chosen, 5, 1000, ticket);
    const pose = minecraftRoulettePose(round, 1, false);
    const index = ((Math.round(pose.angle * 37 / (Math.PI * 2)) % 37) + 37) % 37;
    assert.equal(ROULETTE_NUMBERS[index], round.number); checks++;
    close(pose.wheelDegrees % 360, 0, 'Wheel ends on its original physical pocket map');
    assert.ok(pose.radius >= 1.66 && pose.radius <= 2.30, 'Ball rests inside its actual pocket'); checks++;
  }
}
for (const target of [1.5, 2, 4, 8]) for (let step = 0; step < 92; step++) {
  assert.deepEqual(minecraftTerminalState({ targetMultiplier: target, won: true }, step / 100, true), minecraftTerminalState({ targetMultiplier: target, won: false }, step / 100, true)); checks++;
  assert.doesNotThrow(() => minecraftTerminalState({ targetMultiplier: target, get won() { throw new Error('Private outcome read'); } }, step / 100, true)); checks++;
}

// The rotated cube and the square peg fit strictly within the original contact
// separation. This checks the new geometry against every accepted Plinko path.
const ballRadius = Math.hypot(...MINECRAFT_PLINKO_GEOMETRY.ball) / 2;
const pegRadius = Math.hypot(...MINECRAFT_PLINKO_GEOMETRY.peg.slice(0, 2)) / 2;
const pegs = [];
for (let row = 0; row < 8; row++) for (let column = 0; column <= row; column++) pegs.push([(column - row / 2) * .56, 1.75 - row * .45]);
let minSeparation = Infinity;
for (let ticket = 0; ticket < 256; ticket++) {
  const path = [0]; for (let bit = 0; bit < 8; bit++) path.push(path.at(-1) + ((ticket >> bit) & 1 ? 1 : -1));
  for (let step = 0; step <= 180; step++) {
    const [x, y] = plinkoBallPose(path, step / 180);
    for (const [px, py] of pegs) minSeparation = Math.min(minSeparation, Math.hypot(x - px, y - py));
  }
}
assert.ok(ballRadius + pegRadius < minSeparation, 'Even fully rotated cube balls cannot cut through the block pegs'); checks++;
console.log(JSON.stringify({ passed: true, checks, plinkoMinimum: minSeparation, newBodiesBound: ballRadius + pegRadius, scope: 'Actual engine ticket face/pocket maps, private presentation boundaries and full 256-path Minecraft body clearance' }));
