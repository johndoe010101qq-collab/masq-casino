import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { HallSession } from '../src/hall-session.js';
import GameMath from '../src/game-math.js';
import { PlinkoFlightController,plinkoInstanceCapacity,ensurePlinkoInstanceCapacity } from '../src/plinko-controller.js';
import { createBlackjackHand, finishBlackjack } from '../src/blackjack.js';

const sessionFor = (balance = 1000, houseCapitalCents = 100000000) => {
  let ticket = 0;
  return new HallSession(GameMath, maximum => (ticket++ * 73) % maximum, {initialBalanceCents:Math.round(balance*100),houseCapitalCents});
};
function scheduler() {
  let next = 0, peak = 0;
  const frames = new Map();
  return {
    requestFrame: callback => { frames.set(++next, callback); peak = Math.max(peak, frames.size); return next; },
    cancelFrame: id => frames.delete(id),
    flush: now => { const entry = frames.entries().next().value; if (!entry) return;
      frames.delete(entry[0]); entry[1](now); },
    get size() { return frames.size; }, get peak() { return peak; },
  };
}

// One synchronous debit per accepted launch; rapid clicks never use a stale UI
// balance. More than 200 accepted launches can coexist with zero house capital.
{
  const session = sessionFor(100000,0);
  const rounds = Array.from({ length: 250 }, (_, i) => session.begin('plinko', 'standard', (i % 10 + 1) * 10));
  assert.equal(session.active.size, 250);
  assert.equal(session.getSnapshot().activeCount, 250);
  assert.equal(session.pending, rounds[0]);
  assert.equal(session.getSnapshot().balance, 86250);
  assert.equal(session.getSnapshot().history.length, 0);
  assert.equal(session.getSnapshot().result, null);
  rounds.push(session.begin('plinko', 'standard', 10));
  assert.equal(session.getSnapshot().balance,86240);
  assert.equal(session.id, 251);
  assert.equal(session.getReserveSnapshot().bankCents,0);
  assert.equal(session.getReserveSnapshot().reservedCents,rounds.reduce((sum,r)=>sum+r.stakeCents*28,0));
  assert.equal(session.getReserveSnapshot().availableCents,-session.getReserveSnapshot().reservedCents);
  assert.equal(session.begin('coinflip', 'heads', 10), null);
  assert.equal(session.begin('slots', 'bonanza', 10), null);
  assert.equal(session.beginBlackjack(10), null);
  assert.equal(session.reset(), false);

  // A permutation of completion order preserves every debit and every credit.
  let expected = 8624000;
  for (let i = 0; i < 251; i++) {
    const round = rounds[(i * 37) % 251];
    expected += round.payoutCents;
    assert.equal(session.complete(round.id), true);
    assert.equal(Math.round(session.getSnapshot().balance * 100), expected);
    const closed = session.getSnapshot();
    assert.equal(session.complete(round.id), false);
    assert.equal(session.getSnapshot(), closed);
  }
  assert.equal(session.getSnapshot().busy, false);
  assert.equal(session.getSnapshot().pendingGame, null);
  assert.equal(session.pending, null);
  assert.equal(session.getSnapshot().history.length, 20);
  assert.equal(session.getReserveSnapshot().reservedCents,0);
  assert.equal(session.balanceCents+session.getReserveSnapshot().bankCents,10000000);
}

// Every worst-case payout is honoured, even after the bank goes into debt.
// Landing order and repeated completion cannot lose or duplicate a cent.
for(const houseCapitalCents of [0,100]){
 const count=237,opening=6000000;let draws=0;
 const session=new HallSession(GameMath,()=>{draws++;return 0;},{initialBalanceCents:opening,houseCapitalCents});
 const rounds=Array.from({length:count},()=>session.begin('plinko','standard',250));
 assert.equal(draws,count);assert.equal(session.active.size,count);assert(rounds.every(r=>r.payoutCents===725000));
 assert.equal(session.getReserveSnapshot().reservedCents,count*700000);
 assert.equal(session.getReserveSnapshot().availableCents,houseCapitalCents-count*700000);
 for(let i=0;i<count;i++){const r=rounds[i*41%count];assert.equal(session.complete(r.id),true);assert.equal(session.complete(r.id),false);}
 assert.equal(draws,count);assert.equal(session.balanceCents,opening+count*700000);
 assert.deepEqual(session.getReserveSnapshot(),{bankCents:houseCapitalCents-count*700000,reservedCents:0,availableCents:houseCapitalCents-count*700000,activeCount:0});
 assert.equal(session.balanceCents+session.getReserveSnapshot().bankCents,opening+houseCapitalCents);
 const wallet=session.balanceCents,book=session.getReserveSnapshot();
 assert.throws(()=>session.begin('coinflip','heads',5),/Ставка временно недоступна/);
 assert.equal(draws,count);assert.equal(session.balanceCents,wallet);assert.deepEqual(session.getReserveSnapshot(),book);
 const another=session.begin('plinko','standard',5);assert(another);assert.equal(draws,count+1);assert.equal(session.complete(another.id),true);
}

// A failed draw or engine result releases only its own hold. Earlier balls,
// their debits and their future settlements stay intact.
for(const failure of ['rng','engine','cap']){
 let fail=false,draws=0;
 const math=failure==='engine'?{rules:GameMath.rules,settle(...args){if(fail)throw new Error('engine fixture');return GameMath.settle(...args);}}:failure==='cap'?{rules:GameMath.rules,settle(...args){return fail?{payout:99999999}:GameMath.settle(...args);}}:GameMath;
 const session=new HallSession(math,()=>{draws++;if(fail&&failure==='rng')throw new Error('rng fixture');return 0;},{initialBalanceCents:1000000,houseCapitalCents:0});
 const accepted=session.begin('plinko','standard',5),before=session.getSnapshot(),reserve=session.getReserveSnapshot();fail=true;
 assert.throws(()=>session.begin('plinko','standard',5));assert.equal(draws,2);assert.equal(session.getSnapshot(),before);assert.deepEqual(session.getReserveSnapshot(),reserve);assert.equal(session.id,1);assert.equal(session.active.size,1);
 assert.equal(session.complete(accepted.id),true);assert.equal(session.complete(accepted.id),false);assert.equal(session.getReserveSnapshot().reservedCents,0);
}
// Multiple maximum credits must fit together, before RNG. A large wallet has
// no permission to accept an unrepresentable future balance or orphan a ball.
{
 let draws=0;const session=new HallSession(GameMath,()=>{draws++;return 0;},{initialBalanceCents:Number.MAX_SAFE_INTEGER-14000,houseCapitalCents:0}),frames=scheduler(),controller=new PlinkoFlightController(session,frames);
 controller.attach();const first=controller.launch(5),before=session.getSnapshot(),book=session.getReserveSnapshot();assert(first);
 assert.throws(()=>controller.launch(5),/числового диапазона/);assert.equal(draws,1);assert.equal(session.getSnapshot(),before);assert.deepEqual(session.getReserveSnapshot(),book);assert.equal(session.id,1);assert.equal(controller.activeCount,1);
 frames.flush(0);frames.flush(3800);assert.equal(session.balanceCents,Number.MAX_SAFE_INTEGER);assert.equal(session.complete(first),false);assert.equal(controller.activeCount,0);assert.equal(session.getReserveSnapshot().reservedCents,0);assert.equal(session.getReserveSnapshot().bankCents,-14000);controller.detach();
}
{
 let draws=0;const session=new HallSession(GameMath,()=>{draws++;return 0;},{initialBalanceCents:100000,houseCapitalCents:Number.MAX_SAFE_INTEGER}),before=session.getSnapshot(),book=session.getReserveSnapshot();
 assert.throws(()=>session.begin('plinko','standard',5),/Bank headroom/);assert.equal(draws,0);assert.equal(session.getSnapshot(),before);assert.deepEqual(session.getReserveSnapshot(),book);assert.equal(session.id,0);
}
{
  const session = sessionFor(25);
  session.begin('plinko', 'standard', 10);
  const second = session.begin('plinko', 'standard', 10);
  assert.equal(session.getSnapshot().balance, 5);
  const before = session.getSnapshot();
  assert.throws(() => session.begin('plinko', 'standard', 10), /Недостаточно/);
  assert.equal(session.getSnapshot(), before);
  assert.equal(session.id, 2);
  assert.equal(session.complete(second.id), true);
  assert.equal(session.getSnapshot().balance, 5 + second.payout);
  const coin = session.begin('coinflip', 'heads', 10);
  assert.equal(coin, null); // A remaining ball still owns the shared wallet.
  assert.equal(session.completeAll('plinko'), 1);
  assert.equal(session.completeAll('plinko'), 0);
  assert.ok(session.begin('coinflip', 'heads', 10));
}
{
  const session = sessionFor();
  const coin = session.begin('coinflip', 'heads', 10);
  assert.equal(session.begin('plinko', 'standard', 10), null);
  assert.equal(session.beginBlackjack(10), null);
  assert.equal(session.complete(coin.id), true);
  const hand = session.beginBlackjack(10);
  assert.equal(session.begin('plinko', 'standard', 10), null);
  assert.equal(session.complete(hand.id), false); // Cannot bypass the hand engine.
  const initial = createBlackjackHand({ randomInt: maximum => maximum - 1 });
  assert.throws(() => session.completeBlackjack(hand.id, initial));
  assert.throws(() => session.completeBlackjack(hand.id, finishBlackjack(initial)));
  const resolved = session.advanceBlackjack(hand.id, 'finish', hand.hand);
  assert.equal(session.completeBlackjack(hand.id, resolved), true);
  assert.equal(session.completeBlackjack(hand.id, resolved), false);
  assert.equal(session.getSnapshot().busy, false);
}

// The projection contains trajectory coordinates, never result/bin/payout.
// A single RAF owns hundreds of balls and all landing effects.
{
  const session = sessionFor(2510,0); const frames = scheduler(); const results = [];
  const controller = new PlinkoFlightController(session, { ...frames, onLand: result => results.push(result) });
  controller.attach();
  for (let i = 0; i < 251; i++) assert.ok(controller.launch(10));
  assert.equal(frames.size, 1);
  assert.equal(frames.peak, 1);
  assert.throws(() => controller.launch(10), /Недостаточно/);
  for (const ball of controller.getPresentation()) {
    assert.deepEqual(Object.keys(ball).sort(), ['id', 'path', 'progress', 'stake']);
    assert.equal(ball.progress, 0);
  }
  assert.equal(controller.getEffects().length, 0);
  frames.flush(0); frames.flush(1800);
  assert.equal(results.length, 0);
  assert.equal(session.getSnapshot().history.length, 0);
  assert.equal(session.getSnapshot().balance, 0);
  frames.flush(3800);
  assert.equal(results.length, 251);
  assert.equal(controller.activeCount, 0);
  assert.equal(session.active.size, 0);
  assert.equal(frames.peak, 1);
  assert.equal(session.balanceCents, results.reduce((sum, result) => sum + result.payoutCents, 0));
  controller.detach(); assert.equal(frames.size, 0);
  assert(controller.getEffects().length<=20,'Landing cosmetics are bounded independently of accepted flights.');
}
{
  const session = sessionFor(); const frames = scheduler(); const results = [];
  const controller = new PlinkoFlightController(session, { ...frames, onLand: result => results.push(result) });
  controller.attach(); controller.launch(10);
  frames.flush(0); frames.flush(1000);
  const p = controller.getPresentation()[0].progress;
  controller.setVisible(false);
  assert.equal(frames.size, 0);
  controller.advance(90000);
  assert.equal(controller.getPresentation()[0].progress, p);
  controller.setVisible(true); frames.flush(90000);
  assert.equal(controller.getPresentation()[0].progress, p);
  controller.launch(20);
  frames.flush(92800);
  assert.equal(results.length, 1);
  assert.equal(controller.getPresentation().length, 1);
  assert.equal(controller.getPresentation()[0].stake, 20);
  assert.equal(session.getSnapshot().history.length, 1);
  assert.equal(session.getSnapshot().balance, 970 + results[0].payout);
  frames.flush(93800);
  assert.equal(results.length, 2);
  assert.equal(session.getSnapshot().history.length, 2);
  controller.detach();
}
{
  const session = sessionFor(); const frames = scheduler(); let callbacks = 0;
  const controller = new PlinkoFlightController(session, { ...frames, onLand: () => callbacks++ });
  controller.attach();
  for (let i = 0; i < 20; i++) controller.launch(10);
  const expected = 80000 + [...session.active.values()].reduce((sum, round) => sum + round.payoutCents, 0);
  controller.detach();
  assert.equal(session.balanceCents, expected);
  assert.equal(session.active.size, 0);
  assert.equal(session.getSnapshot().history.length, 20);
  assert.equal(callbacks, 0);
  assert.equal(frames.size, 0);
  controller.detach(); assert.equal(session.balanceCents, expected);
  // StrictMode setup-cleanup-setup can reuse the controller without a debit.
  controller.attach(); assert.ok(controller.launch(10)); controller.detach();
  assert.equal(session.active.size, 0);
}
{
  const session = sessionFor(); const frames = scheduler(); let renders = 0;
  const controller = new PlinkoFlightController(session, frames);
  // Canvas has registered its renderer in its separate Fiber root. The room's
  // StrictMode replay does not necessarily replay that Canvas effect.
  controller.setRenderer(() => renders++);
  controller.attach(); controller.detach(); controller.attach();
  const before = renders;
  controller.launch(10); frames.flush(0); frames.flush(1000);
  assert.ok(renders >= before + 2, 'Parent effect replay retains the separate Canvas renderer');
  assert.equal(controller.getPresentation()[0].progress, 1000 / 3800);
  controller.detach();
  controller.setRenderer(null); // Actual Canvas cleanup owns renderer removal.
  controller.attach(); controller.launch(10); const closed = renders;
  frames.flush(2000); assert.equal(renders, closed);
  controller.detach();
}
// The same live Three buffer grows before any matrix write beyond its storage.
// Reuse avoids frame-by-frame allocations; growth frees old GPU bindings only.
{
 const geometry=new THREE.BoxGeometry(.1,.1,.1),material=new THREE.MeshBasicMaterial(),mesh=new THREE.InstancedMesh(geometry,material,16);
 const matrix=new THREE.Matrix4().makeTranslation(1,2,3);mesh.setMatrixAt(0,matrix);mesh.setColorAt(0,new THREE.Color('#adba82'));
 let disposals=0;mesh.addEventListener('dispose',()=>disposals++);
 const oldMatrix=mesh.instanceMatrix,oldColour=mesh.instanceColor;
 assert.equal(ensurePlinkoInstanceCapacity(mesh,16),false);assert.equal(mesh.instanceMatrix,oldMatrix);
 assert.equal(ensurePlinkoInstanceCapacity(mesh,251+20),true);assert.equal(disposals,1);assert.equal(mesh.instanceMatrix.count,512);assert.equal(mesh.instanceColor.count,512);
 assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);assert.deepEqual(Array.from(mesh.instanceMatrix.array.slice(0,16)),Array.from(oldMatrix.array.slice(0,16)));assert.deepEqual(Array.from(mesh.instanceColor.array.slice(0,3)),Array.from(oldColour.array.slice(0,3)));
 const grown=mesh.instanceMatrix;assert.equal(ensurePlinkoInstanceCapacity(mesh,250),false);assert.equal(mesh.instanceMatrix,grown);assert.equal(disposals,1);
 assert.equal(ensurePlinkoInstanceCapacity(mesh,2050),true);assert.equal(mesh.instanceMatrix.count,4096);assert.equal(disposals,2);
 for(let i=0;i<2050;i++)mesh.setMatrixAt(i,new THREE.Matrix4().makeTranslation(i,0,0));
 assert.equal(mesh.instanceMatrix.array[2049*16+12],2049);
 assert.equal(plinkoInstanceCapacity(0,16),16);assert.equal(plinkoInstanceCapacity(121,128),128);assert.equal(plinkoInstanceCapacity(129,128),256);assert.throws(()=>plinkoInstanceCapacity(-1));assert.throws(()=>ensurePlinkoInstanceCapacity({},1));
 const source=fs.readFileSync(new URL('../src/PlinkoScene.jsx',import.meta.url),'utf8'),room=fs.readFileSync(new URL('../src/PlinkoRoom.jsx',import.meta.url),'utf8'),ledger=fs.readFileSync(new URL('../src/hall-session.js',import.meta.url),'utf8');
 assert(source.includes('ensurePlinkoInstanceCapacity(balls.current, flights.length + effects.length)'));
 assert(source.indexOf('ensurePlinkoInstanceCapacity(balls.current')<source.indexOf('balls.current.count = flights.length'));
 assert(!source.includes('args={[null, null, 120]}')&&!/activeCount\s*>=\s*100|MAX_PLINKO_ACTIVE/.test(room+ledger));
 mesh.dispose();geometry.dispose();material.dispose();
}
// Even an unavailable GPU leaves the shared flight clock and ledger running.
{
 const session=sessionFor(2510,0),frames=scheduler(),results=[],controller=new PlinkoFlightController(session,{...frames,onLand:r=>results.push(r)}),original=console.error,errors=[];
 console.error=(...args)=>errors.push(args);
 try{
  controller.attach();for(let i=0;i<251;i++)controller.launch(10);
  controller.setRenderer(()=>{throw new Error('GPU buffer fixture');});
  frames.flush(0);frames.flush(3800);
  assert.equal(errors.length,1);assert.equal(results.length,251);assert.equal(session.active.size,0);assert.equal(session.getReserveSnapshot().reservedCents,0);assert.equal(session.balanceCents,results.reduce((sum,r)=>sum+r.payoutCents,0));controller.detach();
 }finally{console.error=original;}
}
// A transient settlement failure preserves that flight for retry. Other balls
// can still finish; an externally completed flight clears without duplicate credit.
{
 const session=sessionFor(1000,0),frames=scheduler(),results=[],reports=[],original=console.error;let failId=null,failed=false;
 const proxy={begin:(...args)=>session.begin(...args),getSnapshot:session.getSnapshot,complete:id=>{if(id===failId&&!failed){failed=true;throw new Error('settlement fixture');}return session.complete(id);}};
 const controller=new PlinkoFlightController(proxy,{...frames,onLand:r=>results.push(r),onError:e=>reports.push(e.message)});
 console.error=()=>{};
 try{
  controller.attach();failId=controller.launch(10);controller.launch(10);controller.launch(10);frames.flush(0);frames.flush(3800);
  assert.equal(results.length,2);assert.equal(controller.activeCount,1);assert.equal(session.active.size,1);assert.equal(controller.getPresentation()[0].id,failId);assert.deepEqual(reports,['settlement fixture']);assert.equal(frames.size,1);
  frames.flush(4000);assert.equal(results.length,3);assert.equal(controller.activeCount,0);assert.equal(session.active.size,0);assert.equal(session.complete(failId),false);
  const another=controller.launch(10);assert.equal(session.complete(another),true);const wallet=session.balanceCents;frames.flush(4100);frames.flush(8000);assert.equal(controller.activeCount,0);assert.equal(session.balanceCents,wallet);assert.equal(results.length,3);controller.detach();
 }finally{console.error=original;}
}
console.log('Plinko: 251 parallel launches; zero-capital worst-case payouts and debt; exact-once cents; atomic RNG failure; dynamic GPU buffers beyond 2000; mixed-game locks, private outcomes, shared RAF and cleanup checks passed');
