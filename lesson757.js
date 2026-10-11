'use strict';
// v7.5.7: Unterrichtsunterlagen im Klassenbild und als echte PDF-Seiten.
(function(){
 const esc=s=>typeof mediaText==='function'?mediaText(String(s??'')):String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const getLinks=id=>(state.unitLinks?.[id]||[]).map((link,index)=>({link,index,doc:state.library?.find(d=>d.id===link.docId)}));
 const isPdf=d=>!!d&&(/\.pdf$/i.test(d.name||'')||/pdf/i.test(d.mime||''));
 function renderMaterials(cid,unitId){
  const unit=state.units.find(u=>u.id===unitId&&u.classId===cid);
  const section=document.querySelector('#view .section-card');if(!section||!unit)return;
  const previous=document.getElementById('lesson757materials');if(previous)previous.remove();
  const box=document.createElement('div');box.id='lesson757materials';box.className='lesson757-materials';
  const links=getLinks(unit.id);
  box.innerHTML=`<div class="lesson757-heading"><strong>Unterrichtsunterlagen</strong><button class="btn secondary" id="lesson757add">Unterlagen bearbeiten</button></div>${links.length?links.map(({link,index,doc})=>`<div class="lesson757-file"><div><b>${esc(doc?.name||'Datei nicht gefunden')}</b><div class="small">${isPdf(doc)?'Seiten: '+esc(link.pages||'gesamtes PDF'):'Foto / Dokument'}${link.notes?' · '+esc(link.notes):''}</div></div><button class="btn secondary" data-lesson757-open="${index}" ${!doc?'disabled':''}>${isPdf(doc)?'Seiten ansehen':'Öffnen'}</button></div>`).join(''):'<div class="small">Noch keine Unterlagen zugeordnet.</div>'}`;
  section.append(box);
  box.querySelector('#lesson757add').onclick=()=>mediaUnitDialog(cid,unit.id);
  box.querySelectorAll('[data-lesson757-open]').forEach(b=>b.onclick=()=>{const entry=links[Number(b.dataset.lesson757Open)];if(!entry?.doc)return;if(isPdf(entry.doc))openLessonPdf(unit.id,entry.link.docId);else openLibraryFile(entry.doc)});
 }
 const base=renderClass;
 renderClass=function(cid,unitId){base(cid,unitId);const u=state.units.find(x=>x.id===unitId&&x.classId===cid)||currentUnit(cid);if(u)renderMaterials(cid,u.id)};
 const pageKey=(unit,doc,page)=>`${unit}::${doc}::${page}`;
 const getAnnotation=(unit,doc,page)=>{state.lessonPageNotes757 ||= {};return state.lessonPageNotes757[pageKey(unit,doc,page)]||{text:'',strokes:[]}};
 let session=0;
 async function openLessonPdf(unitId,docId){
  const run=++session;const unit=state.units.find(u=>u.id===unitId),doc=state.library?.find(d=>d.id===docId);if(!unit||!doc)return;
  const links=(state.unitLinks?.[unitId]||[]).filter(l=>l.docId===docId);
  const pages=[...new Set(links.flatMap(l=>p756Parse(l.pages||'')))].sort((a,b)=>a-b);
  openModal(`<h2>Unterricht · ${esc(unit.topic)}</h2><p><b>${esc(doc.name)}</b> · ${pages.length?'Seiten '+esc(p756Compress(pages)):'gesamtes PDF'}</p><div class="lesson757-nav"><label for="lesson757page">Seite</label><select id="lesson757page"></select><button class="btn secondary" id="lesson757prev">← Zurück</button><button class="btn secondary" id="lesson757next">Weiter →</button><button class="btn secondary" id="lesson757original">Original öffnen</button></div><div id="lesson757status" class="small" role="status">PDF wird von OneDrive geladen …</div><div class="lesson757-paper" id="lesson757paper"><canvas id="lesson757canvas"></canvas><canvas id="lesson757ink"></canvas></div><div class="lesson757-tools"><label><input id="lesson757draw" type="checkbox"> Auf Seite zeichnen</label><button class="btn secondary" id="lesson757undo">Letzten Strich zurück</button><button class="btn secondary" id="lesson757clear">Zeichnung löschen</button></div><div class="field"><label for="lesson757note">Notiz zu dieser Seite</label><textarea id="lesson757note" rows="3" placeholder="Erklärung, Beobachtung oder Hinweis"></textarea></div><div class="modal-actions"><button class="btn" id="lesson757save">Notiz und Zeichnung speichern</button><button class="btn secondary" id="lesson757back">Zur Materialübersicht</button></div>`);
  const root=modal,el=id=>root.querySelector('#'+id),status=el('lesson757status'),select=el('lesson757page');
  el('lesson757original').onclick=()=>openLibraryFile(doc);
  el('lesson757back').onclick=()=>mediaUnitDialog(unit.classId,unit.id);
  let pdf=null,shown=[],pos=0,strokes=[],drawing=null,scale=1;
  const ink=el('lesson757ink'),ctx=ink.getContext('2d');
  function paintInk(){ctx.clearRect(0,0,ink.width,ink.height);ctx.strokeStyle='#d62728';ctx.lineWidth=2.6;ctx.lineCap='round';ctx.lineJoin='round';for(const stroke of strokes){if(!stroke.length)continue;ctx.beginPath();stroke.forEach(([x,y],i)=>i?ctx.lineTo(x*ink.width,y*ink.height):ctx.moveTo(x*ink.width,y*ink.height));if(stroke.length===1)ctx.lineTo(stroke[0][0]*ink.width+0.1,stroke[0][1]*ink.height+0.1);ctx.stroke()}}
  function save(){if(!shown.length)return;const page=shown[pos],key=pageKey(unitId,docId,page);state.lessonPageNotes757||={};state.lessonPageNotes757[key]={text:el('lesson757note').value,strokes:strokes.map(s=>s.map(p=>[...p]))};saveState();status.textContent=`Seite ${page}: Notizen gespeichert.`}
  async function show(index,store=true){if(store&&shown.length)save();pos=Math.max(0,Math.min(index,shown.length-1));const pageNo=shown[pos];select.value=String(pageNo);el('lesson757prev').disabled=pos===0;el('lesson757next').disabled=pos===shown.length-1;
   const annotation=getAnnotation(unitId,docId,pageNo);el('lesson757note').value=annotation.text||'';strokes=Array.isArray(annotation.strokes)?annotation.strokes.map(s=>s.map(p=>[...p])):[];
   status.textContent=`Seite ${pageNo} von ${pdf.numPages} · ${pos+1}/${shown.length} ausgewählte Seiten`;
   const page=await pdf.getPage(pageNo);if(run!==session||!root.open)return;
   const viewport=page.getViewport({scale:1});scale=Math.min(1.6,Math.max(0.45,Math.min((root.clientWidth-90)/viewport.width,1.25)));const vp=page.getViewport({scale});const canvas=el('lesson757canvas');canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);ink.width=canvas.width;ink.height=canvas.height;el('lesson757paper').style.width=canvas.width+'px';el('lesson757paper').style.height=canvas.height+'px';await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;if(run===session)paintInk();
  }
  ink.addEventListener('pointerdown',e=>{if(!el('lesson757draw').checked||!shown.length)return;e.preventDefault();ink.setPointerCapture(e.pointerId);drawing=[];strokes.push(drawing);const r=ink.getBoundingClientRect();drawing.push([(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height]);paintInk()});
  ink.addEventListener('pointermove',e=>{if(!drawing)return;const r=ink.getBoundingClientRect();drawing.push([Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))]);paintInk()});
  ink.addEventListener('pointerup',()=>{drawing=null});ink.addEventListener('pointercancel',()=>{drawing=null});
  el('lesson757draw').onchange=e=>ink.classList.toggle('lesson757-drawing',e.target.checked);
  el('lesson757undo').onclick=()=>{strokes.pop();paintInk()};
  el('lesson757clear').onclick=()=>{if(confirm('Zeichnung auf dieser Seite löschen?')){strokes=[];paintInk()}};
  el('lesson757save').onclick=save;
  el('lesson757prev').onclick=()=>show(pos-1);
  el('lesson757next').onclick=()=>show(pos+1);
  select.onchange=()=>show(shown.indexOf(Number(select.value)));
  try{pdf=await p756GetPdf(doc);if(run!==session||!modal.open)return;shown=pages.length?pages.filter(p=>p>=1&&p<=pdf.numPages):Array.from({length:pdf.numPages},(_,i)=>i+1);if(!shown.length){status.textContent='Keine gültigen Seiten für dieses PDF ausgewählt.';return}select.innerHTML=shown.map(n=>`<option value="${n}">Seite ${n}</option>`).join('');await show(0,false)}catch(e){if(run===session){status.textContent='PDF-Vorschau konnte nicht geladen werden: '+e.message+' Du kannst das Original weiterhin öffnen.';el('lesson757original').disabled=false}}
 }
 window.lesson757Open=openLessonPdf;
})();
