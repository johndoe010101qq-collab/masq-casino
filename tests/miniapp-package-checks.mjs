import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {cpSync,existsSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,realpathSync,renameSync,rmSync,symlinkSync,unlinkSync,utimesSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const project=realpathSync(fileURLToPath(new URL('../',import.meta.url))),workspace=realpathSync(path.dirname(project));
const temporaryParent=path.join(workspace,'review-drafts');mkdirSync(temporaryParent,{recursive:true});
const temporary=mkdtempSync(path.join(temporaryParent,'miniapp-package-check-')),fixture=path.join(temporary,'project');mkdirSync(fixture);
const inside=(root,file)=>{const relative=path.relative(root,file);return relative===''||(!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep));};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let checks=0;const eq=(a,b)=>{checks++;assert.deepEqual(a,b);},ok=x=>{checks++;assert.ok(x);};
const write=(relative,content)=>{const file=path.join(fixture,relative);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,content);};
const run=(args=[])=>spawnSync(process.execPath,['scripts/package-miniapp.mjs',...args],{cwd:fixture,encoding:'utf8',maxBuffer:2*1024*1024});
const failure=(pattern,args=['--check'])=>{const result=run(args);ok(result.status!==0);ok(pattern.test(result.stderr));return result;};
const freshDist=(js='console.log("synthetic production bundle");')=>{
 write('dist/assets/index-synthetic.js',js);write('dist/index.html','<!doctype html><html><head></head><body><script type="module" src="/assets/index-synthetic.js"></script></body></html>');
 const newest=new Date(Date.now()+2000);utimesSync(path.join(fixture,'dist/index.html'),newest,newest);
};
let junction=null;
try{
 const reviewDocuments=['docs/MINIAPP_REGISTRATION_KIT.md','docs/miniapp-registration.json',
  'docs/MINIAPP_RELEASE_REVIEW.md','docs/SPWORLDS_SUBMISSION_DRAFT.md','docs/spw-admin-readiness.json',
  'docs/RELEASE_RTP_AUDIT.md','docs/release-rtp-audit.json',
  'docs/classic-rtp-50-95-receipt.json','docs/blackjack-rtp-50-95-holdout.json',
  'docs/bonus-purchase-floor-results-v13.json','docs/bonus-purchase-floor-provenance-v13.json','docs/bonus-purchase-floor-rules-qa-v13.json'];
 for(const file of ['scripts/package-miniapp.mjs',...reviewDocuments,'deploy/nginx-miniapp.conf.example']){
  mkdirSync(path.dirname(path.join(fixture,file)),{recursive:true});cpSync(path.join(project,file),path.join(fixture,file));
 }
 // The unknown-fields fixture remains independent of supplied owner details.
 const fixtureRegistrationPath=path.join(fixture,'docs/miniapp-registration.json');
 const fixtureRegistration=JSON.parse(readFileSync(fixtureRegistrationPath,'utf8'));
 fixtureRegistration.community.ownerNickname=null;fixtureRegistration.developers.nicknames=null;
 fixtureRegistration.application.applicationId=null;fixtureRegistration.application.applicationPageUrl=null;
 fixtureRegistration.community.created=false;fixtureRegistration.developers.backendExists=false;
 fixtureRegistration.developers.frontendRepositoryUrl=null;fixtureRegistration.developers.backendRepositoryUrl=null;
 fixtureRegistration.hosting.currentVisibility='owner-only';
 writeFileSync(fixtureRegistrationPath,JSON.stringify(fixtureRegistration,null,2)+'\n');
 mkdirSync(path.join(fixture,'node_modules'),{recursive:true});cpSync(path.join(project,'node_modules/spwmini'),path.join(fixture,'node_modules/spwmini'),{recursive:true});
 write('package.json','{"type":"module","dependencies":{"spwmini":"1.2.0"}}');write('package-lock.json','{"lockfileVersion":3}');
 write('index.html','<!doctype html><div id="root"></div><script type="module" src="/src/main.jsx"></script>');write('vite.config.js','export default {};');
 write('src/main.jsx','console.log("synthetic source");');write('public/asset.txt','Synthetic public asset');
 write('.gitignore','node_modules/\ndist/\n.env*\n');write('.env','SPW_APP_TOKEN=THIS_IS_A_SYNTHETIC_EXCLUDED_TOKEN_123456789');
 write('server/spw-validate.js','const secret="THIS_IS_A_SYNTHETIC_EXCLUDED_TOKEN_123456789";');write('research/secret-artifact.txt','excluded research artifact');
 write('node_modules/vite/bin/vite.js',`import {mkdirSync,existsSync,unlinkSync,writeFileSync} from 'node:fs';import path from 'node:path';
writeFileSync(path.join(process.cwd(),'build-invoked.txt'),'synthetic builder invoked');
const dist=path.join(process.cwd(),'dist');mkdirSync(path.join(dist,'assets'),{recursive:true});const proof=path.join(dist,'miniapp-build-provenance.json');if(existsSync(proof))unlinkSync(proof);
writeFileSync(path.join(dist,'assets/index-synthetic.js'),'console.log('+JSON.stringify(process.env.VITE_SPW_APP_ID||'')+','+JSON.stringify(process.env.VITE_SPW_VALIDATE_URL||'')+');');
writeFileSync(path.join(dist,'index.html'),'<!doctype html><html><head></head><body><script type="module" src="/assets/index-synthetic.js"></script></body></html>');`);
 execFileSync('git',['-c','core.autocrlf=false','init','-q'],{cwd:fixture});execFileSync('git',['-c','core.autocrlf=false','add','.'],{cwd:fixture});
 execFileSync('git',['-c','user.email=synthetic@example.invalid','-c','user.name=Synthetic Package Check','commit','-qm','Synthetic fixture'],{cwd:fixture});
 freshDist();
 failure(/provenance missing/);eq(existsSync(path.join(temporary,'release-miniapp')),false);
 const initialBuild=run(['--build']);eq(initialBuild.status,0);const firstStage=JSON.parse(initialBuild.stdout).releaseFolder;
 const stageCount=readdirSync(path.join(temporary,'release-miniapp')).length;
 const checked=run(['--check']);eq(checked.status,0);const preflight=JSON.parse(checked.stdout);
 eq(preflight.identity.status,'unconfigured');eq(preflight.crypto.passed,true);eq(preflight.hosting.currentVisibility,'owner-only');
 eq(readdirSync(path.join(temporary,'release-miniapp')).length,stageCount);ok(existsSync(path.join(firstStage,'manifest.json')));
 const packaged=run();eq(packaged.status,0);const output=JSON.parse(packaged.stdout),folder=output.releaseFolder;
 ok(inside(path.join(temporary,'release-miniapp'),folder));eq(output.archiveCreated,false);ok(!existsSync(folder+'.zip'));
 const bytes=readFileSync(path.join(folder,'manifest.json')),manifest=JSON.parse(bytes);eq(sha(bytes),output.manifestSHA256);
 eq(manifest.identity,undefined);eq(manifest.preflight.identity.applicationId,null);eq(manifest.registration.application.games.length,9);
 eq(manifest.reviewMaterials.included,reviewDocuments);eq(preflight.reviewDocuments,reviewDocuments);
 for(const file of reviewDocuments){
  const staged=path.join(folder,'source',file);ok(existsSync(staged));
  eq(sha(readFileSync(staged)),sha(readFileSync(path.join(fixture,file))));
  ok(manifest.files.some(entry=>entry.path==='source/'+file));
 }
 eq(preflight.registrationReadiness.backendIncluded,false);eq(preflight.registrationReadiness.submissionPerformedByPackager,false);
 ok(preflight.registrationReadiness.missingPublicFields.includes('community.ownerNickname'));
 ok(preflight.registrationReadiness.missingPublicFields.includes('developers.frontendRepositoryUrl'));
 for(const file of manifest.files){const staged=path.join(folder,file.path);ok(inside(folder,staged));eq(readFileSync(staged).length,file.size);eq(sha(readFileSync(staged)),file.sha256);}
 for(const forbidden of ['source/.env','source/.git','source/node_modules','source/server','source/research'])eq(existsSync(path.join(folder,forbidden)),false);
 ok(!readFileSync(path.join(folder,'manifest.json'),'utf8').includes('THIS_IS_A_SYNTHETIC_EXCLUDED_TOKEN_123456789'));
 eq(readFileSync(path.join(folder,'webroot/assets/index-synthetic.js'),'utf8'),'console.log("","");');
 eq(manifest.buildFreshness.buildProof.publicConfig,{applicationId:null,validationPath:null});
 ok(readFileSync(path.join(folder,'README.txt'),'utf8').includes('npm test and packaging commands require the full original checkout'));
 const registration=JSON.parse(readFileSync(path.join(fixture,'docs/miniapp-registration.json'),'utf8'));
 eq(registration.identity.financialApiCalls,[]);eq(registration.identity.documentedProviderScopeNames,null);eq(registration.hosting.preserveCurrentVisibility,true);
 eq(registration.version,'indictus-miniapp-registration-kit-v2');eq(registration.community.ownerNickname,null);eq(registration.community.ownershipVerified,false);
 eq(registration.developers.nicknames,null);eq(registration.developers.frontendRepositoryUrl,null);eq(registration.developers.backendRepositoryUrl,null);eq(registration.developers.backendExists,false);
 eq(registration.publicApi.requiredForCurrentDemo,false);eq(registration.publicApi.approvedPublicEgressIps,null);eq(registration.publicApi.cardId,null);eq(registration.publicApi.cardTokenIncluded,false);
 eq(registration.privateTokenSetup.supportRequestSent,false);eq(registration.privateTokenSetup.applicationTokenIncluded,false);
 eq(registration.moderation.workflowSource,'user-supplied-not-officially-confirmed');eq(registration.moderation.reviewRequiredForEveryUpdate,true);
 eq(registration.moderation.initialSubmissionSent,false);eq(registration.moderation.approvalReceived,false);
 eq(registration.sdk.name,'SPWMini');eq(registration.sdk.packageName,'spwmini');eq(registration.sdk.middlewareExports,['validate','checkUser']);
 const reviewText=readFileSync(path.join(folder,'source/docs/MINIAPP_RELEASE_REVIEW.md'),'utf8');
 ok(reviewText.includes('Производственный игровой/финансовый backend'));
 ok(reviewText.includes('Серверное управление Node.js 24/SQLite реализовано локально'));
 ok(readFileSync(path.join(folder,'source/docs/SPWORLDS_SUBMISSION_DRAFT.md'),'utf8').includes('Заявка не отправлена'));
 const draftPath=path.join(fixture,'docs/SPWORLDS_SUBMISSION_DRAFT.md'),draftBytes=readFileSync(draftPath);
 unlinkSync(draftPath);failure(/Required source file missing: docs\/SPWORLDS_SUBMISSION_DRAFT\.md/);writeFileSync(draftPath,draftBytes);
 const evidencePath=path.join(fixture,'docs/spw-admin-readiness.json'),evidenceBytes=readFileSync(evidencePath);
 unlinkSync(evidencePath);failure(/Required source file missing: docs\/spw-admin-readiness\.json/);writeFileSync(evidencePath,evidenceBytes);
 const registrationPath=path.join(fixture,'docs/miniapp-registration.json'),registrationBytes=readFileSync(registrationPath);
 const suppliedRegistration=structuredClone(registration);suppliedRegistration.community.ownerNickname='SyntheticOwner';suppliedRegistration.developers.nicknames=['SyntheticOwner'];
 writeFileSync(registrationPath,JSON.stringify(suppliedRegistration));
 const suppliedCheck=run(['--check']);eq(suppliedCheck.status,0);
 const suppliedReadiness=JSON.parse(suppliedCheck.stdout).registrationReadiness;
 ok(!suppliedReadiness.missingPublicFields.includes('community.ownerNickname'));
 ok(!suppliedReadiness.missingPublicFields.includes('developers.nicknames'));
 const suppliedPackage=run();eq(suppliedPackage.status,0);
 const suppliedManifest=JSON.parse(readFileSync(path.join(JSON.parse(suppliedPackage.stdout).releaseFolder,'manifest.json'),'utf8'));
 eq(suppliedManifest.registration.community.ownerNickname,'SyntheticOwner');eq(suppliedManifest.registration.community.ownershipVerified,false);
 eq(suppliedManifest.registration.developers.nicknames,['SyntheticOwner']);eq(suppliedManifest.registration.moderation.approvalReceived,false);
 writeFileSync(registrationPath,registrationBytes);
 const invalidRegistration=structuredClone(registration);invalidRegistration.privateTokenSetup.applicationToken='SYNTHETIC_UNEXPECTED_CREDENTIAL_FIELD_123456789';
 writeFileSync(registrationPath,JSON.stringify(invalidRegistration));const unexpectedToken=failure(/Token setup may contain status\/reference fields only/);
 ok(!unexpectedToken.stderr.includes('SYNTHETIC_UNEXPECTED_CREDENTIAL_FIELD_123456789'));writeFileSync(registrationPath,registrationBytes);
 const nginx=readFileSync(path.join(fixture,'deploy/nginx-miniapp.conf.example'),'utf8');
 ok(nginx.includes('add_header Content-Security-Policy "frame-ancestors https://spworlds.ru" always;'));
 ok(!/^\s*add_header X-Frame-Options/m.test(nginx));ok(nginx.includes('include /etc/nginx/mime.types;'));ok(nginx.includes('location ^~ /api/'));
 ok(!nginx.includes('location ^~ /assets/'));ok(nginx.includes('location ~ (^|/)\\.'));ok(/(^|\/)\./.test('/assets/.env'));
 const old=new Date(Date.now()-60000);utimesSync(path.join(fixture,'dist/index.html'),old,old);failure(/older than.*build inputs/);
 const restored=new Date(Date.now()+2000);utimesSync(path.join(fixture,'dist/index.html'),restored,restored);
 write('src/main.jsx','console.log("changed build input");');failure(/Build inputs changed since/);write('src/main.jsx','console.log("synthetic source");');
 write('public/leak.json','{"SPW_APP_TOKEN":"SYNTHETIC_LEAK_TOKEN_LONG_ENOUGH_123456789"}');
 const leak=failure(/Suspected credential material/);ok(!leak.stderr.includes('SYNTHETIC_LEAK_TOKEN_LONG_ENOUGH_123456789'));unlinkSync(path.join(fixture,'public/leak.json'));
 const outside=path.join(temporary,'outside');mkdirSync(outside);writeFileSync(path.join(outside,'outside.txt'),'never copy');
 junction=path.join(fixture,'public/junction');symlinkSync(outside,junction,process.platform==='win32'?'junction':'dir');failure(/Symlinks\/junctions/);unlinkSync(junction);junction=null;
 write('.env.local','VITE_SPW_APP_ID=invalid-public-id');failure(/public UUID or empty/);
 const appId='123e4567-e89b-12d3-a456-426655440000';write('.env.local','VITE_SPW_APP_ID='+appId);failure(/App ID was not found/);
 const configuredBuild=run(['--build']);eq(configuredBuild.status,0);const configured=run(['--check']);eq(configured.status,0);eq(JSON.parse(configured.stdout).identity.status,'configured-public-id-not-platform-verified');
 write('.env.local','VITE_SPW_APP_ID=');failure(/Effective public configuration changed since build/);
 write('.env.local','VITE_SPW_APP_ID=223e4567-e89b-12d3-a456-426655440000');failure(/App ID was not found/);
 write('.env.local','VITE_SPW_APP_ID='+appId+'\nVITE_SPW_VALIDATE_URL=https://invalid.example/validate');failure(/same-origin absolute path/);
 write('.env.local','VITE_SPW_APP_ID='+appId+'\nVITE_SPW_VALIDATE_URL=/api/spw/validate');failure(/validation path was not found/);
 const validationBuild=run(['--build']);eq(validationBuild.status,0);const pathConfigured=run(['--check']);eq(pathConfigured.status,0);eq(JSON.parse(pathConfigured.stdout).identity.validationBackendIncluded,false);
 write('.env.local','VITE_SPW_APP_ID='+appId+'\nVITE_SPW_VALIDATE_URL=');failure(/Effective public configuration changed since build/);
 const originalDist=path.join(fixture,'dist-before-junction');renameSync(path.join(fixture,'dist'),originalDist);
 unlinkSync(path.join(fixture,'build-invoked.txt'));
 writeFileSync(path.join(outside,'sentinel.txt'),'external output remains untouched');
 const outsideEntries=readdirSync(outside).sort();
 junction=path.join(fixture,'dist');symlinkSync(outside,junction,process.platform==='win32'?'junction':'dir');
 failure(/Build output dist must not be a symlink\/junction; Vite was not invoked/,['--build']);
 eq(existsSync(path.join(fixture,'build-invoked.txt')),false);eq(readdirSync(outside).sort(),outsideEntries);
 eq(readFileSync(path.join(outside,'sentinel.txt'),'utf8'),'external output remains untouched');
 unlinkSync(junction);junction=null;renameSync(originalDist,path.join(fixture,'dist'));
 unlinkSync(path.join(fixture,'dist/index.html'));failure(/Missing dist\/index.html/);
 const report={passed:true,checks,isolatedFixture:true,sourceProjectModified:false,
  coverage:'Read-only preflight; no-ID preparation; owner/community/developer/repository/contact placeholders; user-supplied moderation route and unsent draft; explicit mechanics-review/evidence allowlist with missing-document rejection; private-token status-only structure and suppressed unexpected credential; nine-game/identity-only fields; actual-build config/source/dist provenance; stale/missing build rejection; exact staged hashes; excluded env/dependencies/backend/artifacts; synthetic HMAC; secret suppression; source junction rejection and dist junction rejection before builder invocation with external sentinel preserved; env-only changes and configured values cleared to empty rejected; owner-private preservation; Nginx HTTP CSP/MIME/SPA/API absence and dotfile regex precedence.'};
 console.log(JSON.stringify(report));
}finally{
 if(junction&&existsSync(junction)&&lstatSync(junction).isSymbolicLink())unlinkSync(junction);
 const resolved=realpathSync(temporary);assert(inside(realpathSync(temporaryParent),resolved)&&resolved!==realpathSync(temporaryParent));
 rmSync(resolved,{recursive:true,force:true});
}
