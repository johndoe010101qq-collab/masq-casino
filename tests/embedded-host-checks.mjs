import assert from 'node:assert/strict';
import {embeddedHost} from '../src/integrations/embedded-host.js';
assert.equal(embeddedHost(),'standalone');
assert.equal(embeddedHost({embedded:true,referrer:'https://huevo.su/apps/221'}),'huevo');
assert.equal(embeddedHost({embedded:true,referrer:'https://spworlds.ru/spm/apps/123'}),'spworlds');
for(const referrer of ['https://huevo.su.evil.test','http://huevo.su','https://evil.test/?huevo.su','bad'])
  assert.equal(embeddedHost({embedded:true,referrer}),'unknown');
assert.equal(embeddedHost({embedded:true,search:'?hu_app_id=221'}),'huevo');
assert.equal(embeddedHost({embedded:false,search:'?hu_app_id=221'}),'standalone');
console.log('PASS exact embedded host selection; no authentication from launch hints.');
