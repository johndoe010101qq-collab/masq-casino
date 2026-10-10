import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,lstatSync,mkdirSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Export committed, complete review sources with current working-file bytes.
// No Git credentials/history, deployed secrets, dependencies or old archives.
const project=realpathSync(fileURLToPath(new URL('../',import.meta.url)));
const workspace=realpathSync(path.dirname(project));
const git=(...args)=>execFileSync('git',['-C',project,...args],{encoding:'utf8',maxBuffer:16*1024*1024});
assert.equal(git('status','--porcelain').trim(),'','Commit final reviewed inputs before source export.');
const head=git('rev-parse','HEAD').trim();
const roots=new Set(['README.md','package.json','package-lock.json','index.html','vite.config.js','.gitignore','.env.example','LICENSE','LICENSE.md']);
const selected=git('ls-files','-z').split('\0').filter(Boolean).filter(file=>roots.has(file)||/^(src|public|tests|docs|scripts|deploy|server)\//.test(file));
const inside=(root,file)=>{const relative=path.relative(root,file);return relative===''||(!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep));};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const entries=selected.map(file=>{
  assert(!file.split('/').some(part=>/^(\.git|node_modules|\.openai|\.codex|secrets?|credentials?)$/i.test(part)),'Excluded source path.');
  assert(!/\.(zip|tar|gz|7z|log|pem|key|p12|pfx)$/i.test(file),'Excluded source extension.');
  assert(!file.split('/').some(part=>/^\.env(?:\.|$)/i.test(part))||file==='.env.example','Actual env file excluded.');
  const source=path.join(project,file);assert(inside(project,source));
  assert(lstatSync(source).isFile()&&!lstatSync(source).isSymbolicLink(),'Only regular source files are exported.');
  assert(inside(project,realpathSync(source)));
  const bytes=readFileSync(source);
  if(/\.(?:m?js|jsx|json|html|css|md|txt|example|conf|ts|tsx)$/i.test(file)){
    const text=bytes.toString('utf8');
    const token=/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|npm_[A-Za-z0-9]{30,})\b/;
    const privateKey=/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/;
    if(token.test(text)||privateKey.test(text))throw new Error('Credential signature detected in '+file+'; value suppressed.');
    if(file==='.env.example')assert(text.split(/\r?\n/).filter(line=>line.trim()&&!line.trim().startsWith('#')).every(line=>/^\w+=\s*$/.test(line)),'Env template must have empty values.');
  }
  return {path:file,bytes,size:bytes.length,sha256:sha(bytes)};
});
assert(selected.includes('tests/miniapp-package-checks.mjs')&&selected.includes('docs/RELEASE_RTP_AUDIT.md'));
const folder=path.join(workspace,'release-miniapp','indictus-source-v25-'+head.slice(0,12));
assert(inside(workspace,folder)&&!inside(project,folder));
assert(!existsSync(folder),'Existing source export is preserved; choose a new reviewed commit.');
mkdirSync(folder,{recursive:true});
for(const entry of entries){const target=path.join(folder,entry.path);assert(inside(folder,target));mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,entry.bytes,{flag:'wx'});assert.equal(sha(readFileSync(target)),entry.sha256);assert.equal(sha(readFileSync(path.join(project,entry.path))),entry.sha256,'Working source changed during export.');}
assert.equal(git('rev-parse','HEAD').trim(),head);assert.equal(git('status','--porcelain').trim(),'');
const manifest={version:'indictus-complete-review-source-v25',sourceCommit:head,createdAt:new Date().toISOString(),files:entries.map(({bytes,...entry})=>entry),
  included:'Client, public assets, full tests, mechanics/review docs, packaging scripts, deploy example and explicitly non-production validation server example.',
  exclusions:['Git history/credentials','node_modules','dist','actual .env files','.openai','other workspace research and releases'],
  backendStatus:'No production finance/backend/admin service. server/spw-validate.js is an Express example only.',
  repositoryPublished:false,providerApproved:false};
const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');writeFileSync(path.join(folder,'review-source-manifest.json'),manifestBytes,{flag:'wx'});
const pushGuide=`# Передача исходников на GitHub/GitLab\n\nИсходная проверенная версия: ${head}. Скопированы рабочие байты с SHA-256, включая тесты. Секреты, .git, зависимости и реальный backend отсутствуют. Серверный файл — пример проверки профиля, а не финансовый сервис.\n\nСоздать пустой приватный репозиторий, затем из этой папки:\n\n\`\`\`powershell\ngit init -b main\ngit config core.autocrlf false\ngit add .\ngit commit -m "Prepare Indictus SPWorlds DEMO for review"\ngit remote add origin https://github.com/OWNER/REPOSITORY.git\ngit push -u origin main\n\`\`\`\n\nЗаменить OWNER/REPOSITORY настоящим адресом. Не публиковать токены. Разрешить проверяющему доступ отдельно после подтверждения его аккаунта. Наличие приватного репозитория само по себе не даёт ему доступ.\n\nДля проверки: npm ci, npm test, node tests/miniapp-package-checks.mjs, npm run build. После git init сборщик miniapp можно запустить по инструкции в docs/MINIAPP_REGISTRATION_KIT.md. Установить Node.js 22.12 или новее. Для настоящих АР сначала реализовать общий серверный журнал и подтвердить интеграцию площадкой.\n`;
writeFileSync(path.join(folder,'PUSH_TO_REPOSITORY.md'),pushGuide,{flag:'wx'});
console.log(JSON.stringify({sourceFolder:folder,sourceCommit:head,files:entries.length,totalBytes:entries.reduce((sum,entry)=>sum+entry.size,0),manifestSHA256:sha(manifestBytes),repositoryPublished:false}));
