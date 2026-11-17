const fs = require('fs');
const code = fs.readFileSync('chunk_493.js', 'utf8');

const start3dd6 = code.indexOf('function _0x3dd6()');
let braceCount = 0; let end3dd6 = -1;
for (let i = start3dd6; i < code.length; i++) {
  if (code[i] === '{') braceCount++;
  else if (code[i] === '}') {
    braceCount--;
    if (braceCount === 0) { end3dd6 = i + 1; break; }
  }
}
const func3dd6Code = code.substring(start3dd6, end3dd6);

const start339c = code.indexOf('function _0x339c(');
braceCount = 0; let end339c = -1;
for (let i = start339c; i < code.length; i++) {
  if (code[i] === '{') braceCount++;
  else if (code[i] === '}') {
    braceCount--;
    if (braceCount === 0) { end339c = i + 1; break; }
  }
}
const func339cCode = code.substring(start339c, end339c);

const rotStart = code.indexOf('(function(stringArrayFunction,_0x362d31){');
const rotEnd = code.indexOf('}(_0x3dd6,0x605d9));') + '}(_0x3dd6,0x605d9));'.length;
const rotCode = code.substring(rotStart, rotEnd);

const evalEnv = func3dd6Code + '\n' + func339cCode + '\n' + rotCode + '\nreturn _0x339c;';
const decoder = new Function(evalEnv)();

console.log('0x23c:', decoder(0x23c));
console.log('0x1e8:', decoder(0x1e8));

// Let's find _0x52775c definition around snippet 100201
console.log('Snippet around 100000:');
const snip = code.substring(99000, 101000);
console.log(snip.substring(snip.indexOf('_0x52775c'), snip.indexOf('_0x52775c') + 500));
