import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as mirrors from './prepare-playwright-mirrors.mjs';
function rewrite(text, security=false) { assert.equal(typeof mirrors.rewriteUbuntuMirrorList,'function'); return mirrors.rewriteUbuntuMirrorList(text,security); }
test('preserves priority metadata while replacing the stalled Azure archive with official HTTPS',()=>{
 assert.equal(rewrite('http://azure.archive.ubuntu.com/ubuntu/ priority:1\nhttps://archive.ubuntu.com/ubuntu/ priority:2\n'),'https://archive.ubuntu.com/ubuntu/ priority:1\nhttps://archive.ubuntu.com/ubuntu/ priority:2\n');
});
test('uses the official security archive for the separate security mirror list',()=>{
 assert.equal(rewrite('https://azure.archive.ubuntu.com/ubuntu\n',true),'https://security.ubuntu.com/ubuntu\n');
});
test('does not rewrite comments, lookalike hosts, foreign mirrors or other paths',()=>{
 const text='# http://azure.archive.ubuntu.com/ubuntu\nhttps://azure.archive.ubuntu.com.evil/ubuntu\nhttp://azure.archive.ubuntu.com/ubuntu-other\nhttps://elsewhere.example/ubuntu\n'; assert.equal(rewrite(text),text);
});
test('is idempotent and retains CRLF, indentation and existing Ubuntu sources',()=>{
 const text='  http://azure.archive.ubuntu.com/ubuntu/ priority:1\r\nhttps://archive.ubuntu.com/ubuntu/ priority:2\r\n'; const once=rewrite(text);assert.equal(rewrite(once),once);assert.equal(once,'  https://archive.ubuntu.com/ubuntu/ priority:1\r\nhttps://archive.ubuntu.com/ubuntu/ priority:2\r\n');
});
