// Optional website imagery never participates in campaign state or chapter caching.
export function setupSiteMedia(root,connection=navigator.connection){
  const images=[...root.querySelectorAll('img[data-src]')];
  let cancelled=false;
  const limited=connection?.saveData||['slow-2g','2g'].includes(connection?.effectiveType)||(Number.isFinite(connection?.downlink)&&connection.downlink<1);
  const load=image=>{if(cancelled||!image.dataset.src)return;image.src=image.dataset.src;delete image.dataset.src;image.classList.add('media-ready');};
  if(limited){
    const bindings=images.map(image=>{const button=document.createElement('button');button.className='media-request';button.textContent='Load optional image';const click=()=>{load(image);button.remove();};button.addEventListener('click',click,{once:true});image.after(button);return {button,click};});
    return ()=>{cancelled=true;for(const {button,click}of bindings){button.removeEventListener('click',click);button.remove();}};
  }
  if(!('IntersectionObserver' in window)){images.forEach(load);return ()=>{};}
  const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){load(entry.target);observer.unobserve(entry.target);}},{rootMargin:'80px'});
  images.forEach(image=>observer.observe(image));
  return ()=>{cancelled=true;observer.disconnect();};
}
