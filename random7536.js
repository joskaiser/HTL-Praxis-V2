
'use strict';
(function(){
function sample(list,n){const copy=[...list];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy.slice(0,n)}
function safe(t){return String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function openPicker(){
 if(typeof state==='undefined'||!state){alert('Daten werden noch geladen.');return}
 const modal=document.getElementById('modal');if(!modal)return;
 const classes=state.classes||[];
 openModal(`<div style="max-width:620px"><h2>Zufallsgenerator</h2><p>Schüler, Gruppen oder Unterrichtsthemen zufällig auswählen. Es werden keine Daten verändert.</p><div class="form-grid"><div class="field"><label>Auswahl</label><select id="randKind"><option value="students">Schüler:innen</option><option value="groups">Gruppen</option><option value="topics">Unterrichtsthemen</option></select></div><div class="field"><label>Klasse</label><select id="randClass"><option value="">Alle Klassen</option>${classes.map(c=>`<option value="${safe(c.id)}">${safe(c.code||c.name||'Klasse')}</option>`).join('')}</select></div><div class="field"><label>Anzahl</label><input id="randCount" type="number" min="1" max="100" value="1"></div></div><div id="randResult" class="section-card" aria-live="polite">Bereit zur Auslosung.</div><div class="modal-actions"><button class="btn secondary" id="randClose">Schließen</button><button class="btn" id="randGo">Auslosen</button></div></div>`);
 document.getElementById('randClose').onclick=()=>modal.close();
 document.getElementById('randGo').onclick=()=>{const kind=document.getElementById('randKind').value,cid=document.getElementById('randClass').value,count=Math.max(1,Math.min(100,Number(document.getElementById('randCount').value)||1));let pool=[];
 if(kind==='students')pool=(state.students||[]).filter(s=>!cid||s.classId===cid).map(s=>s.name||[s.firstName,s.lastName].filter(Boolean).join(' '));
 else if(kind==='groups')pool=classes.filter(c=>!cid||c.id===cid).flatMap(c=>(c.groups||[]).map(g=>(c.code||'Klasse')+' – '+(g.name||g.label||'Gruppe')));
 else pool=(state.units||[]).filter(u=>!cid||u.classId===cid).map(u=>u.topic).filter(Boolean);
 pool=[...new Set(pool.filter(Boolean))];const picked=sample(pool,count);document.getElementById('randResult').innerHTML=picked.length?'<b>Ergebnis:</b><ol>'+picked.map(v=>'<li>'+safe(v)+'</li>').join('')+'</ol>':'Keine passenden Einträge vorhanden.';
 };
}
document.addEventListener('DOMContentLoaded',()=>{const host=document.querySelector('.top-actions');if(!host)return;const b=document.createElement('button');b.type='button';b.className='btn secondary';b.textContent='Zufall';b.title='Schüler, Gruppen oder Themen auslosen';b.onclick=openPicker;host.insertBefore(b,host.querySelector('#btnSettings'))});
})();
