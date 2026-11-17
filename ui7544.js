'use strict';
// UI-only enhancements; no changes to persistence or OneDrive merging.
(function(){
 const routeHistory=[];
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const originalRender=window.render;
 if(typeof originalRender==='function'){
  window.render=function(){
   if(typeof route!=='undefined'){
    const current=JSON.parse(JSON.stringify(route));
    const last=routeHistory[routeHistory.length-1];
    if(!last||!same(last,current)){routeHistory.push(current);if(routeHistory.length>60)routeHistory.shift()}
   }
   return originalRender.apply(this,arguments);
  };
 }
 let start=null;
 document.addEventListener('touchstart',e=>{
  if(e.touches.length!==1||e.touches[0].clientX>32||document.querySelector('dialog[open]')||document.body.classList.contains('auth-locked')){start=null;return}
  const t=e.touches[0];start={x:t.clientX,y:t.clientY,at:Date.now()};
 },{passive:true});
 document.addEventListener('touchend',e=>{
  if(!start||!e.changedTouches.length)return;
  const t=e.changedTouches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;
  const valid=dx>95&&Math.abs(dy)<Math.abs(dx)*.55&&Date.now()-start.at<1100;
  start=null;
  if(!valid||routeHistory.length<2||typeof route==='undefined')return;
  routeHistory.pop();route=routeHistory.pop();window.render();
 },{passive:true});
 // Separate camera control beside image upload fields, including dynamically created dialogs.
 function addCameraButtons(root){
  const inputs=[];
  if(root.nodeType===1&&root.matches?.('input[type="file"]'))inputs.push(root);
  root.querySelectorAll?.('input[type="file"]').forEach(x=>inputs.push(x));
  for(const input of inputs){
   if(input.dataset.cameraEnhanced||input.id==='photoPicker'||input.hasAttribute('data-camera-proxy'))continue;
   const accept=(input.getAttribute('accept')||'').toLowerCase();
   if(!(accept.includes('image')||accept.includes('.png')||accept.includes('.jpg')))continue;
   input.dataset.cameraEnhanced='1';
   const button=document.createElement('button');button.type='button';button.className='btn secondary camera-direct-btn';button.textContent='📷 Foto aufnehmen';
   button.setAttribute('aria-label','Foto direkt mit der Kamera aufnehmen');
   const camera=document.createElement('input');camera.type='file';camera.accept='image/*';camera.setAttribute('capture','environment');camera.setAttribute('data-camera-proxy','1');camera.hidden=true;
   camera.addEventListener('change',()=>{
    if(!camera.files?.length)return;
    try{
     const transfer=new DataTransfer();for(const f of camera.files)transfer.items.add(f);
     input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
    }catch(err){alert('Das Kamerafoto konnte nicht übernommen werden. Bitte stattdessen „Datei auswählen“ verwenden.');}
    camera.value='';
   });
   button.addEventListener('click',()=>camera.click());
   input.insertAdjacentElement('afterend',button);button.insertAdjacentElement('afterend',camera);
  }
 }
 const observer=new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1)addCameraButtons(n)});
 function init(){addCameraButtons(document);observer.observe(document.body,{childList:true,subtree:true})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
