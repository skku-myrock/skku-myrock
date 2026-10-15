import {readFile} from 'node:fs/promises';

export async function readStyles(){
 const root=new URL('../src/styles.css',import.meta.url);
 const entry=await readFile(root,'utf8');
 const imports=[...entry.matchAll(/@import\s+['"]\.\/styles\/([^'"]+)['"]\s*;/g)];
 const modules=await Promise.all(imports.map(match=>
   readFile(new URL('../src/styles/'+match[1],import.meta.url),'utf8')
 ));
 return [entry,...modules].join('\n');
}
