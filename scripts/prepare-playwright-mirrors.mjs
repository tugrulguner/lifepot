import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Preserve Ubuntu's signed packages, suites and mirror priority metadata.
export function rewriteUbuntuMirrorList(text, security=false) {
 const target=security?'https://security.ubuntu.com/ubuntu':'https://archive.ubuntu.com/ubuntu';
 return text.replace(/(^|[\r\n])([ \t]*)https?:\/\/azure\.archive\.ubuntu\.com\/ubuntu(?=\/?(?:[ \t\r\n]|$))/g, (_match,prefix,indent)=>prefix+indent+target);
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.platform!=='linux'||process.env.GITHUB_ACTIONS!=='true')throw new Error('Mirror preparation is restricted to Linux GitHub Actions runners');
 for(const [path,security] of [['/etc/apt/apt-mirrors.txt',false],['/etc/apt/apt-mirrors-security.txt',true]]){
  let before;try{before=readFileSync(path,'utf8');}catch(error){if(error.code==='ENOENT')continue;throw error;}
  const after=rewriteUbuntuMirrorList(before,security);
  if(after!==before){writeFileSync(path,after);console.log('Prepared official Ubuntu mirror:',path);}else console.log('No Azure mirror replacement needed:',path);
 }
}
