import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let html=await readFile(path.join(root,'index.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="styles.css">','<style>'+await readFile(path.join(root,'styles.css'),'utf8')+'</style>');
const regex=/<script src="([^"]+)"><\/script>/g;
for(const m of [...html.matchAll(regex)])html=html.replace(m[0],'<script>\n'+(await readFile(path.join(root,m[1]),'utf8')).replace(/<\/script/gi,'<\\/script')+'\n</script>');
const output=process.argv[2]||path.join(root,'..','AION-preview.html');await writeFile(output,html);console.log(output);
