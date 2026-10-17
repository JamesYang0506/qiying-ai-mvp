import {build} from 'esbuild';import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));await mkdir(path.join(root,'runtime'),{recursive:true});
await build({absWorkingDir:root,entryPoints:['server/http/app.mjs'],outfile:'runtime/server.mjs',bundle:true,platform:'node',target:'node20',format:'esm',charset:'utf8',legalComments:'inline',banner:{js:"import {createRequire as __createRequire} from 'node:module';const require=__createRequire(import.meta.url);"}});
// Keep generated dependency documentation comments free of trailing whitespace.
const runtimeFile=path.join(root,'runtime','server.mjs');
await writeFile(runtimeFile,(await readFile(runtimeFile,'utf8')).replace(/^([ \t]*\*[^\r\n]*?)[ \t]+$/gm,'$1'));
const lock=JSON.parse(await readFile(path.join(root,'package-lock.json'),'utf8'));let notice='Third-party licenses bundled with the local import server\n\n';const entries=[];
for(const [pkg,meta]of Object.entries(lock.packages)){if(!pkg||meta.dev)continue;const dir=path.join(root,pkg);const p=JSON.parse(await readFile(path.join(dir,'package.json'),'utf8'));const files=await readdir(dir);const license=files.find(n=>/^license(?:\.md|\.txt)?$/i.test(n))??files.find(n=>/^licence/i.test(n));const content=license?await readFile(path.join(dir,license),'utf8'):`License: ${p.license??meta.license??'See package repository'}`;notice+=`===== ${p.name}@${p.version} =====\n${content}\n\n`;entries.push(`- ${p.name} ${p.version} — ${p.license??meta.license??'See license text'}`);}
await writeFile(path.join(root,'runtime','THIRD_PARTY_LICENSES.txt'),notice);
await writeFile(path.join(root,'THIRD_PARTY_NOTICES.md'),'# Third-party notices\n\nLocal server dependencies are bundled in runtime/server.mjs; full license text is in runtime/THIRD_PARTY_LICENSES.txt. Development dependencies are not part of the runtime bundle.\n\n'+entries.join('\n')+'\n');
console.log('Runtime bundle and third-party licenses built.');
