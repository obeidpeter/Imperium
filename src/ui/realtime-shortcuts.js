// Let native controls keep their activation/navigation keys. Other game keys,
// particularly Pause, remain available throughout the field and its command list.
// Text entry and modal dialogs own their keys completely.
export function fieldShortcutAllowed(event,{canvas,root,modalOpen=false}={}){
  if(modalOpen||event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey)return false;
  const target=event.target;
  if(target?.closest?.('textarea,select,[contenteditable=""],[contenteditable="true"],[role="textbox"],[role="combobox"],[role="slider"],dialog[open],[aria-modal="true"]'))return false;
  const input=target?.closest?.('input');if(input&&!['checkbox','radio','button','submit','reset'].includes(input.type))return false;
  if(target===canvas)return true;
  // Focus on the page around the world rather than in any control: its body, or the page's main after a click on the
  // strip's or the bar's text (main takes the focus, tabindex -1), or a focused control gone. The key is the world's, as
  // from the canvas: before, every key went unheard until the world was clicked again. Tab still moves the focus.
  if(root&&target&&target!==root&&target.contains?.(root))return event.code!=='Tab';
  if(!root?.contains?.(target))return false;
  return !['Enter','Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(event.code);
}
