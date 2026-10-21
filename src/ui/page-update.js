// Every render produces the page's HTML. Applying it to the live page this way
// keeps each element that is still there instead of replacing them all, so the
// board the player is typing into keeps its focus and its listeners, a 3D view
// keeps its canvas, an open panel stays open and an input keeps what was typed.
// - Elements are matched by data-key, else id, else by tag in order. A command
//   button is only ever reused for the same command, so a focused button never
//   turns into another order under the player's finger.
// - Only the attributes a render wrote are kept in step with the new HTML; an
//   attribute a script added (a bound board, the 3D stage's status) stays.
// - An element a script placed in the page (data-live) is left where it is.
// - A form field takes a new value, checked state or selection only when the
//   render changed it.
const rendered=new WeakMap(); // element -> the attributes its last render wrote

const keyOf=node=>node.nodeType===1?node.getAttribute('data-key')??(node.id?`#${node.id}`:null):null;
const live=node=>node.nodeType===1&&node.hasAttribute('data-live');
const sameKind=(a,b)=>a.nodeType===b.nodeType&&a.nodeName===b.nodeName&&
  (a.nodeType!==1||['type','data-cmd','data-id'].every(name=>a.getAttribute(name)===b.getAttribute(name)));

export function updatePage(root,html){
  const doc=root.ownerDocument,template=doc.createElement('template');template.innerHTML=html;
  updateChildren(root,template.content,doc);
}

function remember(node){
  if(node.nodeType!==1)return;
  rendered.set(node,new Map(node.attributes?[...node.attributes].map(a=>[a.name,a.value]):[]));
  for(const child of node.childNodes)remember(child);
}

function updateChildren(parent,next,doc){
  const keyed=new Map();for(const node of parent.childNodes){const key=keyOf(node);if(key)keyed.set(key,node);}
  const wanted=new Set([...next.childNodes].map(keyOf).filter(Boolean));
  let cursor=parent.firstChild;
  const skipLive=()=>{while(cursor&&live(cursor))cursor=cursor.nextSibling;};
  for(const want of [...next.childNodes]){
    skipLive();
    const key=keyOf(want);let match=null;
    if(key){
      const found=keyed.get(key);
      if(found&&found.parentNode===parent&&sameKind(found,want)){
        // Elements between here and the match that no later part of the page wants are
        // dropped, so the match (often the focused board) never has to move.
        let ahead=false;for(let n=cursor;n;n=n.nextSibling)if(n===found){ahead=true;break;}
        if(ahead)for(let n=cursor;n&&n!==found;){const nextNode=n.nextSibling;if(!live(n)&&!wanted.has(keyOf(n))){if(n===cursor)cursor=nextNode;n.remove();}n=nextNode;}
        skipLive();match=found;
      }
    }else{
      // The next unkeyed node of the same kind, dropping unwanted nodes before it.
      for(let n=cursor,steps=0;n&&steps<4;n=n.nextSibling,steps++){
        if(live(n))continue;
        if(!keyOf(n)&&sameKind(n,want)){
          for(let m=cursor;m!==n;){const nextNode=m.nextSibling;if(!live(m)&&!wanted.has(keyOf(m))){if(m===cursor)cursor=nextNode;m.remove();}m=nextNode;}
          skipLive();match=n;break;
        }
      }
    }
    if(match){
      if(match!==cursor)parent.insertBefore(match,cursor);else cursor=cursor.nextSibling;
      updateNode(match,want,doc);
    }else{
      const node=doc.importNode(want,true);remember(node);parent.insertBefore(node,cursor);
    }
  }
  for(let n=cursor;n;){const nextNode=n.nextSibling;if(!live(n))n.remove();n=nextNode;}
  // Keyed elements the new page no longer has.
  for(const node of keyed.values())if(node.parentNode===parent&&!live(node)&&!wanted.has(keyOf(node)))node.remove();
}

function updateNode(node,want,doc){
  if(node.nodeType!==1){if(node.nodeValue!==want.nodeValue)node.nodeValue=want.nodeValue;return;}
  const before=rendered.get(node)??new Map([...node.attributes].map(a=>[a.name,a.value])),after=new Map([...want.attributes].map(a=>[a.name,a.value]));
  for(const [name,value] of after){
    if(node.getAttribute(name)!==value)node.setAttribute(name,value);
    if(before.get(name)!==value)syncProperty(node,name,value);
  }
  for(const name of before.keys())if(!after.has(name)){node.removeAttribute(name);syncProperty(node,name,null);}
  rendered.set(node,after);
  if(node.localName==='textarea'){const text=want.textContent;if(node.textContent!==text){node.textContent=text;node.value=text;}return;}
  updateChildren(node,want,doc);
}

// A render that changes a field's value, checked state or selection also changes
// what the field shows; otherwise what the player typed or chose stays.
function syncProperty(node,name,value){
  if(name==='value'&&['input','select'].includes(node.localName))node.value=value??'';
  else if(name==='checked'&&node.localName==='input')node.checked=value!==null;
  else if(name==='selected'&&node.localName==='option')node.selected=value!==null;
}
