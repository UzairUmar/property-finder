import fs from "node:fs";
import path from "node:path";
import { RESULTS_DIR } from "./config.js";
import type { SearchConfig, StoredListing } from "./types.js";

export interface DashboardSection {
  search: SearchConfig;
  listings: StoredListing[];
  newIds: number[];
}

const CSS = `
:root{--bg:#f6f7f9;--card:#fff;--ink:#1a1d23;--muted:#6b7280;--line:#e5e7eb;--accent:#2563eb;--strong:#15803d;--strong-bg:#dcfce7;--maybe:#a16207;--maybe-bg:#fef9c3;--skip:#b91c1c;--skip-bg:#fee2e2;--new:#7c3aed;--new-bg:#ede9fe}
*{box-sizing:border-box}body{margin:0;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:var(--ink);background:var(--bg)}
header{background:var(--card);border-bottom:1px solid var(--line);padding:14px 20px;display:flex;flex-wrap:wrap;gap:12px 24px;align-items:center;position:sticky;top:0;z-index:5}
h1{font-size:18px;margin:0}.meta{color:var(--muted);font-size:12px}
.tabs{display:flex;gap:4px}.tab{border:1px solid var(--line);background:var(--card);padding:6px 14px;border-radius:999px;cursor:pointer;font-weight:600}.tab.on{background:var(--accent);color:#fff;border-color:var(--accent)}
.filters{display:flex;flex-wrap:wrap;gap:8px;padding:12px 20px;align-items:center}
.filters input,.filters select{padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--card);font:inherit}
.filters input[type=number]{width:110px}.filters select{max-width:220px}.filters label{display:flex;align-items:center;gap:4px;color:var(--muted)}
.count{margin-left:auto;color:var(--muted)}
main{padding:0 20px 40px;overflow-x:auto}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:8px}
th,td{padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left}
th{position:sticky;top:0;background:#f9fafb;font-size:12px;color:var(--muted);cursor:pointer;user-select:none;white-space:nowrap}
th.sorted::after{content:" ▾";color:var(--accent)}th.sorted.asc::after{content:" ▴"}
tr.row{cursor:pointer}tr.row:hover{background:#f3f4f6}
.thumb{width:96px;height:64px;object-fit:cover;border-radius:4px;background:#e5e7eb;display:block}
.title{font-weight:600}.title a{color:var(--ink);text-decoration:none}.title a:hover{color:var(--accent)}
.addr,.reason,.sub{color:var(--muted);font-size:12px}.reason{margin-top:4px;color:var(--ink)}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}
.b-strong{background:var(--strong-bg);color:var(--strong)}.b-maybe{background:var(--maybe-bg);color:var(--maybe)}.b-skip{background:var(--skip-bg);color:var(--skip)}.b-none{background:#f3f4f6;color:var(--muted)}
.b-new{background:var(--new-bg);color:var(--new);margin-left:6px}
.price{font-weight:600;white-space:nowrap}.price .sub{display:block;font-weight:400}.drop{color:var(--strong);font-size:12px;display:block}
.num{white-space:nowrap}.empty{padding:40px;text-align:center;color:var(--muted)}
@media(max-width:700px){.thumb{width:64px;height:44px}th:nth-child(7),td:nth-child(7),th:nth-child(9),td:nth-child(9){display:none}}
`;

const JS = `
const DATA=JSON.parse(document.getElementById('data').textContent);
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let cur=DATA.sections[0].search.id,sortKey='score',sortDir=-1;
const state=()=>DATA.sections.find(s=>s.search.id===cur);
function fillSelect(id,values){const el=$(id);const keep=el.value;el.innerHTML='<option value="">'+el.dataset.label+'</option>'+values.map(v=>'<option>'+esc(v)+'</option>').join('');el.value=keep;}
function refreshSelects(){const L=state().listings;fillSelect('#type',[...new Set(L.map(l=>l.propertyType).filter(Boolean))].sort());fillSelect('#area',[...new Set(L.map(l=>l.area).filter(Boolean))].sort());}
function score(l){return l.analysis?l.analysis.score:-1}
function getVal(l,k){switch(k){case 'score':return score(l);case 'price':return l.price;case 'sqft':return l.sqft??-1;case 'psf':return l.psf??-1;case 'listed':return l.listedAt??'';case 'title':return l.title.toLowerCase();case 'type':return l.propertyType;default:return ''}}
function filtered(){const s=state();const newSet=new Set(s.newIds);const q=$('#q').value.trim().toLowerCase();const min=+$('#min').value||0,max=+$('#max').value||Infinity,minSq=+$('#minsq').value||0;const type=$('#type').value,area=$('#area').value,verdict=$('#verdict').value;const onlyNew=$('#new').checked,onlyDrop=$('#drop').checked;
return s.listings.filter(l=>{if(q&&!(l.title+' '+l.address+' '+l.area+' '+(l.mrt||'')).toLowerCase().includes(q))return false;if(l.price<min||l.price>max)return false;if((l.sqft??0)<minSq)return false;if(type&&l.propertyType!==type)return false;if(area&&l.area!==area)return false;if(verdict==='none'?l.analysis:verdict&&l.analysis?.verdict!==verdict)return false;if(onlyNew&&!newSet.has(l.id))return false;if(onlyDrop&&!(l.priceChanges.length>1&&l.priceChanges.at(-1).price<l.priceChanges[0].price))return false;return true;});}
function render(){const s=state();const newSet=new Set(s.newIds);const rows=filtered().sort((a,b)=>{const va=getVal(a,sortKey),vb=getVal(b,sortKey);if(va<vb)return -sortDir;if(va>vb)return sortDir;return (b.listedAt||'').localeCompare(a.listedAt||'')});
$('#count').textContent=rows.length+' of '+s.listings.length+' listings';document.querySelectorAll('th[data-k]').forEach(th=>{th.classList.toggle('sorted',th.dataset.k===sortKey);th.classList.toggle('asc',th.dataset.k===sortKey&&sortDir===1)});
$('#body').innerHTML=rows.length?rows.map((l,idx)=>{const a=l.analysis;const badge=a?'<span class="badge b-'+a.verdict+'">'+a.score+'/10 '+a.verdict+'</span>':'<span class="badge b-none">unscored</span>';const isNew=newSet.has(l.id)?'<span class="badge b-new">new</span>':'';const first=l.priceChanges[0]?.price;const drop=l.priceChanges.length>1&&first!==l.price?'<span class="drop">was S$'+first.toLocaleString()+'</span>':'';const mrt=l.mrt?esc(l.mrt.replace(' from ',' · ')):'—';const listed=esc(l.listedText.replace('Listed on ',''));
return '<tr class="row" data-url="'+esc(l.url)+'"><td>'+(l.thumbnail?'<img class="thumb" loading="'+(idx<20?'eager':'lazy')+'" src="'+esc(l.thumbnail)+'" alt="">':'<div class="thumb"></div>')+'</td><td>'+badge+isNew+(a?'<div class="reason">'+esc(a.reason)+'</div>':'')+'</td><td><div class="title"><a href="'+esc(l.url)+'" target="_blank" rel="noopener">'+esc(l.title)+'</a></div><div class="addr">'+esc(l.address)+'</div><div class="sub">'+esc(l.area)+'</div></td><td class="price">'+esc(l.priceText)+drop+(l.psf?'<span class="sub">S$'+l.psf+' psf</span>':'')+'</td><td class="num">'+(l.roomType?esc(l.roomType)+'<br><span class="sub">'+esc(l.tenants||'')+'</span>':(l.beds??'?')+'bd / '+(l.baths??'?')+'ba<br><span class="sub">'+(l.sqft?l.sqft.toLocaleString()+' sqft':'?')+'</span>')+'</td><td>'+esc(l.propertyType)+'</td><td>'+mrt+'</td><td class="num">'+listed+'</td><td class="sub">'+esc(l.agentName||'')+'<br>'+esc(l.agencyName||'')+'</td></tr>'}).join(''):'<tr><td colspan="9" class="empty">No listings match.</td></tr>';}
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{cur=t.dataset.id;document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x===t));refreshSelects();render()});
document.querySelectorAll('th[data-k]').forEach(th=>th.onclick=()=>{const k=th.dataset.k;if(sortKey===k)sortDir=-sortDir;else{sortKey=k;sortDir=k==='title'||k==='type'?1:-1}render()});
document.querySelectorAll('.filters input,.filters select').forEach(el=>el.addEventListener('input',render));
$('#body').addEventListener('click',e=>{if(e.target.closest('a'))return;const tr=e.target.closest('tr.row');if(tr)window.open(tr.dataset.url,'_blank','noopener')});
refreshSelects();render();
`;

export function writeDashboard(sections: DashboardSection[]) {
  const generatedAt = new Date().toISOString();
  const payload = JSON.stringify({ generatedAt, sections }).replace(/<\//g, "<\\/");
  const tabs = sections
    .map((s, i) => `<button class="tab${i === 0 ? " on" : ""}" data-id="${s.search.id}">${s.search.label} (${s.listings.length})</button>`)
    .join("");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Property Finder</title><style>${CSS}</style></head>
<body>
<header><h1>Property Finder</h1><div class="tabs">${tabs}</div><div class="meta">Generated ${generatedAt.replace("T", " ").slice(0, 16)} UTC · click a row to open on PropertyGuru</div></header>
<div class="filters">
  <input id="q" type="search" placeholder="Search title, address, MRT…" size="28">
  <input id="min" type="number" placeholder="Min S$/mo" step="100">
  <input id="max" type="number" placeholder="Max S$/mo" step="100">
  <input id="minsq" type="number" placeholder="Min sqft" step="50">
  <select id="type" data-label="Any type"></select>
  <select id="area" data-label="Any area"></select>
  <select id="verdict"><option value="">Any verdict</option><option value="strong">Strong</option><option value="maybe">Maybe</option><option value="skip">Skip</option><option value="none">Unscored</option></select>
  <label><input id="new" type="checkbox"> New this run</label>
  <label><input id="drop" type="checkbox"> Price drops</label>
  <span id="count" class="count"></span>
</div>
<main><table>
<thead><tr><th></th><th data-k="score">Score</th><th data-k="title">Listing</th><th data-k="price">Price</th><th data-k="sqft">Size</th><th data-k="type">Type</th><th>MRT</th><th data-k="listed">Listed</th><th>Agent</th></tr></thead>
<tbody id="body"></tbody>
</table></main>
<script id="data" type="application/json">${payload}</script>
<script>${JS}</script>
</body></html>`;
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(RESULTS_DIR, "dashboard.html"), html);
}
