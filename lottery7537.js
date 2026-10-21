'use strict';
/* Unit-scoped classroom lottery. Data lives on the unit and participates in the existing three-way sync. */
(function(){
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const id=()=>('draw-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,11));
 const pick=a=>a[Math.floor(Math.random()*a.length)];
 const byId=x=>document.getElementById(x);
 function open(){
  if(typeof state==='undefined'||!state||typeof route==='undefined'||route.type!=='group'){alert('Bitte zuerst eine Gruppe und Unterrichtseinheit öffnen.');return}
  const unit=state.units.find(u=>u.id===(route.unitId||byId('unitSelect')?.value));
  if(!unit){alert('Bitte eine Unterrichtseinheit auswählen.');return}
  const c=state.classes.find(x=>x.id===unit.classId),g=c?.groups.find(x=>x.id===unit.groupId);
  const students=state.students.filter(s=>s.classId===unit.classId&&s.groupId===unit.groupId);
  unit.lottery=unit.lottery||{topics:[],materials:[],history:[]};
  const lot=unit.lottery;lot.topics=lot.topics||[];lot.materials=lot.materials||[];lot.history=lot.history||[];
  let busy=false;
  function save(){saveState()}
  function render(){
   openModal(`<div style="max-width:850px"><h2>🎲 Zufall · ${esc(c?.code)} / ${esc(g?.name)}</h2><p class="small">${esc(unit.date)} · ${esc(unit.topic)} · Auslosungen werden bei dieser Einheit dokumentiert.</p>
    <div class="form-grid"><div class="field"><label>Auslosung</label><select id="lotKind"><option value="student">Schüler</option><option value="topic">Schlagwort</option><option value="material">Bild / PDF</option></select></div><div class="field"><label>Wiederholungssperre</label><select id="lotNoRepeat"><option value="yes">Bis alle einmal dran waren</option><option value="no">Alle zulassen</option></select></div></div>
    <div id="lotStage" class="section-card" style="min-height:160px;text-align:center;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px" aria-live="polite"><h2>Bereit zur Auslosung</h2></div>
    <div class="modal-actions"><button class="btn" id="lotStart">🎲 Auslösen</button><button class="btn secondary" id="lotReset">Sperre zurücksetzen</button></div>
    <details><summary><b>Themen und Materialien dieser Einheit</b></summary><div class="field"><label>Schlagworte (eine Zeile pro Thema)</label><textarea id="lotTopics" rows="4">${esc(lot.topics.map(t=>t.text).join('\n'))}</textarea><button class="btn secondary" id="lotSaveTopics">Schlagworte speichern</button></div><div class="field"><label>Screenshot, Bild oder PDF (max. 1 MB je Datei)</label><input id="lotFiles" type="file" accept="image/*,application/pdf" multiple></div><div id="lotMaterials">${lot.materials.map(m=>`<div class="small">${esc(m.name)} <button class="btn secondary" data-lot-open="${esc(m.id)}">Öffnen</button> <button class="btn secondary" data-lot-remove="${esc(m.id)}">Entfernen</button></div>`).join('')}</div><p class="small">Dateien werden derzeit zusammen mit den Unterrichtsdaten synchronisiert. Große PDFs bitte vor dem Import auf die benötigte Seite reduzieren.</p></details>
    <h3>Dokumentation (${lot.history.length})</h3><div class="table-wrap"><table><thead><tr><th>Zeit</th><th>Auswahl</th><th>Status</th><th>Bemerkung / Punkte</th></tr></thead><tbody>${[...lot.history].reverse().map(h=>`<tr><td>${esc(new Date(h.at).toLocaleString('de-AT'))}</td><td>${esc(h.label)}<div class="small">${esc(h.kind)}</div></td><td><select data-lot-status="${esc(h.id)}">${['Ausgelost','Vorgetragen','Nicht vorgetragen','Entschuldigt','Übersprungen'].map(v=>`<option ${h.status===v?'selected':''}>${v}</option>`).join('')}</select></td><td><input placeholder="Bemerkung" data-lot-note="${esc(h.id)}" value="${esc(h.note||'')}"><input type="number" step="0.5" min="0" placeholder="Punkte (optional)" style="width:95px" data-lot-points="${esc(h.id)}" value="${h.points??''}"></td></tr>`).join('')}</tbody></table></div>
    <div class="modal-actions"><button class="btn secondary" id="lotExport">CSV exportieren</button><button class="btn secondary" id="lotClose">Schließen</button></div></div>`);
   byId('lotClose').onclick=()=>closeModal();byId('lotStart').onclick=draw;
   byId('lotReset').onclick=()=>{if(confirm('Wiederholungssperre für diese Einheit zurücksetzen? Die Dokumentation bleibt erhalten.')){lot.resetAt=new Date().toISOString();save();render()}};
   byId('lotSaveTopics').onclick=()=>{const old=new Map(lot.topics.map(t=>[t.text,t]));lot.topics=[...new Set(byId('lotTopics').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean))].map(t=>old.get(t)||{id:id(),text:t});save();render()};
   byId('lotFiles').onchange=async e=>{const files=[...e.target.files];for(const file of files){if(file.size>1024*1024){alert(file.name+': maximal 1 MB je Datei.');continue}if(!file.type.startsWith('image/')&&file.type!=='application/pdf'){alert('Nur Bilder und PDFs erlaubt.');continue}const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});lot.materials.push({id:id(),name:file.name,mime:file.type,data})}save();render()};
   document.querySelectorAll('[data-lot-open]').forEach(b=>b.onclick=()=>{const m=lot.materials.find(x=>x.id===b.dataset.lotOpen);if(m){const a=document.createElement('a');a.href=m.data;a.target='_blank';a.rel='noopener';a.download=m.name;a.click()}});
   document.querySelectorAll('[data-lot-remove]').forEach(b=>b.onclick=()=>{if(!confirm('Material aus dieser Einheit entfernen?'))return;lot.materials=lot.materials.filter(m=>m.id!==b.dataset.lotRemove);save();render()});
   document.querySelectorAll('[data-lot-status]').forEach(e=>e.onchange=()=>{const h=lot.history.find(x=>x.id===e.dataset.lotStatus);if(h){h.status=e.value;h.updatedAt=new Date().toISOString();save()}});
   document.querySelectorAll('[data-lot-note]').forEach(e=>e.onchange=()=>{const h=lot.history.find(x=>x.id===e.dataset.lotNote);if(h){h.note=e.value;h.updatedAt=new Date().toISOString();save()}});
   document.querySelectorAll('[data-lot-points]').forEach(e=>e.onchange=()=>{const h=lot.history.find(x=>x.id===e.dataset.lotPoints);if(h){h.points=e.value===''?null:Number(e.value);h.updatedAt=new Date().toISOString();save()}});
   byId('lotExport').onclick=()=>{const rows=[['Zeit','Klasse','Gruppe','Einheit','Typ','Auswahl','Status','Punkte','Bemerkung'],...lot.history.map(h=>[h.at,c?.code,g?.name,unit.topic,h.kind,h.label,h.status,h.points??'',h.note||''])];const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='Auslosungen_'+unit.date+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000)};
  }
  function draw(){if(busy)return;const kind=byId('lotKind').value,noRepeat=byId('lotNoRepeat').value==='yes';let pool=[];
   if(kind==='student')pool=students.map(s=>({id:s.id,label:s.name,photo:s.photo||''}));
   if(kind==='topic')pool=lot.topics.map(t=>({id:t.id,label:t.text}));
   if(kind==='material')pool=lot.materials.map(m=>({id:m.id,label:m.name,material:m}));
   if(!pool.length){alert('Für diese Auswahl sind noch keine Einträge vorhanden.');return}
   if(noRepeat){const used=new Set(lot.history.filter(h=>h.kind===kind&&(!lot.resetAt||h.at>lot.resetAt)).map(h=>h.targetId));const remaining=pool.filter(p=>!used.has(p.id));if(remaining.length)pool=remaining;else{alert('Alle wurden bereits ausgelost. Bitte Sperre zurücksetzen oder deaktivieren.');return}}
   busy=true;const stage=byId('lotStage'),button=byId('lotStart');button.disabled=true;const result=pick(pool);let elapsed=0,step=0;
   function frame(){const preview=pick(pool);stage.innerHTML=preview.photo?`<img alt="Schülerfoto" src="${preview.photo}" style="max-height:140px;max-width:180px;border-radius:12px">`:`<h2>${esc(preview.label)}</h2>`;step++;const delay=Math.min(620,65+step*step*7);elapsed+=delay;if(elapsed<4200){setTimeout(frame,delay);return}
    stage.innerHTML=result.photo?`<img alt="Ausgelostes Schülerfoto" src="${result.photo}" style="max-height:170px;max-width:200px;border-radius:12px"><p>Ausgewählt …</p>`:'<h2>Ausgewählt …</h2>';
    setTimeout(()=>{stage.innerHTML=(result.photo?`<img alt="Schülerfoto" src="${result.photo}" style="max-height:170px;max-width:200px;border-radius:12px">`:'')+`<h2>${esc(result.label)}</h2>`+(result.material?`<p>Material über die Liste unten öffnen</p>`:'');
     lot.history.push({id:id(),at:new Date().toISOString(),kind,targetId:result.id,label:result.label,status:'Ausgelost',note:'',points:null});save();busy=false;button.disabled=false;
     const h=lot.history[lot.history.length-1];const action=document.createElement('div');action.className='modal-actions';action.innerHTML='<button class="btn secondary" data-status="Vorgetragen">Vorgetragen</button><button class="btn secondary" data-status="Übersprungen">Übersprungen</button><button class="btn secondary" id="lotHistoryRefresh">Dokumentation anzeigen</button>';stage.appendChild(action);action.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>{h.status=b.dataset.status;save();render()});byId('lotHistoryRefresh').onclick=render;
    },850);
   }frame();
  }
  render();
 }
 function attach(){const select=document.getElementById('unitSelect');if(!select||document.getElementById('lotteryUnitBtn'))return;const b=document.createElement('button');b.id='lotteryUnitBtn';b.className='btn secondary';b.textContent='🎲 Zufall / Wiederholung';b.onclick=open;select.parentElement?.appendChild(b)}
 const observer=new MutationObserver(()=>{if(document.getElementById('unitSelect')&&!document.getElementById('lotteryUnitBtn'))attach()});document.addEventListener('DOMContentLoaded',()=>{observer.observe(document.body,{subtree:true,childList:true});attach()});
})();
