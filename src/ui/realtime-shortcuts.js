// Let native controls keep their activation/navigation keys. Other game keys,
// particularly Pause, remain available throughout the field and its command list.
// Text entry and modal dialogs own their keys completely.
export function fieldShortcutAllowed(event,{canvas,root,modalOpen=false}={}){
  if(modalOpen||event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey)return false;
  const target=event.target;
  if(target?.closest?.('textarea,select,[contenteditable=""],[contenteditable="true"],[role="textbox"],[role="combobox"],[role="slider"],dialog[open],[aria-modal="true"]'))return false;
  const input=target?.closest?.('input');if(input&&!['checkbox','radio','button','submit','reset'].includes(input.type))return false;
  if(target===canvas)return true;
  if(!root?.contains?.(target))return false;
  return !['Enter','Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(event.code);
}
