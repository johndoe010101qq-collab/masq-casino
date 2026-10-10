import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,lstatSync,mkdirSync,readFileSync,readdirSync,realpathSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkUser} from 'spwmini/middleware';

const projectRoot=realpathSync(fileURLToPath(new URL('../',import.meta.url)));
const workspaceRoot=realpathSync(path.dirname(projectRoot));
const releaseRoot=path.join(workspaceRoot,'release-miniapp');
const args=process.argv.slice(2);
if(args.some(arg=>!['--check','--build'].includes(arg))||args.length>1)throw new Error('Usage: node scripts/package-miniapp.mjs [--check | --build]');
const checkOnly=args.includes('--check');
const buildRequested=args.includes('--build');
const sha=data=>createHash('sha256').update(data).digest('hex');
const slash=value=>value.replaceAll(path.sep,'/');
const inside=(root,target)=>{const relative=path.relative(root,target);return relative===''||(!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep));};
const assertInside=(root,target)=>{if(!inside(root,target))throw new Error('Path escapes intended directory: '+target);};
const forbiddenName=/^(?:\.git|node_modules|\.env(?:\..*)?|\.openai|\.codex|credentials?|secrets?|id_rsa|id_ed25519)$/i;
const forbiddenExtension=/\.(?:pem|key|p12|pfx|jks|keystore|zip|tar|gz|7z|log)$/i;
const textExtension=/\.(?:js|jsx|mjs|cjs|ts|tsx|json|html|css|md|txt|conf|example|svg)$/i;
const secretPatterns=[
 ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
 ['github-token',/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/],
 ['npm-token',/\bnpm_[A-Za-z0-9]{30,}\b/],
 ['aws-key',/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
 ['literal-bearer',/\bBearer\s+[A-Za-z0-9._/+~-]{24,}/],
 ['literal-secret',/(?:SPW_APP_TOKEN|CLIENT_SECRET|PRIVATE_KEY|API_KEY|ACCESS_TOKEN|AUTH_TOKEN|CARD_TOKEN)["']?\s*[:=]\s*["'](?!["'])(?![^"'\r\n]*(?:EXAMPLE|PLACEHOLDER|CHANGE_ME|SECRET_TOKEN|SERVER_ONLY))[A-Za-z0-9._/+~-]{16,}["']/i],
];
const sourceDirectories=['src','public'];
const reviewDocuments=['docs/MINIAPP_REGISTRATION_KIT.md','docs/miniapp-registration.json',
 'docs/MINIAPP_RELEASE_REVIEW.md','docs/SPWORLDS_SUBMISSION_DRAFT.md','docs/spw-admin-readiness.json',
 'docs/RELEASE_RTP_AUDIT.md','docs/release-rtp-audit.json',
 'docs/classic-rtp-50-95-receipt.json','docs/blackjack-rtp-50-95-holdout.json',
 'docs/bonus-purchase-floor-results-v13.json','docs/bonus-purchase-floor-provenance-v13.json','docs/bonus-purchase-floor-rules-qa-v13.json'];
const sourceFiles=['package.json','package-lock.json','index.html','vite.config.js','LICENSE','LICENSE.md',
 ...reviewDocuments,'deploy/nginx-miniapp.conf.example','scripts/package-miniapp.mjs'];
const buildInputs=new Set(['package.json','package-lock.json','index.html','vite.config.js']);
const buildProofName='miniapp-build-provenance.json';
const isBuildInput=entry=>entry.projectPath.startsWith('src/')||entry.projectPath.startsWith('public/')||buildInputs.has(entry.projectPath);
const canonical=entries=>entries.map(({projectPath,size,sha256})=>({path:projectPath,size,sha256}));

function checkPath(file){
 assertInside(projectRoot,file);
 const stat=lstatSync(file);
 if(stat.isSymbolicLink())throw new Error('Symlinks/junctions are not packaged: '+slash(path.relative(projectRoot,file)));
 assertInside(projectRoot,realpathSync(file));
 const relative=slash(path.relative(projectRoot,file));
 if(relative.split('/').some(part=>forbiddenName.test(part))||forbiddenExtension.test(relative))throw new Error('Disallowed release path: '+relative);
 return stat;
}
function walk(folder){
 const stat=checkPath(folder);if(!stat.isDirectory())throw new Error('Expected directory: '+folder);
 const files=[];
 for(const name of readdirSync(folder).sort()){
  const file=path.join(folder,name),entry=checkPath(file);
  if(entry.isDirectory())files.push(...walk(file));
  else if(entry.isFile())files.push(file);
  else throw new Error('Unsupported filesystem entry: '+file);
 }
 return files;
}
function inspect(file){
 const stat=checkPath(file);if(!stat.isFile())throw new Error('Expected regular file: '+file);
 const bytes=readFileSync(file);
 if(textExtension.test(file))for(const [name,pattern]of secretPatterns)if(pattern.test(bytes.toString('utf8')))
  throw new Error('Suspected credential material ('+name+') in '+slash(path.relative(projectRoot,file))+'. Value suppressed.');
 return {file,projectPath:slash(path.relative(projectRoot,file)),size:bytes.length,sha256:sha(bytes),mtimeMs:stat.mtimeMs};
}
function sourceSnapshot(){
 const files=sourceDirectories.flatMap(dir=>walk(path.join(projectRoot,dir)));
 for(const file of sourceFiles)if(existsSync(path.join(projectRoot,file)))files.push(path.join(projectRoot,file));
 for(const required of sourceFiles.filter(file=>!file.startsWith('LICENSE')))if(!files.includes(path.join(projectRoot,required)))throw new Error('Required source file missing: '+required);
 return files.sort().map(inspect);
}
function distSnapshot(){
 const root=path.join(projectRoot,'dist'),index=path.join(root,'index.html');
 if(!existsSync(index))throw new Error('Missing dist/index.html. Run final checks and npm run build first.');
 const entries=walk(root).map(inspect);if(entries.length<2)throw new Error('Incomplete production dist.');
 const html=readFileSync(index,'utf8');
 if(!/<script\b[^>]*\bsrc=["'][^"']+\.js["']/.test(html)||html.includes('/src/main.jsx'))throw new Error('dist/index.html is not a built client entry.');
 const indexEntry=entries.find(entry=>entry.file===index);
 return {entries,indexEntry};
}
function gitSnapshot(){
 const git=(...parts)=>execFileSync('git',['-C',projectRoot,...parts],{encoding:'utf8',maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']});
 const root=realpathSync(git('rev-parse','--show-toplevel').trim());
 if(root.toLowerCase()!==projectRoot.toLowerCase())throw new Error('Expected Git checkout root to match this project.');
 const scope=[...sourceDirectories,...sourceFiles];
 return {head:git('rev-parse','HEAD').trim(),scope,trackedPaths:git('ls-files','-z','--',...scope).split('\0').filter(Boolean),
  statusPorcelain:git('status','--porcelain=v1','-z','--untracked-files=all','--',...scope).split('\0').filter(Boolean)};
}
function envPublic(name){
 let value='';let source='unset';
 for(const filename of ['.env','.env.local','.env.production','.env.production.local']){
  const file=path.join(projectRoot,filename);if(!existsSync(file))continue;
  const stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Unexpected env filesystem entry; not read: '+filename);
  for(const line of readFileSync(file,'utf8').split(/\r?\n/)){
   const match=line.match(new RegExp('^\\s*(?:export\\s+)?'+name+'\\s*=\\s*(.*?)\\s*$'));if(!match)continue;
   value=match[1];if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
   else value=value.replace(/\s+#.*$/,'');source=filename;
  }
 }
 if(Object.hasOwn(process.env,name)){value=process.env[name];source='shell environment';}
 return {value:value.trim(),source};
}
function requestedPublicConfig(){
 const app=envPublic('VITE_SPW_APP_ID'),validation=envPublic('VITE_SPW_VALIDATE_URL');
 const uuid=/^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;
 if(app.value&&!uuid.test(app.value))throw new Error('VITE_SPW_APP_ID must be a public UUID or empty. No value printed.');
 if(validation.value&&(!validation.value.startsWith('/')||validation.value.startsWith('//')))throw new Error('VITE_SPW_VALIDATE_URL must be empty or a same-origin absolute path.');
 return {app,validation};
}
function publicConfig(dist,{app,validation}){
 const js=dist.entries.filter(entry=>/\.js$/.test(entry.file));
 if(app.value&&!js.some(entry=>readFileSync(entry.file,'utf8').includes(app.value)))throw new Error('Configured public App ID was not found in dist JS. Rebuild with the same public configuration.');
 if(validation.value&&!js.some(entry=>readFileSync(entry.file,'utf8').includes(validation.value)))throw new Error('Configured validation path was not found in dist JS. Rebuild with the same public configuration.');
 return {applicationId:app.value||null,status:app.value?'configured-public-id-not-platform-verified':'unconfigured',configurationSource:app.source,
  validationPath:validation.value||null,validationBackendIncluded:false,validationBackendReachabilityVerified:false,
  note:app.value?'Public UUID appearance in bundle is not proof of registration or identity verification.':'Preparation is permitted without App ID. This client cannot initialize SPW identity until registered and rebuilt.',
  staticValidationNote:validation.value?'A validation path is configured, but this package supplies no backend. Operator must deploy and test it separately.':'Static DEMO has no server signature verification endpoint.'};
}
function cryptoPreflight(){
 const packageFile=path.join(projectRoot,'node_modules/spwmini/package.json'),middlewareFile=path.join(projectRoot,'node_modules/spwmini/dist/middleware.mjs');
 const sdk=JSON.parse(readFileSync(packageFile,'utf8')),middlewareSHA256=sha(readFileSync(middlewareFile));
 if(sdk.version!=='1.2.0'||middlewareSHA256!=='9c050c9f95d37bd890362e1e3c9281436931c5eac85b13eff3e493b28c97036e')throw new Error('Installed SDK differs from audited1.2.0 middleware. Review contract before packaging.');
 const syntheticKey='local-registration-package-test-only',claim={accountId:'synthetic-account',username:'SyntheticDemo',minecraftUUID:'00000000000000000000000000000000',timestamp:1,roles:[],isAdmin:false};
 const canonical=Object.keys(claim).sort().filter(key=>claim[key]).map(key=>key+'='+claim[key]).join('\n');
 const hash=createHmac('sha256',createHash('sha256').update(syntheticKey).digest()).update(canonical).digest('hex');
 assert.equal(checkUser({...claim,hash},syntheticKey),true);assert.equal(checkUser({...claim,username:'tampered',hash},syntheticKey),false);
 return {passed:true,syntheticOnly:true,sdkVersion:sdk.version,middlewareSHA256,claims:['Correct synthetic signature accepted','Modified username rejected'],
  limitation:'Tests authenticity algorithm only, not platform registration, freshness, live user identity, a deployed backend or admin authorization.'};
}
const registration=JSON.parse(readFileSync(path.join(projectRoot,'docs/miniapp-registration.json'),'utf8'));
assert.equal(registration.application.games.length,9);assert.ok(['owner-only','public'].includes(registration.hosting.currentVisibility));
assert.equal(registration.hosting.preserveCurrentVisibility,true);assert.deepEqual(registration.identity.financialApiCalls,[]);
assert.equal(registration.deployment.mode,'static-demo-only');assert.equal(typeof registration.developers.backendExists,'boolean');
assert.equal(registration.publicApi.requiredForCurrentDemo,false);assert.equal(registration.publicApi.cardTokenIncluded,false);
assert.equal(registration.privateTokenSetup.applicationTokenIncluded,false);
const tokenStatusKeys=new Set(['supportContact','supportRequestReference','supportRequestSent','applicationTokenReceived',
 'serverSecretConfigured','applicationTokenIncluded','noteRu']);
if(Object.keys(registration.privateTokenSetup).some(key=>!tokenStatusKeys.has(key)))throw new Error('Token setup may contain status/reference fields only. Credential values are not packaged.');
const missingRegistrationFields=[
 ['application.applicationId',registration.application.applicationId],['application.registeredServerSlug',registration.application.registeredServerSlug],
 ['application.applicationPageUrl',registration.application.applicationPageUrl],['application.publicHttpsUrl',registration.application.publicHttpsUrl],
 ['application.reviewContact',registration.application.reviewContact],['community.name',registration.community.name],
 ['community.communityId',registration.community.communityId],['community.pageUrl',registration.community.pageUrl],
 ['community.ownerNickname',registration.community.ownerNickname],['community.ownerAccountId',registration.community.ownerAccountId],
 ['developers.nicknames',registration.developers.nicknames],['developers.frontendRepositoryUrl',registration.developers.frontendRepositoryUrl],
 ['developers.reviewContact',registration.developers.reviewContact],['moderation.initialReviewerContact',registration.moderation.initialReviewerContact],
 ['moderation.updateReviewerContact',registration.moderation.updateReviewerContact]
].filter(([,value])=>value===null||value===''||(Array.isArray(value)&&value.length===0)).map(([field])=>field);
const registrationReadiness={missingPublicFields:missingRegistrationFields,providerApprovalClaimed:false,
 backendIncluded:false,submissionPerformedByPackager:false,workflowSource:registration.moderation.workflowSource,
 note:'Preparation accepts missing public registration data. Packaging is not registration, submission, moderation approval or backend deployment.'};
const source=sourceSnapshot(),git=gitSnapshot(),crypto=cryptoPreflight(),requested=requestedPublicConfig();
if(buildRequested){
 const outputRoot=path.join(projectRoot,'dist');
 assertInside(projectRoot,outputRoot);
 let outputStat;
 try{outputStat=lstatSync(outputRoot);}catch(error){if(error.code!=='ENOENT')throw error;}
 if(outputStat){
  if(outputStat.isSymbolicLink())throw new Error('Build output dist must not be a symlink/junction; Vite was not invoked.');
  if(!outputStat.isDirectory())throw new Error('Build output dist must be a regular project directory; Vite was not invoked.');
  assertInside(projectRoot,realpathSync(outputRoot));
 }
 const viteCli=path.join(projectRoot,'node_modules/vite/bin/vite.js');
 if(!existsSync(viteCli))throw new Error('Installed Vite CLI missing. Install the locked project dependencies first.');
 try{execFileSync(process.execPath,[viteCli,'build'],{cwd:projectRoot,maxBuffer:16*1024*1024,
  env:{...process.env,VITE_SPW_APP_ID:requested.app.value,VITE_SPW_VALIDATE_URL:requested.validation.value},stdio:['ignore','pipe','pipe']});}
 catch{throw new Error('Final Vite build failed. Run npm run build locally for diagnostics; no release has been sealed.');}
 assert.deepEqual(canonical(sourceSnapshot()),canonical(source),'Source changed while building. Repeat after edits finish.');
 const built=distSnapshot(),proof={version:'indictus-miniapp-build-provenance-v1',createdAt:new Date().toISOString(),
  publicConfig:{applicationId:requested.app.value||null,validationPath:requested.validation.value||null},
  sourceBuildInputsSHA256:sha(JSON.stringify(canonical(source.filter(isBuildInput)))),
  distWithoutProofSHA256:sha(JSON.stringify(canonical(built.entries.filter(entry=>entry.projectPath!=='dist/'+buildProofName)))),
  method:'Actual Vite CLI executed with both effective public variables explicitly pinned in the child environment; source hashes checked before and after build.'};
 writeFileSync(path.join(projectRoot,'dist',buildProofName),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
}
const dist=distSnapshot(),identity=publicConfig(dist,requested),proofFile=path.join(projectRoot,'dist',buildProofName);
if(!existsSync(proofFile))throw new Error('Build public-configuration provenance missing. Run node scripts/package-miniapp.mjs --build after final checks.');
const buildProof=JSON.parse(readFileSync(proofFile,'utf8'));
assert.equal(buildProof.version,'indictus-miniapp-build-provenance-v1','Unrecognized build provenance.');
assert.deepEqual(buildProof.publicConfig,{applicationId:identity.applicationId,validationPath:identity.validationPath},'Effective public configuration changed since build, including clearing a value. Rebuild with --build.');
assert.equal(buildProof.sourceBuildInputsSHA256,sha(JSON.stringify(canonical(source.filter(isBuildInput)))),'Build inputs changed since the proven build. Rebuild with --build.');
assert.equal(buildProof.distWithoutProofSHA256,sha(JSON.stringify(canonical(dist.entries.filter(entry=>entry.projectPath!=='dist/'+buildProofName)))),'Built files differ from proven build. Rebuild with --build.');
const newerInputs=source.filter(entry=>isBuildInput(entry)&&entry.mtimeMs>dist.indexEntry.mtimeMs+1000);
if(newerInputs.length)throw new Error('Production dist is older than '+newerInputs.length+' build inputs, including '+newerInputs.slice(0,4).map(entry=>entry.projectPath).join(', ')+'. Rebuild after final edits.');
const digest=sha(JSON.stringify({source:canonical(source),dist:canonical(dist.entries),git,identity}));
const preflight={passed:true,checkOnly,sourceFiles:source.length,distFiles:dist.entries.length,contentDigest:digest,identity,crypto,
 registrationReadiness,reviewDocuments,
 git:{head:git.head,dirtySelectedPaths:git.statusPorcelain.length},hosting:{currentVisibility:'owner-only',publicReachabilityVerified:false,preserved:true}};
if(checkOnly){console.log(JSON.stringify(preflight,null,2));process.exit(0);}
assertInside(workspaceRoot,releaseRoot);
if(existsSync(releaseRoot)){if(lstatSync(releaseRoot).isSymbolicLink()||!lstatSync(releaseRoot).isDirectory())throw new Error('release-miniapp must be a regular workspace child directory.');assertInside(workspaceRoot,realpathSync(releaseRoot));}
else mkdirSync(releaseRoot);
const stamp=new Date().toISOString().replaceAll('-','').replaceAll(':','').replace('.','');
const releaseFolder=path.join(releaseRoot,'indictus-miniapp-'+digest.slice(0,12)+'-'+stamp);
assertInside(releaseRoot,releaseFolder);assert(!inside(projectRoot,releaseFolder));
if(existsSync(releaseFolder))throw new Error('Release folder already exists; no files replaced.');
mkdirSync(releaseFolder);
const fileManifest=[];
function materialize(entry,relative){
 const destination=path.join(releaseFolder,relative);assertInside(releaseFolder,destination);
 const bytes=readFileSync(entry.file);assert.equal(sha(bytes),entry.sha256,'Source changed before copy: '+entry.projectPath);
 mkdirSync(path.dirname(destination),{recursive:true});writeFileSync(destination,bytes,{flag:'wx'});
 assert.equal(sha(readFileSync(destination)),entry.sha256,'Copied hash mismatch: '+relative);
 fileManifest.push({path:slash(relative),size:entry.size,sha256:entry.sha256,origin:entry.projectPath,gitTracked:git.trackedPaths.includes(entry.projectPath)});
}
for(const entry of source)materialize(entry,path.join('source',entry.projectPath));
for(const entry of dist.entries)materialize(entry,path.join('webroot',path.relative(path.join(projectRoot,'dist'),entry.file)));
assert.deepEqual(canonical(sourceSnapshot()),canonical(source),'Source files changed during packaging. This partial folder is not a sealed release.');
assert.deepEqual(canonical(distSnapshot().entries),canonical(dist.entries),'Build files changed during packaging. This partial folder is not a sealed release.');
assert.deepEqual(gitSnapshot(),git,'Selected Git state changed during packaging. This partial folder is not a sealed release.');
const readme='MASQ: unregistered static DEMO registration package\n\nDeploy ONLY webroot/ over HTTPS. source/ contains selected sanitized client sources and registration guidance, the detailed mechanics review, an unsent submission draft and explicitly listed evidence JSON. manifest.json records actual file SHA-256 and selected Git state. Test suites, other historical measurement docs and .git are omitted; npm test and packaging commands require the full original checkout. The selected client source can be built after npm ci. References to omitted historical files in the review require that full checkout; included historical evidence does not prove a later version.\n\nNo Express server, signature-verification endpoint, finance/payment route, casino admin session or secret token is included. Public identity configuration: '+identity.status+'. Current Sites remains owner-only; no visibility change or publication was performed. Provider registration and approval are not claimed. Read source/docs/MINIAPP_REGISTRATION_KIT.md, source/docs/MINIAPP_RELEASE_REVIEW.md and source/docs/SPWORLDS_SUBMISSION_DRAFT.md before deployment. Unknown owner, community, developer, repository and moderation contact fields remain empty; conditional API IP/card fields do not authorize financial access. The user-supplied AlexKot/Alexander workflow is not presented as publicly verified official policy.\n';
const readmeBytes=Buffer.from(readme,'utf8');writeFileSync(path.join(releaseFolder,'README.txt'),readmeBytes,{flag:'wx'});
fileManifest.push({path:'README.txt',size:readmeBytes.length,sha256:sha(readmeBytes),origin:'generated',gitTracked:false});
const manifest={version:'indictus-static-miniapp-package-v1',status:'sealed-for-review-not-registered',createdAt:new Date().toISOString(),contentDigest:digest,
 projectDirectoryName:path.basename(projectRoot),git,preflight,registration,
 reviewMaterials:{included:reviewDocuments,historicalReferencePolicy:'Only explicit reviewDocuments and client src JSON are included. Other historical review references, dependencies, server examples and tests require the full checkout.'},
 exclusions:['.git','node_modules','all.env files','server/spw-validate.js','temporary review drafts outside explicit allowlist','other math/art research artifacts','old releases and archives'],
 buildFreshness:{method:'Pinned actual-build public configuration and exact source/dist hashes, plus dist/index.html mtime and stable copy snapshots',distIndexSHA256:dist.indexEntry.sha256,buildProof},
 files:fileManifest.sort((a,b)=>a.path.localeCompare(b.path)),limitation:'Hashes identify packaged working files. They do not prove provider approval, server deployment, live identity, reproducible compilation or real-money security.'};
const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n','utf8');writeFileSync(path.join(releaseFolder,'manifest.json'),manifestBytes,{flag:'wx'});
const quote=value=>"'"+value.replaceAll("'","''")+"'";
console.log(JSON.stringify({...preflight,releaseFolder,manifestSHA256:sha(manifestBytes),archiveCreated:false,
 archiveCommand:'Compress-Archive -LiteralPath '+quote(releaseFolder)+' -DestinationPath '+quote(releaseFolder+'.zip')},null,2));
