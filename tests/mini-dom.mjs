// A small DOM for Node tests: elements, text, comments, fragments and templates,
// an HTML parser and serializer for what the game's views render, simple
// selectors, focus, and events that bubble from an element to its ancestors and
// the document. Enough to run the page's own update code and drive its controls;
// it does no layout, styling or loading, and is not a browser.
const VOID=new Set(['area','base','br','col','embed','hr','img','input','link','meta','source','track','wbr']);
const ENTITIES={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
const decode=text=>text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(match,name)=>name[0]==='#'?String.fromCodePoint(name[1].toLowerCase()==='x'?parseInt(name.slice(2),16):Number(name.slice(1))):ENTITIES[name.toLowerCase()]??match);
const escapeText=text=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/ /g,'&nbsp;');
const escapeAttribute=text=>text.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/ /g,'&nbsp;');

class Node{
  constructor(doc){this.ownerDocument=doc;this.parentNode=null;this.childNodes=[];this.listeners=new Map();}
  get firstChild(){return this.childNodes[0]??null;}
  get lastChild(){return this.childNodes.at(-1)??null;}
  get nextSibling(){const siblings=this.parentNode?.childNodes;return siblings?siblings[siblings.indexOf(this)+1]??null:null;}
  get previousSibling(){const siblings=this.parentNode?.childNodes;return siblings?siblings[siblings.indexOf(this)-1]??null:null;}
  get parentElement(){return this.parentNode?.nodeType===1?this.parentNode:null;}
  get isConnected(){let node=this;while(node.parentNode)node=node.parentNode;return node.nodeType===9;}
  get children(){return this.childNodes.filter(n=>n.nodeType===1);}
  contains(node){for(let n=node;n;n=n.parentNode)if(n===this)return true;return false;}
  insertBefore(node,ref){
    if(node.nodeType===11){for(const child of [...node.childNodes])this.insertBefore(child,ref);return node;}
    if(ref&&ref.parentNode!==this)throw new Error('NotFoundError: the reference is not a child');
    if(node.contains(this))throw new Error('HierarchyRequestError');
    if(node.parentNode)node.parentNode.removeChild(node);
    const index=ref?this.childNodes.indexOf(ref):this.childNodes.length;
    this.childNodes.splice(index,0,node);node.parentNode=this;return node;
  }
  appendChild(node){return this.insertBefore(node,null);}
  removeChild(node){
    const index=this.childNodes.indexOf(node);if(index<0)throw new Error('NotFoundError: not a child');
    this.childNodes.splice(index,1);node.parentNode=null;
    const doc=this.ownerDocument;if(doc?.activeElement&&node.contains(doc.activeElement))doc.activeElement=doc.body;
    return node;
  }
  replaceChild(node,old){this.insertBefore(node,old);return this.removeChild(old);}
  remove(){this.parentNode?.removeChild(this);}
  append(...nodes){for(const n of nodes)this.appendChild(typeof n==='string'?this.ownerDocument.createTextNode(n):n);}
  prepend(...nodes){const first=this.firstChild;for(const n of nodes)this.insertBefore(typeof n==='string'?this.ownerDocument.createTextNode(n):n,first);}
  after(...nodes){const next=this.nextSibling;for(const n of nodes)this.parentNode.insertBefore(typeof n==='string'?this.ownerDocument.createTextNode(n):n,next);}
  before(...nodes){for(const n of nodes)this.parentNode.insertBefore(typeof n==='string'?this.ownerDocument.createTextNode(n):n,this);}
  replaceChildren(...nodes){for(const child of [...this.childNodes])this.removeChild(child);this.append(...nodes);}
  replaceWith(...nodes){const parent=this.parentNode,next=this.nextSibling;if(nodes.includes(this))return;this.remove();for(const n of nodes)parent.insertBefore(n,next);}
  get textContent(){return this.childNodes.map(n=>n.textContent).join('');}
  set textContent(value){for(const child of [...this.childNodes])this.removeChild(child);if(String(value))this.appendChild(this.ownerDocument.createTextNode(String(value)));}
  addEventListener(type,fn,options){const capture=typeof options==='boolean'?options:!!options?.capture;if(!this.listeners.has(type))this.listeners.set(type,[]);const list=this.listeners.get(type);if(!list.some(l=>l.fn===fn&&l.capture===capture))list.push({fn,capture,once:!!options?.once});}
  removeEventListener(type,fn,options){const capture=typeof options==='boolean'?options:!!options?.capture;const list=this.listeners.get(type);if(list)this.listeners.set(type,list.filter(l=>l.fn!==fn||l.capture!==capture));}
  // Capture down from the document, then the target, then bubble up (if the event bubbles).
  dispatchEvent(event){
    const path=[];for(let n=this;n;n=n.parentNode)path.push(n);if(path.at(-1)?.nodeType===9&&path.at(-1).defaultView)path.push(path.at(-1).defaultView);
    let stopped=false,immediate=false;
    Object.defineProperties(event,{target:{value:this,configurable:true},currentTarget:{value:null,writable:true,configurable:true}});
    const stop=event.stopPropagation.bind(event),stopNow=event.stopImmediatePropagation.bind(event);
    event.stopPropagation=()=>{stopped=true;stop();};event.stopImmediatePropagation=()=>{stopped=immediate=true;stopNow();};
    const run=(node,capture)=>{
      for(const l of [...node.listeners?.get(event.type)??[]]){
        if(l.capture!==capture)continue;
        event.currentTarget=node;if(l.once)node.removeEventListener(event.type,l.fn,l.capture);
        l.fn.call(node,event);if(immediate)return;
      }
    };
    for(const node of [...path].reverse().slice(0,-1)){run(node,true);if(stopped)return !event.defaultPrevented;}
    run(this,true);if(!immediate)run(this,false);
    if(event.bubbles)for(const node of path.slice(1)){if(stopped)break;run(node,false);}
    return !event.defaultPrevented;
  }
}

class Text extends Node{
  constructor(doc,data){super(doc);this.nodeValue=String(data);}
  get nodeType(){return 3;} get nodeName(){return '#text';}
  get data(){return this.nodeValue;} set data(value){this.nodeValue=String(value);}
  get textContent(){return this.nodeValue;} set textContent(value){this.nodeValue=String(value);}
  cloneNode(){return new Text(this.ownerDocument,this.nodeValue);}
}
class Comment extends Node{
  constructor(doc,data){super(doc);this.nodeValue=String(data);}
  get nodeType(){return 8;} get nodeName(){return '#comment';}
  get textContent(){return '';}
  cloneNode(){return new Comment(this.ownerDocument,this.nodeValue);}
}
class DocumentFragment extends Node{
  get nodeType(){return 11;} get nodeName(){return '#document-fragment';}
  cloneNode(deep){const copy=new DocumentFragment(this.ownerDocument);if(deep)for(const c of this.childNodes)copy.appendChild(c.cloneNode(true));return copy;}
  querySelector(selector){return query(this,selector)[0]??null;}
  querySelectorAll(selector){return query(this,selector);}
}

class Element extends Node{
  constructor(doc,tag){super(doc);this.localName=tag.toLowerCase();this.attributeMap=new Map();this.style={setProperty(){},removeProperty(){}};this.state={};}
  get nodeType(){return 1;} get nodeName(){return this.localName.toUpperCase();} get tagName(){return this.nodeName;}
  get attributes(){return [...this.attributeMap].map(([name,value])=>({name,value}));}
  getAttribute(name){return this.attributeMap.get(name)??null;}
  setAttribute(name,value){this.attributeMap.set(name,String(value));}
  removeAttribute(name){this.attributeMap.delete(name);}
  hasAttribute(name){return this.attributeMap.has(name);}
  toggleAttribute(name,force){const on=force??!this.hasAttribute(name);if(on)this.setAttribute(name,'');else this.removeAttribute(name);return on;}
  get id(){return this.getAttribute('id')??'';} set id(value){this.setAttribute('id',value);}
  get className(){return this.getAttribute('class')??'';} set className(value){this.setAttribute('class',value);}
  get classList(){const el=this,list=()=>el.className.split(/\s+/).filter(Boolean);return {contains:c=>list().includes(c),add:(...c)=>{el.className=[...new Set([...list(),...c])].join(' ');},remove:(...c)=>{el.className=list().filter(x=>!c.includes(x)).join(' ');},toggle:(c,force)=>{const on=force??!list().includes(c);if(on)el.classList.add(c);else el.classList.remove(c);return on;}};}
  get dataset(){
    const el=this,attr=key=>'data-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
    return new Proxy({},{get:(_,key)=>typeof key==='string'?el.getAttribute(attr(key))??undefined:undefined,set:(_,key,value)=>{el.setAttribute(attr(key),value);return true;},
      deleteProperty:(_,key)=>{el.removeAttribute(attr(key));return true;},has:(_,key)=>el.hasAttribute(attr(key)),
      ownKeys:()=>[...el.attributeMap.keys()].filter(n=>n.startsWith('data-')).map(n=>n.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())),getOwnPropertyDescriptor:()=>({enumerable:true,configurable:true})});
  }
  get hidden(){return this.hasAttribute('hidden');} set hidden(value){this.toggleAttribute('hidden',!!value);}
  get disabled(){return this.hasAttribute('disabled');} set disabled(value){this.toggleAttribute('disabled',!!value);}
  get open(){return this.hasAttribute('open');} set open(value){this.toggleAttribute('open',!!value);}
  // Form state follows its attribute until a script or the player sets it, as in a browser.
  get value(){
    if('value' in this.state)return this.state.value;
    if(this.localName==='textarea')return this.textContent;
    if(this.localName==='select'){const options=query(this,'option');return (options.find(o=>o.selected)??options[0])?.value??'';}
    if(this.localName==='option')return this.getAttribute('value')??this.textContent;
    return this.getAttribute('value')??'';
  }
  set value(value){
    if(this.localName==='select'){for(const o of query(this,'option'))o.selected=o.value===String(value);return;}
    this.state.value=String(value);
  }
  get checked(){return 'checked' in this.state?this.state.checked:this.hasAttribute('checked');}
  set checked(value){
    // Checking a radio unchecks the others of its group.
    if(value&&this.getAttribute('type')==='radio'&&this.getAttribute('name')){let root=this;while(root.parentNode)root=root.parentNode;for(const other of query(root,`input[name="${this.getAttribute('name')}"]`))if(other!==this)other.state.checked=false;}
    this.state.checked=!!value;
  }
  get selected(){return 'selected' in this.state?this.state.selected:this.hasAttribute('selected');}
  set selected(value){if(value&&this.localName==='option'){const select=this.closest('select');if(select)for(const o of query(select,'option'))if(o!==this)o.state.selected=false;}this.state.selected=!!value;}
  get innerHTML(){return this.childNodes.map(serialize).join('');}
  set innerHTML(html){for(const child of [...this.childNodes])this.removeChild(child);this.appendChild(parseHTML(this.ownerDocument,html));}
  get outerHTML(){return serialize(this);}
  set outerHTML(html){this.replaceWith(parseHTML(this.ownerDocument,html));}
  cloneNode(deep){
    const copy=this.ownerDocument.createElement(this.localName);for(const [name,value] of this.attributeMap)copy.attributeMap.set(name,value);
    if(deep)for(const c of (this.content??this).childNodes)(copy.content??copy).appendChild(c.cloneNode(true));
    return copy;
  }
  querySelector(selector){return query(this,selector)[0]??null;}
  querySelectorAll(selector){return query(this,selector);}
  matches(selector){return selector.split(',').some(s=>matchesCompound(this,s.trim()));}
  closest(selector){for(let n=this;n?.nodeType===1;n=n.parentNode)if(n.matches(selector))return n;return null;}
  focus(){this.ownerDocument.activeElement=this;}
  blur(){if(this.ownerDocument.activeElement===this)this.ownerDocument.activeElement=this.ownerDocument.body;}
  getBoundingClientRect(){return this.rect??{left:0,top:0,width:0,height:0,right:0,bottom:0};}
  scrollIntoView(){}
  showModal(){this.setAttribute('open','');}
  close(){if(!this.hasAttribute('open'))return;this.removeAttribute('open');this.dispatchEvent(new Event('close'));}
  getContext(){return null;}
}
class TemplateElement extends Element{
  constructor(doc){super(doc,'template');this.content=new DocumentFragment(doc);}
  get innerHTML(){return this.content.childNodes.map(serialize).join('');}
  set innerHTML(html){this.content=parseHTML(this.ownerDocument,html);}
}
export class Document extends Node{
  constructor(){
    super(null);this.ownerDocument=this;this.documentElement=this.createElement('html');this.appendChild(this.documentElement);
    this.body=this.createElement('body');this.documentElement.appendChild(this.body);this.activeElement=this.body;this.hidden=false;this.defaultView=null;
  }
  get nodeType(){return 9;} get nodeName(){return '#document';}
  createElement(tag){return tag.toLowerCase()==='template'?new TemplateElement(this):new Element(this,tag);}
  createElementNS(_,tag){return new Element(this,tag);}
  createTextNode(data){return new Text(this,data);}
  createComment(data){return new Comment(this,data);}
  createDocumentFragment(){return new DocumentFragment(this);}
  importNode(node,deep){return adopt(node.cloneNode(deep),this);}
  getElementById(id){return query(this,`#${id}`)[0]??null;}
  querySelector(selector){return query(this,selector)[0]??null;}
  querySelectorAll(selector){return query(this,selector);}
}
function adopt(node,doc){node.ownerDocument=doc;for(const c of node.childNodes)adopt(c,doc);if(node.content)adopt(node.content,doc);return node;}

// HTML: start and end tags with quoted, bare or boolean attributes, void and
// self-closed elements, text with entities, and comments.
export function parseHTML(doc,html){
  const root=new DocumentFragment(doc),stack=[root],tag=/<!--([\s\S]*?)-->|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;
  let last=0,match;
  const text=value=>{if(value)stack.at(-1).appendChild(doc.createTextNode(decode(value)));};
  while((match=tag.exec(html))){
    text(html.slice(last,match.index));last=tag.lastIndex;
    const [,comment,end,start,attributes,selfClosing]=match;
    if(comment!==undefined){stack.at(-1).appendChild(doc.createComment(comment));continue;}
    if(end){const name=end.toLowerCase();for(let i=stack.length-1;i>0;i--)if(stack[i].localName===name){stack.length=i;break;}continue;}
    const el=doc.createElement(start);
    for(const [,name,,a,b,c] of attributes.matchAll(/([^\s"'>\/=]+)(\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g))el.setAttribute(name.toLowerCase(),decode(a??b??c??''));
    (stack.at(-1).content??stack.at(-1)).appendChild(el);
    if(!selfClosing&&!VOID.has(el.localName))stack.push(el.content?Object.assign(el.content,{localName:'template'}):el);
  }
  text(html.slice(last));
  return root;
}
function serialize(node){
  if(node.nodeType===3)return node.parentNode&&['script','style'].includes(node.parentNode.localName)?node.nodeValue:escapeText(node.nodeValue);
  if(node.nodeType===8)return `<!--${node.nodeValue}-->`;
  if(node.nodeType===11)return node.childNodes.map(serialize).join('');
  const attributes=[...node.attributeMap].map(([name,value])=>` ${name}="${escapeAttribute(value)}"`).join('');
  if(VOID.has(node.localName))return `<${node.localName}${attributes}>`;
  return `<${node.localName}${attributes}>${(node.content??node).childNodes.map(serialize).join('')}</${node.localName}>`;
}

// Selectors: tag, #id, .class, [name], [name=value] (quoted or bare), :checked,
// :not(simple), with descendant (space) and child (>) combinators, and lists.
function matchesSimple(el,part){
  const re=/([a-zA-Z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:=("[^"]*"|'[^']*'|[^\]]+))?\]|:checked|:not\(([^)]*)\)/g;let m,consumed=0;
  while((m=re.exec(part))){
    if(m.index!==consumed)throw new Error(`Unsupported selector: ${part}`);consumed=re.lastIndex;
    if(m[1]&&el.localName!==m[1].toLowerCase())return false;
    if(m[2]&&el.id!==m[2])return false;
    if(m[3]&&!el.classList.contains(m[3]))return false;
    if(m[4]){if(!el.hasAttribute(m[4]))return false;if(m[5]!==undefined&&el.getAttribute(m[4])!==m[5].replace(/^["']|["']$/g,''))return false;}
    if(m[0]===':checked'&&!el.checked)return false;
    if(m[6]!==undefined&&matchesSimple(el,m[6]))return false;
  }
  if(consumed!==part.length)throw new Error(`Unsupported selector: ${part}`);
  return true;
}
function matchesCompound(el,selector){
  const parts=selector.replace(/\s*>\s*/g,' > ').split(/\s+/).filter(Boolean);
  const test=(node,i)=>{
    if(!matchesSimple(node,parts[i]))return false;if(i===0)return true;
    if(parts[i-1]==='>'){const parent=node.parentNode;return parent?.nodeType===1&&test(parent,i-2);}
    for(let p=node.parentNode;p?.nodeType===1;p=p.parentNode)if(test(p,i-1))return true;
    return false;
  };
  return test(el,parts.length-1);
}
function query(root,selector){
  const found=[];
  (function walk(node){for(const child of (node.content??node).childNodes)if(child.nodeType===1){if(child.matches(selector))found.push(child);walk(child);}})(root);
  return found;
}
