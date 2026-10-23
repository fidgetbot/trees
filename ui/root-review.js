// Explicit review-only controls. Loaded only with ?review=1; never changes
// ordinary game rules or the default Seed opening.
export function mountRootReview({species,stages,apply,advance,grant,read}) {
 const style=document.createElement('style');
 style.textContent=`.root-review-toggle{position:fixed;right:12px;top:128px;z-index:45;font:12px system-ui;border:1px solid #91836c;border-radius:16px;padding:7px 11px;background:#fff9e9;color:#403527}.root-review{position:fixed;right:12px;top:167px;z-index:46;box-sizing:border-box;width:min(340px,calc(100vw - 24px));max-height:65vh;overflow:auto;padding:16px;border:1px solid #91836c;border-radius:16px;background:#fff9e9;color:#403527;font:14px/1.4 system-ui;box-shadow:0 4px 24px #0004}.root-review[hidden]{display:none}.root-review label{display:block;margin:9px 0}.root-review select,.root-review input{display:block;width:100%;box-sizing:border-box;padding:6px}.root-review button{padding:9px;margin:5px 4px 0 0}.root-review small{display:block}.root-review h3{margin:0 0 6px}`;
 document.head.append(style);
 const toggle=document.createElement('button');toggle.className='root-review-toggle';toggle.id='root-review-toggle';toggle.textContent='Root review · controls';toggle.setAttribute('aria-expanded','false');
 const panel=document.createElement('section');panel.className='root-review';panel.id='root-review';panel.hidden=true;panel.setAttribute('aria-label','Root integration review controls');
 panel.innerHTML=`<h3>Playable root review</h3><small>Separate test build. Production is unchanged. Load a specimen, then use the normal game actions.</small><label>Species<select id="review-species">${species.map(s=>`<option>${s}</option>`).join('')}</select></label><label>Stage<select id="review-stage">${stages.map(s=>`<option value="${s.rank}">${s.name}</option>`).join('')}</select></label><label>Season<select id="review-season"><option value="0">Spring</option><option value="1">Summer</option><option value="2">Autumn</option><option value="3">Winter</option></select></label><label>Root investments<input id="review-roots" type="number" min="0" max="120" value="8"></label><label>Deepen investments<input id="review-depth" type="number" min="0" max="100" value="2"></label><button id="review-load">Load specimen</button><button id="review-advance">Meet requirements &amp; age up</button><button id="review-grant">Refill resources</button><small>Age up supplies the current milestone requirements and runs the real stage transition. It preserves existing root investments.</small>`;
 document.body.append(toggle,panel);
 const close=()=>{panel.hidden=true;toggle.setAttribute('aria-expanded','false')};
 toggle.onclick=()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));};
 panel.querySelector('#review-species').value='Cherry';panel.querySelector('#review-stage').value='3';
 panel.querySelector('#review-load').onclick=()=>{
  const value=id=>panel.querySelector('#review-'+id).value;
  apply({species:value('species'),rank:Number(value('stage')),season:Number(value('season')),roots:Math.max(0,Math.min(120,Number(value('roots'))||0)),depth:Math.max(0,Math.min(100,Number(value('depth'))||0))});close();
 };
 panel.querySelector('#review-advance').onclick=()=>{if(!read().started)return;close();advance();};
 panel.querySelector('#review-grant').onclick=()=>{grant();close();};
}
