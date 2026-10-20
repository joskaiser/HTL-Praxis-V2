'use strict';
// Shared image/file intake. Clipboard contents are only read during an explicit upload action.
function imageIntake7528(options){
 const opts=options||{};
 const overlay=document.createElement('div');
 overlay.style.cssText='position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.58);display:flex;align-items:center;justify-content:center;padding:16px';
 overlay.innerHTML='<section role="dialog" aria-modal="true" aria-label="Bild oder Datei einfuegen" style="background:var(--card,#fff);color:var(--text,#222);padding:22px;border-radius:12px;max-width:480px;width:100%;box-shadow:0 12px 35px #0005"><h2>Foto / Skizze einfuegen</h2><p>Screenshot kopieren und hier <b>Strg + V</b> druecken oder eine Datei auswaehlen. Bilder koennen auch hierher gezogen werden.</p><div data-drop style="border:2px dashed #888;border-radius:10px;padding:20px;text-align:center;margin:12px 0">Bild aus Zwischenablage oder Datei hier ablegen</div><p data-status aria-live="polite"></p><div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button type="button" data-cancel class="btn secondary">Abbrechen</button><button type="button" data-select class="btn">Datei auswaehlen</button></div><input type="file" data-file hidden></section>';
 const input=overlay.querySelector('[data-file]'),drop=overlay.querySelector('[data-drop]'),status=overlay.querySelector('[data-status]');
 input.accept=opts.accept||'image/*,.pdf';
 let busy=false;
 function close(){document.removeEventListener('paste',paste,true);document.removeEventListener('keydown',key,true);overlay.remove()}
 async function receive(file){if(!file||busy)return;const isImage=/^image\//.test(file.type),isPdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name||'');if(!isImage&&!(opts.pdf&&isPdf)){status.textContent='Bitte ein Bild'+(opts.pdf?' oder PDF':'')+' verwenden.';return}busy=true;status.textContent='Datei wird verarbeitet ...';try{await opts.onFile(file);close()}catch(e){status.textContent='Fehler: '+(e?.message||e);busy=false}}
 function paste(e){if(!overlay.isConnected)return;const items=Array.from(e.clipboardData?.items||[]);const images=items.filter(i=>i.kind==='file'&&(/^image\//.test(i.type)||(opts.pdf&&i.type==='application/pdf')));if(!images.length)return;e.preventDefault();e.stopPropagation();const item=images[0],file=item.getAsFile();if(file)receive(new File([file],`Zwischenablage_${Date.now()}.${file.type==='application/pdf'?'pdf':'png'}`,{type:file.type||'image/png'}));if(images.length>1)status.textContent='Die erste Datei wird eingefuegt. Weitere Dateien bitte einzeln einfuegen.'}
 function key(e){if(e.key==='Escape'){e.preventDefault();close()}}
 overlay.querySelector('[data-cancel]').onclick=close;
 overlay.querySelector('[data-select]').onclick=()=>input.click();
 input.onchange=()=>{if(input.files?.[0])receive(input.files[0])};
 overlay.addEventListener('dragover',e=>{e.preventDefault();drop.style.borderColor='#1684d8'});
 overlay.addEventListener('dragleave',()=>{drop.style.borderColor='#888'});
 overlay.addEventListener('drop',e=>{e.preventDefault();if(e.dataTransfer?.files?.[0])receive(e.dataTransfer.files[0])});
 document.addEventListener('paste',paste,true);document.addEventListener('keydown',key,true);
 document.body.append(overlay);
}
