// A stylesheet as data, so tests check what a rule declares, not how the file
// is formatted: every rule's selectors and declarations in source order (rules
// inside @media and @supports included), and each @keyframes block's steps.
const strip=css=>css.replace(/\/\*[\s\S]*?\*\//g,'');

// Splits "a:b;c:url(x;y)" on top-level semicolons only, outside quotes and brackets.
function declarations(body){
  const out={};let start=0,quote=null,depth=0;
  for(let i=0;i<=body.length;i++){
    const c=body[i];
    if(quote){if(c===quote&&body[i-1]!=='\\')quote=null;continue;}
    if(c==='"'||c==="'")quote=c;else if(c==='(')depth++;else if(c===')')depth--;
    else if(i===body.length||c===';'&&depth===0){
      const text=body.slice(start,i),colon=text.indexOf(':');start=i+1;
      if(colon>0)out[text.slice(0,colon).trim()]=text.slice(colon+1).trim();
    }
  }
  return out;
}

export function cssRules(css){
  const rules=[];
  for(const [,head,body] of strip(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)){
    const selectors=head.trim().split(',').map(s=>s.trim().replace(/\s+/g,' ')).filter(Boolean);
    rules.push({selectors,declarations:declarations(body)});
  }
  return rules;
}

// The declarations of every rule with a selector that `match` accepts, later rules winning.
export function declared(css,match){
  const test=typeof match==='string'?selector=>selector===match:match;
  return Object.assign({},...cssRules(css).filter(rule=>rule.selectors.some(test)).map(rule=>rule.declarations));
}

export function keyframes(css,name){
  const block=new RegExp(`@keyframes\\s+${name}\\s*\\{((?:[^{}]*\\{[^{}]*\\})*)\\s*\\}`).exec(strip(css));
  return block?Object.fromEntries(cssRules(block[1]).map(rule=>[rule.selectors.join(','),rule.declarations])):null;
}
