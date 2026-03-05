// ── Tab switching ──────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.container').forEach(c => {
      c.classList.remove('active');
      c.style.display = ''; // clear any inline styles
    });
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ── Score weights (in-memory) ──────────────────────────────────
let scoreWeights = { title:20, desc:20, h1:20, alt:20, canonical:20 };
let storedPage = null;
let storedUrl  = '';
let currentPageUrl = '';

function calcScore(d) {
  const total = Object.values(scoreWeights).reduce((a,b)=>a+b,0);
  let earned = 0;
  if (d.tLen>=50 && d.tLen<=60)   earned += scoreWeights.title;
  if (d.dLen>=120 && d.dLen<=160) earned += scoreWeights.desc;
  if (d.h.h1===1)                  earned += scoreWeights.h1;
  if (d.mAlt===0)                  earned += scoreWeights.alt;
  if (d.canon!=='Missing')         earned += scoreWeights.canonical;
  return Math.round((earned/total)*100);
}

// ── Readability (Flesch) ───────────────────────────────────────
function fleschScore(text) {
  const sentences = (text.match(/[.!?]+/g)||[]).length || 1;
  const words = text.split(/\s+/).filter(w=>w.length>0);
  const wc = words.length || 1;
  const syllables = words.reduce((sum,word) => {
    word = word.toLowerCase().replace(/[^a-z]/g,'');
    if (!word) return sum;
    const m = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/,'').replace(/^y/,'').match(/[aeiouy]{1,2}/g);
    return sum + (m ? m.length : 1);
  }, 0);
  return Math.min(100, Math.max(0, Math.round(206.835 - 1.015*(wc/sentences) - 84.6*(syllables/wc))));
}
function fleschLabel(s) {
  if (s>=90) return {label:'Very Easy',   color:'var(--green)',  grade:'5th grade'};
  if (s>=70) return {label:'Easy',        color:'var(--green)',  grade:'6th–7th grade'};
  if (s>=60) return {label:'Standard',    color:'var(--yellow)', grade:'8th–9th grade'};
  if (s>=50) return {label:'Fairly Difficult', color:'var(--yellow)', grade:'10th–12th grade'};
  if (s>=30) return {label:'Difficult',   color:'var(--red)',    grade:'College level'};
  return      {label:'Very Difficult',    color:'var(--red)',    grade:'Professional'};
}

// ── Keyword density ────────────────────────────────────────────
function renderKeywords(text) {
  const stop = new Set(['the','and','for','are','but','not','you','all','can','was','one','our','out','had','has','have','this','that','with','they','from','will','been','more','also','into','than','then','them','when','what','your','which','their','would','there','could','about','after','other','some','these','those','just','like','time','very','only','even','most','over','such','well','back','much','many','come','its','his','him','how','now','may','any','two','way','who','use','new','each','need','page','site','web']);
  const words = text.toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).filter(w=>w.length>3 && !stop.has(w));
  const total = words.length || 1;
  const freq = {};
  words.forEach(w => freq[w]=(freq[w]||0)+1);
  const top = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,20);
  const maxC = top[0]?.[1]||1;
  return top.map(([word,count]) => {
    const pct = ((count/total)*100).toFixed(2);
    const bar = Math.round((count/maxC)*100);
    return '<div class="kw-row"><span class="kw-word">'+word+'</span><div class="kw-bar-wrap"><div class="kw-bar-fill" style="width:'+bar+'%"></div></div><span class="kw-count">'+count+'x</span><span class="kw-pct">'+pct+'%</span></div>';
  }).join('');
}

// ── Heading tree ───────────────────────────────────────────────
function renderHeadingTree(hGroup, h) {
  const all = [];
  for (let lvl=1; lvl<=6; lvl++) {
    const key = lvl<=3 ? 'h'+lvl : 'other';
    const raw = hGroup[key]||'';
    raw.split('<br>').map(s=>s.replace(/^\*\s*/,'').trim()).filter(Boolean).forEach(text=>all.push({lvl,text}));
  }
  if (!all.length) return '<div style="color:var(--muted)">No headings found.</div>';
  return all.map(({lvl,text}) =>
    '<div class="h-node" style="padding-left:'+(lvl-1)*16+'px"><span class="h-tag '+(lvl<=3?'h'+lvl+'-tag':'h456-tag')+'">H'+lvl+'</span><span class="h-text">'+text+'</span></div>'
  ).join('');
}

// ── SEO Recommendations ────────────────────────────────────────
function renderTips(d) {
  const recs = [];
  if (d.tLen===0)                  recs.push({t:'error',i:'📝',title:'Missing Meta Title',body:'Add a title tag between 50–60 characters. Critical for SEO.'});
  else if (d.tLen<50)              recs.push({t:'warn', i:'📝',title:'Title Too Short ('+d.tLen+' chars)',body:'Expand to 50–60 chars to maximize CTR in search results.'});
  else if (d.tLen>60)              recs.push({t:'warn', i:'📝',title:'Title Too Long ('+d.tLen+' chars)',body:'May be truncated in Google. Shorten to 50–60 characters.'});
  else                             recs.push({t:'good', i:'✅',title:'Meta Title is Perfect',body:'Your title is '+d.tLen+' characters — in the sweet spot.'});

  if (d.dLen===0)                  recs.push({t:'error',i:'📄',title:'Missing Meta Description',body:'Add one (120–160 chars) to improve click-through rates.'});
  else if (d.dLen<120)             recs.push({t:'warn', i:'📄',title:'Description Too Short ('+d.dLen+' chars)',body:'Expand to 120–160 chars to use full SERP snippet space.'});
  else if (d.dLen>160)             recs.push({t:'warn', i:'📄',title:'Description Too Long ('+d.dLen+' chars)',body:'Will be cut off in Google. Trim to 120–160 chars.'});
  else                             recs.push({t:'good', i:'✅',title:'Meta Description is Perfect',body:d.dLen+' chars — well within the ideal range.'});

  if (d.h.h1===0)                  recs.push({t:'error',i:'🏷️',title:'No H1 Tag Found',body:'Every page needs exactly one H1. It signals the main topic to Google.'});
  else if (d.h.h1>1)               recs.push({t:'warn', i:'🏷️',title:'Multiple H1 Tags ('+d.h.h1+' found)',body:'Keep only one H1. Use H2–H6 for subheadings.'});
  else                             recs.push({t:'good', i:'✅',title:'H1 Tag is Correct',body:'Exactly one H1 found — perfect.'});

  if (d.mAlt>0)                    recs.push({t:'warn', i:'🖼️',title:d.mAlt+' Images Missing Alt Text',body:'Add descriptive alt attributes to improve SEO and accessibility.'});
  else                             recs.push({t:'good', i:'✅',title:'All Images Have Alt Text',body:'Every image has an alt attribute — great for SEO.'});

  if (d.canon==='Missing')         recs.push({t:'warn', i:'🔗',title:'No Canonical Tag',body:'Add a canonical tag to prevent duplicate content issues.'});
  else                             recs.push({t:'good', i:'✅',title:'Canonical Tag Present',body:'Canonical URL is set correctly.'});

  if (d.hreflang.length===0)       recs.push({t:'warn', i:'🌍',title:'No Hreflang Tags',body:'Add hreflang tags if targeting multiple languages or regions.'});

  if (d.ext===0)                   recs.push({t:'warn', i:'🔗',title:'No External Links',body:'Link to high-authority sources to add credibility.'});
  if (d.int<3)                     recs.push({t:'warn', i:'🔗',title:'Few Internal Links ('+d.int+')',body:'Add more internal links to improve crawlability.'});

  if (d.words<300)                 recs.push({t:'warn', i:'📊',title:'Low Word Count ('+d.words+')',body:'Under 300 words may be seen as thin content. Add more value.'});
  else if (d.words>=1000)          recs.push({t:'good', i:'✅',title:'Good Content Length ('+d.words+' words)',body:'Substantial content is a positive SEO signal.'});

  // Duplicate meta checks
  if (d.dupTitle>1)   recs.push({t:'error',i:'🔁',title:'Duplicate Title Tags ('+d.dupTitle+')',body:'Multiple <title> tags found. Only the first is used by Google.'});
  if (d.dupDesc>1)    recs.push({t:'warn', i:'🔁',title:'Duplicate Meta Descriptions',body:'Multiple meta description tags detected. Remove extras.'});
  if (d.dupCanon>1)   recs.push({t:'warn', i:'🔁',title:'Duplicate Canonical Tags',body:'Multiple canonicals confuse crawlers. Keep only one.'});
  if (d.dupOg>1)      recs.push({t:'warn', i:'🔁',title:'Duplicate OG Tags',body:'Multiple og:title or og:description tags detected.'});

  const errors = recs.filter(r=>r.t==='error').length;
  const warns  = recs.filter(r=>r.t==='warn').length;
  const goods  = recs.filter(r=>r.t==='good').length;

  let html = '<div class="card full" style="display:flex;justify-content:space-around;text-align:center;">'
    +'<div><div style="font-size:22px;font-weight:700;font-family:var(--mono);color:var(--red)">'+errors+'</div><small style="color:var(--muted)">CRITICAL</small></div>'
    +'<div><div style="font-size:22px;font-weight:700;font-family:var(--mono);color:var(--yellow)">'+warns+'</div><small style="color:var(--muted)">WARNINGS</small></div>'
    +'<div><div style="font-size:22px;font-weight:700;font-family:var(--mono);color:var(--green)">'+goods+'</div><small style="color:var(--muted)">PASSED</small></div>'
    +'</div>';

  html += recs.map(r =>
    '<div class="rec-item rec-'+r.t+'"><div class="rec-icon">'+r.i+'</div><div><div class="rec-title">'+r.title+'</div><div class="rec-body">'+r.body+'</div></div></div>'
  ).join('');
  return html;
}

// ── PDF Export ─────────────────────────────────────────────────
function exportPDF(d) {
  const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Segoe UI,sans-serif;padding:32px;color:#1a1a2e;max-width:800px;margin:0 auto;}h1{color:#1a237e;border-bottom:3px solid #d4af37;padding-bottom:10px;}h2{color:#1a237e;margin-top:28px;font-size:16px;border-left:4px solid #d4af37;padding-left:10px;}table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px;}th{background:#1a237e;color:white;padding:8px 12px;text-align:left;}td{padding:8px 12px;border-bottom:1px solid #eee;}tr:nth-child(even) td{background:#f9f9f9;}.g{color:#27ae60;font-weight:bold;}.b{color:#e74c3c;font-weight:bold;}.footer{margin-top:40px;text-align:center;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:16px;}</style></head><body>'
    +'<h1>🔍 SEO Audit Report</h1>'
    +'<p><b>URL:</b> '+(d.canon!=='Missing'?d.canon:'N/A')+' &nbsp;|&nbsp; <b>Generated:</b> '+new Date().toLocaleString()+'</p>'
    +'<h2>Health Summary</h2><table><tr><th>Check</th><th>Status</th><th>Value</th></tr>'
    +'<tr><td>Meta Title</td><td class="'+(d.tLen>=50&&d.tLen<=60?'g':'b')+'">'+(d.tLen>=50&&d.tLen<=60?'✅ Good':'⚠️ Review')+'</td><td>'+d.tLen+' chars</td></tr>'
    +'<tr><td>Meta Description</td><td class="'+(d.dLen>=120&&d.dLen<=160?'g':'b')+'">'+(d.dLen>=120&&d.dLen<=160?'✅ Good':'❌ Issue')+'</td><td>'+d.dLen+' chars</td></tr>'
    +'<tr><td>H1 Count</td><td class="'+(d.h.h1===1?'g':'b')+'">'+(d.h.h1===1?'✅ Good':'❌ Issue')+'</td><td>'+d.h.h1+' found</td></tr>'
    +'<tr><td>Missing Alts</td><td class="'+(d.mAlt===0?'g':'b')+'">'+(d.mAlt===0?'✅ Good':'❌ '+d.mAlt+' missing')+'</td><td>'+d.imgCount+' total images</td></tr>'
    +'<tr><td>Canonical</td><td class="'+(d.canon!=='Missing'?'g':'b')+'">'+(d.canon!=='Missing'?'✅ Present':'❌ Missing')+'</td><td>'+d.canon+'</td></tr>'
    +'</table>'
    +'<h2>Meta Info</h2><table><tr><th>Property</th><th>Value</th></tr>'
    +'<tr><td>Title</td><td>'+d.title+'</td></tr>'
    +'<tr><td>Description</td><td>'+(d.desc||'Missing')+'</td></tr>'
    +'<tr><td>Robots</td><td>'+d.robots+'</td></tr>'
    +'<tr><td>Language</td><td>'+d.lang+'</td></tr>'
    +'<tr><td>Words</td><td>'+d.words+'</td></tr>'
    +'</table>'
    +'<h2>Links</h2><table><tr><th>Type</th><th>Count</th></tr>'
    +'<tr><td>Total</td><td>'+d.lCount+'</td></tr><tr><td>Internal</td><td>'+d.int+'</td></tr><tr><td>External</td><td>'+d.ext+'</td></tr><tr><td>Nofollow</td><td>'+d.nfCount+'</td></tr>'
    +'</table>'
    +'<div class="footer">SEO Auditor Pro — Developed by Viraj Singh · '+new Date().toLocaleString()+'</div>'
    +'</body></html>';
  const blob = new Blob([html],{type:'text/html'});
  chrome.tabs.create({url:URL.createObjectURL(blob)});
}

// ── Settings Tab ───────────────────────────────────────────────
function renderSettings() {
  const items = [{key:'title',label:'Meta Title'},{key:'desc',label:'Meta Description'},{key:'h1',label:'H1 Tag'},{key:'alt',label:'Image Alt Text'},{key:'canonical',label:'Canonical Tag'}];
  let html = '<div class="section-title" style="grid-column:span 2"><div class="st-inner">SEO Score Weights</div></div>'
    +'<div class="card full" style="font-size:11px;color:var(--muted)">Adjust how much each factor affects your SEO score.</div>';
  items.forEach(item => {
    html += '<div class="setting-row"><div class="setting-label">'+item.label+' <span class="setting-val" id="lbl-'+item.key+'">'+scoreWeights[item.key]+'</span></div>'
      +'<input type="range" min="0" max="50" value="'+scoreWeights[item.key]+'" id="rng-'+item.key+'"></div>';
  });
  html += '<button class="save-btn" id="saveBtn">💾 Save Weights</button>';
  html += '<div class="card full"><div class="section-title" style="grid-column:unset;margin-bottom:8px;"><div class="st-inner">About</div></div>'
    +'<div style="font-size:11px;color:var(--muted);line-height:1.7"><b style="color:var(--text)">SEO Auditor Pro v2.0</b><br>Built by Viraj Singh · BBA Digital Marketing<br>JECRC University, Jaipur</div></div>';
  document.getElementById('settings').innerHTML = html;

  items.forEach(item => {
    document.getElementById('rng-'+item.key).addEventListener('input', function() {
      document.getElementById('lbl-'+item.key).textContent = this.value;
    });
  });
  document.getElementById('saveBtn').addEventListener('click', () => {
    items.forEach(item => { scoreWeights[item.key] = parseInt(document.getElementById('rng-'+item.key).value); });
    document.getElementById('saveBtn').textContent = '✅ Saved!';
    setTimeout(() => { document.getElementById('saveBtn').textContent = '💾 Save Weights'; }, 2000);
  });
}

// ── Compare Tab ────────────────────────────────────────────────
function renderCompare(data, url) {
  const el = document.getElementById('compare');

  // Load from chrome.storage.local
  chrome.storage.local.get(['seoPage1', 'seoPage1Url'], (stored) => {
    const p1 = stored.seoPage1 || null;
    const p1url = stored.seoPage1Url || '';

    if (!p1) {
      el.innerHTML = '<div class="section-title" style="grid-column:span 2"><div class="st-inner">Compare Two Pages</div></div>'
        +'<div class="card full" style="text-align:center;padding:20px">'
        +'<div style="font-size:28px;margin-bottom:10px">🆚</div>'
        +'<div style="font-size:12px;color:var(--muted);margin-bottom:14px">Save this page as Page 1, then go to another page and reopen the extension to compare!</div>'
        +'<button class="store-btn" id="storeBtn">📌 Save Current Page as Page 1</button></div>';
      document.getElementById('storeBtn').addEventListener('click', () => {
        chrome.storage.local.set({seoPage1: data, seoPage1Url: url}, () => {
          renderCompare(data, url);
        });
      });
      return;
    }

    if (p1url === url) {
      el.innerHTML = '<div class="section-title" style="grid-column:span 2"><div class="st-inner">Compare Two Pages</div></div>'
        +'<div class="card full" style="text-align:center;padding:16px">'
        +'<div style="font-size:20px;margin-bottom:8px">✅</div>'
        +'<div style="font-size:12px;color:var(--green);margin-bottom:4px">Page 1 saved!</div>'
        +'<div style="font-size:11px;color:var(--muted);margin-bottom:4px">'+p1url+'</div>'
        +'<div style="font-size:11px;color:var(--muted)">Now navigate to a different page and reopen the extension to compare.</div>'
        +'<button class="store-btn" style="margin-top:12px" id="clearBtn">🗑️ Reset</button></div>';
      document.getElementById('clearBtn').addEventListener('click', () => {
        chrome.storage.local.remove(['seoPage1','seoPage1Url'], () => renderCompare(data, url));
      });
      return;
    }

    // Both pages ready — show comparison!
    const p2 = data;
    const metrics = [
      {label:'SEO Score',     v1:calcScore(p1),  v2:calcScore(p2),  hi:true},
      {label:'Title Length',  v1:p1.tLen,        v2:p2.tLen,        fn:v=>v>=50&&v<=60},
      {label:'Desc Length',   v1:p1.dLen,        v2:p2.dLen,        fn:v=>v>=120&&v<=160},
      {label:'Word Count',    v1:p1.words,       v2:p2.words,       hi:true},
      {label:'Internal Links',v1:p1.int,         v2:p2.int,         hi:true},
      {label:'External Links',v1:p1.ext,         v2:p2.ext,         hi:true},
      {label:'Missing Alts',  v1:p1.mAlt,        v2:p2.mAlt,        fn:v=>v===0},
      {label:'H1 Tags',       v1:p1.h.h1,        v2:p2.h.h1,        fn:v=>v===1},
      {label:'Images',        v1:p1.imgCount,    v2:p2.imgCount,    hi:true},
      {label:'H2 Tags',       v1:p1.h.h2,        v2:p2.h.h2,        hi:true},
    ];
    const rows = metrics.map(m => {
      let c1='c-tie', c2='c-tie';
      if (m.fn) { c1=m.fn(m.v1)?'c-win':'c-lose'; c2=m.fn(m.v2)?'c-win':'c-lose'; }
      else if (m.v1!==m.v2) { c1=(m.hi?m.v1>m.v2:m.v1<m.v2)?'c-win':'c-lose'; c2=(m.hi?m.v2>m.v1:m.v2<m.v1)?'c-win':'c-lose'; }
      return '<div class="compare-row"><span class="'+c1+'">'+m.v1+'</span><span class="c-label">'+m.label+'</span><span class="'+c2+'">'+m.v2+'</span></div>';
    }).join('');

    try {
      const p1host = new URL(p1url).hostname;
      const p2host = new URL(url).hostname;
      const p1score = calcScore(p1), p2score = calcScore(p2);
      const winner = p1score > p2score ? p1host : p2score > p1score ? p2host : 'Tie!';

      el.innerHTML = '<div class="section-title" style="grid-column:span 2"><div class="st-inner">Page Comparison</div></div>'
        +'<div class="card full" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px">'
        +'<div style="text-align:center;flex:1"><div style="font-size:18px;font-weight:700;font-family:var(--mono);color:var(--accent)">'+p1score+'</div><div style="font-size:10px;color:var(--muted)">'+p1host+'</div></div>'
        +'<div style="font-size:11px;color:var(--muted);font-weight:700">VS</div>'
        +'<div style="text-align:center;flex:1"><div style="font-size:18px;font-weight:700;font-family:var(--mono);color:var(--accent2)">'+p2score+'</div><div style="font-size:10px;color:var(--muted)">'+p2host+'</div></div>'
        +'</div>'
        +'<div class="card full" style="text-align:center;padding:8px;font-size:11px;color:var(--green);font-weight:700">🏆 Winner: '+winner+'</div>'
        +'<div class="card full">'+rows+'</div>'
        +'<button class="store-btn" id="resetBtn">🔄 Reset Comparison</button>';
      document.getElementById('resetBtn').addEventListener('click', () => {
        chrome.storage.local.remove(['seoPage1','seoPage1Url'], () => renderCompare(data, url));
      });
    } catch(e) {
      el.innerHTML = '<div class="card full">Error rendering comparison.</div>';
    }
  });
}

// ── Link Map ───────────────────────────────────────────────────
function renderLinkMap(links, url) {
  const el = document.getElementById('linkmap');
  el.innerHTML = '<div class="section-title" style="grid-column:span 2"><div class="st-inner">Internal Link Map</div></div>'
    +'<canvas id="linkmapCanvas" width="588" height="380" style="cursor:pointer"></canvas>'
    +'<div style="grid-column:span 2;display:flex;gap:20px;font-size:11px;color:var(--muted);padding:6px 0;align-items:center">'
    +'<span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#00c2ff;margin-right:5px;vertical-align:middle"></span>Current Page</span>'
    +'<span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#7c6aff;margin-right:5px;vertical-align:middle"></span>Internal Links</span>'
    +'<span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#00e5a0;margin-right:5px;vertical-align:middle"></span>External Links</span>'
    +'</div>'
    +'<div class="card full" style="font-size:10px;color:var(--muted)">💡 <b style="color:var(--text)">How to read:</b> The center node (YOU) is the current page. Lines connect to all links found on it. Hover over any node to see its full URL.</div>'
    +'<div id="tooltip" style="display:none;position:fixed;background:#0e1117;border:1px solid var(--border);border-radius:8px;padding:8px 12px;font-size:11px;font-family:var(--mono);color:var(--text);max-width:300px;word-break:break-all;z-index:9999;pointer-events:none;box-shadow:0 4px 20px rgba(0,0,0,0.5)"></div>';

  const canvas = document.getElementById('linkmapCanvas');
  if (!canvas) return;

  // Retina/HiDPI support for sharp rendering
  const dpr = window.devicePixelRatio || 1;
  canvas.width = 588 * dpr;
  canvas.height = 380 * dpr;
  canvas.style.width = '588px';
  canvas.style.height = '380px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const W=588, H=380;
  ctx.fillStyle='#1e2535'; ctx.fillRect(0,0,W,H);

  let nodePositions = [];

  try {
    const origin = new URL(url).origin;
    const intL = links.filter(l=>l.startsWith(origin)).slice(0,16);
    const extL = links.filter(l=>!l.startsWith(origin)).slice(0,8);
    const nodes = [{url,type:'root'},...intL.map(u=>({url:u,type:'int'})),...extL.map(u=>({url:u,type:'ext'}))];
    const cx=W/2, cy=H/2-10;
    const total = nodes.length - 1;

    const pos = nodes.map((n,i) => {
      if (i===0) return {x:cx, y:cy};
      const angle = ((i-1)/total)*Math.PI*2 - Math.PI/2;
      const r = n.type==='int' ? 130 : 158;
      return {x: cx+Math.cos(angle)*r, y: cy+Math.sin(angle)*r};
    });
    nodePositions = nodes.map((n,i) => ({...n, x:pos[i].x, y:pos[i].y, r:i===0?18:10}));

    // Draw edges with gradient
    nodes.forEach((_,i) => {
      if (i===0) return;
      const grad = ctx.createLinearGradient(pos[0].x,pos[0].y,pos[i].x,pos[i].y);
      grad.addColorStop(0, nodes[i].type==='int'?'rgba(124,106,255,0.5)':'rgba(0,229,160,0.4)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.moveTo(pos[0].x,pos[0].y); ctx.lineTo(pos[i].x,pos[i].y);
      ctx.strokeStyle=grad; ctx.lineWidth=1.5; ctx.stroke();
    });

    // Draw nodes
    nodes.forEach((node,i) => {
      const p=pos[i];
      const r = i===0 ? 18 : 10;
      const color = i===0?'#00c2ff': node.type==='int'?'#7c6aff':'#00e5a0';

      // Glow effect
      ctx.shadowColor = color;
      ctx.shadowBlur = i===0 ? 16 : 8;
      ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2);
      ctx.fillStyle = color+'44'; ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = i===0?2.5:2; ctx.stroke();
      ctx.shadowBlur = 0;

      // Label for center
      if (i===0) {
        ctx.fillStyle=color; ctx.font='bold 9px DM Sans,sans-serif';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('YOU', p.x, p.y);
      }

      // Short path label below node
      try {
        const path = new URL(node.url).pathname.replace(/\/$/,'')||'/';
        const short = path.length>16 ? path.substring(0,16)+'…' : path;
        ctx.fillStyle = i===0 ? '#00c2ff' : 'rgba(200,210,240,0.75)';
        ctx.font = i===0 ? 'bold 9px DM Sans,sans-serif' : '8px DM Sans,sans-serif';
        ctx.textAlign='center'; ctx.textBaseline='top';
        ctx.fillText(short, p.x, p.y + r + 4);
      } catch(e){}
    });

    // Hover tooltip
    const tooltip = document.getElementById('tooltip');
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let found = false;
      nodePositions.forEach(node => {
        const dx = mx-node.x, dy = my-node.y;
        if (Math.sqrt(dx*dx+dy*dy) <= node.r+4) {
          found = true;
          try {
            const u = new URL(node.url);
            const typeLabel = node.type==='root'?'📍 Current Page': node.type==='int'?'🟣 Internal Link':'🟢 External Link';
            tooltip.innerHTML = typeLabel+'<br><span style="color:var(--muted)">'+u.hostname+'</span><br>'+u.pathname;
          } catch(e) { tooltip.innerHTML = node.url; }
          tooltip.style.display='block';
          tooltip.style.left=(e.clientX+12)+'px';
          tooltip.style.top=(e.clientY-10)+'px';
        }
      });
      if (!found) tooltip.style.display='none';
    });
    canvas.addEventListener('mouseleave', () => { tooltip.style.display='none'; });

    // Click to open URL
    canvas.addEventListener('click', (e) => {
      const rect=canvas.getBoundingClientRect();
      const mx=e.clientX-rect.left, my=e.clientY-rect.top;
      nodePositions.forEach(node => {
        const dx=mx-node.x, dy=my-node.y;
        if (Math.sqrt(dx*dx+dy*dy)<=node.r+4 && node.type!=='root') {
          chrome.tabs.create({url:node.url});
        }
      });
    });

  } catch(e) {
    ctx.fillStyle='rgba(232,234,240,0.5)'; ctx.font='12px sans-serif'; ctx.textAlign='center';
    ctx.fillText('Could not render map', W/2, H/2);
  }
}

// ── Speed Tab ──────────────────────────────────────────────────
function renderSpeedTab(url) {
  currentPageUrl = url;
  document.getElementById('speed').innerHTML =
    '<div class="strategy-toggle">'
    +'<button class="strategy-btn active" id="btn-mobile">📱 Mobile</button>'
    +'<button class="strategy-btn" id="btn-desktop">🖥️ Desktop</button>'
    +'</div>'
    +'<div class="section-title" style="grid-column:span 2"><div class="st-inner">Core Web Vitals</div></div>'
    +'<div id="vitals" style="grid-column:span 2;display:grid;grid-template-columns:1fr 1fr;gap:10px;">'
    +'<div class="card full" style="text-align:center;padding:24px"><div style="font-size:28px;margin-bottom:8px">⏳</div><div style="color:var(--muted);font-size:12px">Click a strategy to load PageSpeed data</div></div>'
    +'</div>';
  document.getElementById('btn-mobile').addEventListener('click', () => fetchSpeed(currentPageUrl,'mobile'));
  document.getElementById('btn-desktop').addEventListener('click', () => fetchSpeed(currentPageUrl,'desktop'));
}

async function fetchSpeed(url, strategy) {
  const bM=document.getElementById('btn-mobile'), bD=document.getElementById('btn-desktop');
  if (bM) { bM.classList.toggle('active',strategy==='mobile'); bM.addEventListener('click',()=>fetchSpeed(currentPageUrl,'mobile')); }
  if (bD) { bD.classList.toggle('active',strategy==='desktop'); bD.addEventListener('click',()=>fetchSpeed(currentPageUrl,'desktop')); }
  document.getElementById('vitals').innerHTML = '<div class="card full" style="text-align:center;padding:24px;grid-column:span 2"><div style="font-size:28px;margin-bottom:8px">⏳</div><div style="color:var(--muted);font-size:12px;margin-top:6px">Fetching PageSpeed data...</div></div>';
  try {
    const res = await fetch('https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url='+encodeURIComponent(url)+'&strategy='+strategy);
    const json = await res.json();
    const cats=json.lighthouseResult?.categories, aud=json.lighthouseResult?.audits;
    if (!cats||!aud) throw new Error('no data');
    const score=Math.round((cats.performance?.score||0)*100);
    const fcp=aud['first-contentful-paint']?.displayValue||'N/A';
    const lcp=aud['largest-contentful-paint']?.displayValue||'N/A';
    const tbt=aud['total-blocking-time']?.displayValue||'N/A';
    const cls=aud['cumulative-layout-shift']?.displayValue||'N/A';
    const si=aud['speed-index']?.displayValue||'N/A';
    const tti=aud['interactive']?.displayValue||'N/A';
    const sc=score>=90?'var(--green)':score>=50?'var(--yellow)':'var(--red)';
    const scClass=score>=90?'good':score>=50?'avg':'poor';
    const vc=(v,g,a)=>{const n=parseFloat(v);return isNaN(n)?'avg':n<=g?'good':n<=a?'avg':'poor';};
    document.getElementById('vitals').innerHTML =
      '<div class="vital-card vital-'+scClass+' full" style="display:flex;align-items:center;gap:16px;grid-column:span 2">'
      +'<div style="text-align:center;flex-shrink:0"><div style="font-size:36px;font-weight:700;font-family:var(--mono);color:'+sc+'">'+score+'</div><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;">Performance</div></div>'
      +'<div style="flex:1"><div style="font-size:12px;font-weight:600;margin-bottom:6px">'+(score>=90?'🟢 Fast':score>=50?'🟡 Needs Improvement':'🔴 Slow')+'</div>'
      +'<div class="score-bar-wrap"><div class="score-bar-fill" style="width:'+score+'%;background:'+sc+'"></div></div>'
      +'<div style="font-size:10px;color:var(--muted)">'+(strategy==='mobile'?'📱 Mobile':'🖥️ Desktop')+' · Google PageSpeed</div></div></div>'
      +'<div class="vital-card vital-'+vc(parseFloat(fcp),1.8,3)+'"><div class="vital-label">FCP</div><div class="vital-value">'+fcp+'</div><div class="vital-unit">First Contentful Paint</div></div>'
      +'<div class="vital-card vital-'+vc(parseFloat(lcp),2.5,4)+'"><div class="vital-label">LCP</div><div class="vital-value">'+lcp+'</div><div class="vital-unit">Largest Contentful Paint</div></div>'
      +'<div class="vital-card vital-'+vc(parseFloat(tbt),200,600)+'"><div class="vital-label">TBT</div><div class="vital-value">'+tbt+'</div><div class="vital-unit">Total Blocking Time</div></div>'
      +'<div class="vital-card vital-'+vc(parseFloat(cls),0.1,0.25)+'"><div class="vital-label">CLS</div><div class="vital-value">'+cls+'</div><div class="vital-unit">Cumulative Layout Shift</div></div>'
      +'<div class="vital-card vital-'+vc(parseFloat(si),3.4,5.8)+'"><div class="vital-label">SI</div><div class="vital-value">'+si+'</div><div class="vital-unit">Speed Index</div></div>'
      +'<div class="vital-card vital-'+vc(parseFloat(tti),3.8,7.3)+'"><div class="vital-label">TTI</div><div class="vital-value">'+tti+'</div><div class="vital-unit">Time to Interactive</div></div>';
  } catch(e) {
    document.getElementById('vitals').innerHTML =
      '<div class="card full" style="text-align:center;padding:20px;grid-column:span 2">'
      +'<div style="font-size:24px;margin-bottom:8px">⚠️</div>'
      +'<div style="color:var(--red);font-size:12px;margin-bottom:12px">Could not fetch PageSpeed data.<br><span style="color:var(--muted);font-size:10px">Slow connection or timeout.</span></div>'
      +'<button class="check-btn" id="retryBtn">🔄 Retry</button>'
      +'<div style="font-size:10px;color:var(--muted);margin-top:10px">Open in browser:</div>'
      +'<div style="display:flex;gap:8px;margin-top:8px">'
      +'<div class="shortcut-btn" id="psD" style="flex:1"><span class="shortcut-icon">🖥️</span>Desktop</div>'
      +'<div class="shortcut-btn" id="psM" style="flex:1"><span class="shortcut-icon">📱</span>Mobile</div>'
      +'</div></div>';
    document.getElementById('retryBtn').addEventListener('click',()=>fetchSpeed(url,strategy));
    document.getElementById('psD').addEventListener('click',()=>chrome.tabs.create({url:'https://pagespeed.web.dev/report?url='+encodeURIComponent(url)+'&form_factor=desktop'}));
    document.getElementById('psM').addEventListener('click',()=>chrome.tabs.create({url:'https://pagespeed.web.dev/report?url='+encodeURIComponent(url)+'&form_factor=mobile'}));
  }
}

// ── X-Robots ───────────────────────────────────────────────────
async function checkXRobots(url) {
  const el = document.getElementById('xrobots-val');
  if (!el) return;
  try {
    const res = await fetch(url, {method:'HEAD'});
    el.textContent = res.headers.get('x-robots-tag') || 'Not Set';
  } catch(e) { el.textContent = 'Could not fetch'; }
}

// ── Broken Link Checker ────────────────────────────────────────
let allPageLinks = [];
async function runBrokenLinkCheck() {
  const btn=document.getElementById('checkLinksBtn'), sec=document.getElementById('brokenSection');
  btn.disabled=true; btn.innerText='⏳ Checking...';
  const toCheck=allPageLinks.slice(0,30);
  sec.innerHTML+='<div class="progress-wrap" style="margin-top:8px"><div class="progress-bar" id="pbar" style="width:0%"></div></div><div id="ptxt" style="font-size:10px;color:var(--muted);margin-top:4px">Checking 0/'+toCheck.length+'...</div>';
  let done=0; const results=[];
  for (const url of toCheck) {
    try { const r=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(6000)}); results.push({url,status:r.status,ok:r.status<400}); }
    catch(e) { results.push({url,status:'Error',ok:false}); }
    done++;
    const bar=document.getElementById('pbar'), txt=document.getElementById('ptxt');
    if (bar) bar.style.width=Math.round((done/toCheck.length)*100)+'%';
    if (txt) txt.textContent='Checking '+done+'/'+toCheck.length+'...';
  }
  const broken=results.filter(r=>!r.ok);
  let html='<div class="section-title" style="grid-column:span 2"><div class="st-inner">Results: '+broken.length+' Broken / '+(results.length-broken.length)+' OK</div></div><div class="card full">';
  html += broken.length===0 ? '<div style="color:var(--green);font-size:12px;font-weight:600">✅ No broken links found!</div>'
    : broken.map(r=>'<div class="link-item link-broken"><span class="link-status">'+r.status+'</span>'+r.url+'</div>').join('');
  html += '</div>';
  document.getElementById('links').innerHTML = '<div class="section-title" style="grid-column:span 2"><div class="st-inner">Link Summary</div></div>'
    +'<div class="card">Total: '+allPageLinks.length+'</div>'
    +'<div class="card">Broken: '+broken.length+'</div>'+html;
}

// ── Loading state ─────────────────────────────────────────────
function showLoading() {
  const loadHTML = '<div style="grid-column:span 2;text-align:center;padding:30px;color:var(--muted);font-size:12px">⏳ Loading...</div>';
  ['overview','headings','links','images','schema','social','hreflang','speed','keywords','tips','compare','linkmap','settings','serp','history'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.display = ''; el.innerHTML = loadHTML; }
  });
  // Put spinner only on overview
  const ov = document.getElementById('overview');
  ov.innerHTML = '<div style="grid-column:span 2;text-align:center;padding:40px 20px">'
    +'<div style="font-size:36px;margin-bottom:12px;animation:spin 1s linear infinite;display:inline-block">⚙️</div>'
    +'<div style="font-size:13px;color:var(--muted);margin-top:8px">Analysing page...</div>'
    +'</div>';
}

function showError(msg) {
  document.getElementById('overview').innerHTML =
    '<div style="grid-column:span 2;text-align:center;padding:40px 20px">'
    +'<div style="font-size:36px;margin-bottom:12px">⚠️</div>'
    +'<div style="font-size:13px;color:var(--red);font-weight:600;margin-bottom:8px">'+msg+'</div>'
    +'<div style="font-size:11px;color:var(--muted)">Navigate to a regular webpage and try again.</div>'
    +'</div>';
  // Make all other tabs show same message
  ['headings','links','images','schema','social','hreflang','speed','keywords','tips','compare','linkmap','settings','serp','history'].forEach(id => {
    const el = document.getElementById(id);
    if (el && id !== 'history' && id !== 'settings' && id !== 'compare') {
      el.innerHTML = '<div style="grid-column:span 2;text-align:center;padding:30px;color:var(--muted);font-size:12px">⚠️ '+msg+'</div>';
    }
  });
}

// ── Main Scraper ───────────────────────────────────────────────
function masterScraper() {
  const meta=n=>document.querySelector('meta[name="'+n+'"],meta[property="'+n+'"]')?.content||'';
  const hNodes=n=>document.querySelectorAll('h'+n);
  const hText=nodes=>{
    const texts=Array.from(nodes).map(el=>(el.textContent||el.innerText||'').trim()).filter(t=>t.length>0);
    return texts.map(t=>'* '+t+'<br>').join('');
  };
  const allLinks=document.querySelectorAll('a[href]');
  const intLinks=Array.from(allLinks).filter(a=>a.host===window.location.host).length;
  // Detect schema — handle arrays, nested @graph, and dynamic injection
  const schemaScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  const schemaResults = [];
  schemaScripts.forEach(s => {
    try {
      const raw = s.textContent || s.innerHTML || '';
      if (!raw.trim()) return;
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] ? parsed['@graph'] : [parsed]);
      items.forEach(item => {
        const type = item['@type'];
        if (!type) return;
        const typeStr = Array.isArray(type) ? type.join(', ') : type;
        const name = item.name || item.headline || '';
        schemaResults.push('📦 <b>'+typeStr+'</b>'+(name?' — '+name.substring(0,40):'')+'<br>');
      });
    } catch(e) {}
  });
  const schemas = schemaResults.join('') || '';
  const allImgs=document.querySelectorAll('img');
  const visImgs=Array.from(allImgs).filter(img=>{
    const w=img.naturalWidth||img.width||img.offsetWidth, h=img.naturalHeight||img.height||img.offsetHeight;
    const s=window.getComputedStyle(img);
    return s.display!=='none'&&s.visibility!=='hidden'&&w>10&&h>10;
  });
  const mAlt=visImgs.filter(i=>!i.alt||i.alt.trim()==='').length;
  const hreflang=Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]')).map(el=>({lang:el.getAttribute('hreflang'),url:el.getAttribute('href')||'N/A'}));
  const allHrefs=Array.from(allLinks).map(a=>a.href).filter(h=>h&&(h.startsWith('http://')||h.startsWith('https://'))).filter((v,i,arr)=>arr.indexOf(v)===i);
  return {
    title:document.title, tLen:document.title.length,
    desc:meta('description'), dLen:meta('description').length,
    canon:document.querySelector('link[rel="canonical"]')?.href||'Missing',
    robots:meta('robots')||'index, follow',
    isIndexable:!meta('robots').includes('noindex'),
    words:document.body.innerText.split(/\s+/).filter(w=>w.length>0).length,
    lang:document.documentElement.lang||'en', charset:document.characterSet,
    h:{h1:hNodes(1).length,h2:hNodes(2).length,h3:hNodes(3).length,other:hNodes(4).length+hNodes(5).length+hNodes(6).length},
    hGroup:{h1:hText(hNodes(1)),h2:hText(hNodes(2)),h3:hText(hNodes(3)),other:hText(document.querySelectorAll('h4,h5,h6'))},
    lCount:allLinks.length, int:intLinks, ext:allLinks.length-intLinks,
    nfCount:Array.from(allLinks).filter(a=>(a.rel||'').toLowerCase().includes('nofollow')).length,
    allLinks:allHrefs,
    imgCount:visImgs.length, mAlt, skippedImgs:allImgs.length-visImgs.length,
    altPct:visImgs.length?Math.round(((visImgs.length-mAlt)/visImgs.length)*100):100,
    schemaMarkup:schemas,
    soc:{ogT:meta('og:title'),ogD:meta('og:description'),twT:meta('twitter:title'),ogImg:meta('og:image')},
    hreflang, bodyText:document.body.innerText||'',
    dupTitle:document.querySelectorAll('title').length,
    dupDesc:document.querySelectorAll('meta[name="description"]').length,
    dupCanon:document.querySelectorAll('link[rel="canonical"]').length,
    dupH1:document.querySelectorAll('h1').length,
    dupOg:document.querySelectorAll('meta[property="og:title"]').length
  };
}

// ── Start Audit ────────────────────────────────────────────────
async function startAudit() {
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true});

  // Block chrome:// and other internal pages
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:') || tab.url.startsWith('edge://')) {
    showError("Can't audit Chrome internal pages.");
    renderHistory();
    renderSettings();
    renderCompare({}, tab.url||'');
    return;
  }

  // Block if page still loading
  if (tab.status === 'loading') {
    showError('Page is still loading. Please wait and try again.');
    return;
  }

  showLoading();

  chrome.scripting.executeScript({target:{tabId:tab.id},func:masterScraper}, results => {
    if (chrome.runtime.lastError) {
      showError('Error: ' + chrome.runtime.lastError.message);
      return;
    }
    if (!results || !results[0] || results[0].result === undefined || results[0].result === null) {
      showError('Could not read page data. Try refreshing the page.');
      return;
    }
    const d = results[0].result;
    allPageLinks = d.allLinks||[];

    const tStat  = (d.tLen>=50&&d.tLen<=60)?'Good':'Review';
    const dStat  = (d.dLen>=120&&d.dLen<=160)?'Good':'Issue';
    const h1Stat = (d.h.h1===1)?'Good':'Issue';
    const altStat= (d.mAlt===0)?'None':'Issue';
    const canStat= (d.canon!=='Missing')?'Good':'Missing';
    const score  = calcScore(d);
    const scoreColor = score>=80?'var(--green)':score>=50?'var(--yellow)':'var(--red)';
    const circ=2*Math.PI*26, dash=(score/100)*circ;
    const readS = fleschScore(d.bodyText||'');
    const readI = fleschLabel(readS);

    const reportText = 'SEO Report for '+d.title+'\n- Title: '+tStat+' ('+d.tLen+' chars)\n- Description: '+dStat+' ('+d.dLen+' chars)\n- H1: '+h1Stat+' ('+d.h.h1+')\n- Missing Alts: '+d.mAlt+'\n- Canonical: '+canStat+'\n- Readability: '+readS+' ('+readI.label+')';

    // ── OVERVIEW ────────────────────────────────────────────────
    const encodedUrl = encodeURIComponent(tab.url);
    const origin = new URL(tab.url).origin;
    const shortcuts = [
      {icon:'🚀',label:'PageSpeed',url:'https://pagespeed.web.dev/report?url='+encodedUrl},
      {icon:'🔍',label:'Ahrefs',url:'https://ahrefs.com/website-authority-checker/?input='+encodedUrl},
      {icon:'📦',label:'Cache',url:'https://webcache.googleusercontent.com/search?q=cache:'+tab.url},
      {icon:'📊',label:'Moz DA',url:'https://moz.com/domain-analysis?site='+encodeURIComponent(tab.url.replace(/https?:\/\//,''))},
      {icon:'🗺️',label:'Sitemap',url:origin+'/sitemap.xml'},
      {icon:'🤖',label:'Robots.txt',url:origin+'/robots.txt'},
    ];

    document.getElementById('overview').innerHTML =
      '<div class="score-wrap">'
      +'<div class="score-ring"><svg width="72" height="72" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="#363f5e" stroke-width="6"/><circle cx="32" cy="32" r="26" fill="none" stroke="'+scoreColor+'" stroke-width="6" stroke-dasharray="'+dash+' '+circ+'" stroke-linecap="round"/></svg><div class="score-num" style="color:'+scoreColor+'">'+score+'</div></div>'
      +'<div class="score-info"><div class="score-title">SEO Score</div><div class="score-sub">'+(score>=80?'Great shape!':score>=50?'Needs work':'Critical issues')+'</div></div>'
      +'<button class="copy-btn" id="copyBtn">Copy Report</button>'
      +'</div>'
      +'<div class="section-title" style="grid-column:span 2"><div class="st-inner">Health Checks</div></div>'
      +'<div class="card full">'
      +'<div class="hl"><span>Meta Title Length</span><span class="badge '+(tStat==='Good'?'ok':'warn')+'">'+tStat+' · '+d.tLen+' chars</span></div>'
      +'<div class="hl"><span>Meta Description</span><span class="badge '+(dStat==='Good'?'ok':'err')+'">'+dStat+' · '+d.dLen+' chars</span></div>'
      +'<div class="hl"><span>H1 Count</span><span class="badge '+(h1Stat==='Good'?'ok':'err')+'">'+h1Stat+' · '+d.h.h1+' found</span></div>'
      +'<div class="hl"><span>Missing Alt Images</span><span class="badge '+(altStat==='None'?'ok':'err')+'">'+(altStat==='None'?'All Good':d.mAlt+' Missing')+'</span></div>'
      +'<div class="hl"><span>Canonical Tag</span><span class="badge '+(canStat==='Good'?'ok':'err')+'">'+canStat+'</span></div>'
      +'<div class="hl"><span>Hreflang</span><span class="badge '+(d.hreflang.length>0?'ok':'warn')+'">'+(d.hreflang.length>0?d.hreflang.length+' Found':'None')+'</span></div>'
      +'</div>'
      +'<div class="section-title" style="grid-column:span 2"><div class="st-inner">Meta Information</div></div>'
      +'<div class="card full"><div class="label-row"><span class="label">Meta Title</span><span class="badge '+(tStat==='Good'?'ok':'warn')+'">'+d.tLen+' chars</span></div><div class="value">'+d.title+'</div></div>'
      +'<div class="card full"><div class="label-row"><span class="label">Meta Description</span><span class="badge '+(dStat==='Good'?'ok':'err')+'">'+d.dLen+' chars</span></div><div class="value">'+(d.desc||'<span style="color:var(--red)">Missing!</span>')+'</div></div>'
      +'<div class="card full"><div class="label">Canonical URL</div><div class="value" style="color:var(--accent);font-family:var(--mono);font-size:11px">'+d.canon+'</div></div>'
      +'<div class="section-title" style="grid-column:span 2"><div class="st-inner">Indexing & Stats</div></div>'
      +'<div class="card"><div class="label">Robots Tag</div><div class="value">'+d.robots+'</div></div>'
      +'<div class="card"><div class="label">Status</div><div class="value">'+(d.isIndexable?'🟢 Indexable':'🔴 No-Index')+'</div></div>'
      +'<div class="card full"><div class="label">X-Robots-Tag</div><div class="value" id="xrobots-val" style="font-family:var(--mono);font-size:11px;color:var(--muted)">⏳ Checking...</div></div>'
      +'<div class="info-bar">'
      +'<div class="info-item"><b>'+d.words+'</b><small>WORDS</small></div>'
      +'<div class="info-item"><b>'+d.lang.toUpperCase()+'</b><small>LANG</small></div>'
      +'<div class="info-item"><b>'+d.charset+'</b><small>CHARSET</small></div>'
      +'<div class="info-item"><b style="color:'+readI.color+'">'+readS+'</b><small>READABILITY</small></div>'
      +'</div>'
      +'<div class="section-title" style="grid-column:span 2"><div class="st-inner">Readability</div></div>'
      +'<div class="card full" style="display:flex;align-items:center;gap:16px">'
      +'<div style="text-align:center;flex-shrink:0"><div class="read-score" style="color:'+readI.color+'">'+readS+'</div><div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Flesch Score</div></div>'
      +'<div><div style="font-size:13px;font-weight:700;color:'+readI.color+';margin-bottom:3px">'+readI.label+'</div><div style="font-size:11px;color:var(--muted)">'+readI.grade+' · 0–100 (higher = easier)</div></div>'
      +'</div>'
      +'<div class="section-title" style="grid-column:span 2"><div class="st-inner">Quick Tools</div></div>'
      +'<div class="shortcuts-grid">'+shortcuts.map(s=>'<div class="shortcut-btn" data-url="'+s.url+'"><span class="shortcut-icon">'+s.icon+'</span>'+s.label+'</div>').join('')+'</div>'
      +'<div class="section-title" style="grid-column:span 2"><div class="st-inner">Duplicate Tag Check</div></div>'
      +'<div class="card full" id="dupCheck">'+ (() => {
          const dups = [];
          if (d.dupTitle > 1) dups.push('⚠️ Multiple &lt;title&gt; tags found (' + d.dupTitle + ')');
          if (d.dupDesc  > 1) dups.push('⚠️ Multiple meta description tags (' + d.dupDesc + ')');
          if (d.dupCanon > 1) dups.push('⚠️ Multiple canonical tags (' + d.dupCanon + ')');
          if (d.dupOg    > 1) dups.push('⚠️ Multiple og:title tags (' + d.dupOg + ')');
          if (d.h.h1     > 1) dups.push('⚠️ Multiple H1 tags (' + d.h.h1 + ')');
          return dups.length === 0
            ? '<span style="color:var(--green);font-weight:600">✅ No duplicate tags detected</span>'
            : dups.map(msg => '<div style="color:var(--yellow);font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">' + msg + '</div>').join('');
        })()
      +'</div>';

    document.getElementById('copyBtn').addEventListener('click', () => {
      navigator.clipboard.writeText(reportText);
      document.getElementById('copyBtn').textContent='Copied! ✅';
      setTimeout(()=>{ document.getElementById('copyBtn').textContent='Copy Report'; },2000);
    });
    document.querySelectorAll('.shortcut-btn[data-url]').forEach(btn => {
      btn.addEventListener('click', () => chrome.tabs.create({url:btn.dataset.url}));
    });
    checkXRobots(tab.url);

    // ── HEADINGS ─────────────────────────────────────────────────
    document.getElementById('headings').innerHTML =
      '<div class="section-title" style="grid-column:span 2"><div class="st-inner">Heading Counts</div></div>'
      +'<div class="card">H1: '+d.h.h1+'</div><div class="card">H2: '+d.h.h2+'</div>'
      +'<div class="card">H3: '+d.h.h3+'</div><div class="card">H4–H6: '+d.h.other+'</div>'
      +'<div class="section-title" style="grid-column:span 2"><div class="st-inner">Visual Heading Structure</div></div>'
      +'<div class="card full">'+renderHeadingTree(d.hGroup, d.h)+'</div>';

    // ── LINKS ─────────────────────────────────────────────────────
    document.getElementById('links').innerHTML =
      '<div class="section-title" style="grid-column:span 2"><div class="st-inner">Link Summary</div></div>'
      +'<div class="card">Total: '+d.lCount+'</div><div class="card">Internal: '+d.int+'</div>'
      +'<div class="card">External: '+d.ext+'</div><div class="card">Nofollow: '+d.nfCount+'</div>'
      +'<div class="section-title" style="grid-column:span 2"><div class="st-inner">Broken Link Checker</div></div>'
      +'<div class="card full" id="brokenSection"><div style="font-size:11px;color:var(--muted);margin-bottom:8px">Checks up to 30 links for 404s or errors.</div>'
      +'<button class="check-btn" id="checkLinksBtn">🔍 Check for Broken Links</button></div>';
    document.getElementById('checkLinksBtn').addEventListener('click', runBrokenLinkCheck);

    // ── IMAGES ────────────────────────────────────────────────────
    document.getElementById('images').innerHTML =
      '<div class="section-title" style="grid-column:span 2"><div class="st-inner">Image Audit</div></div>'
      +'<div class="card">Total (Visible): '+d.imgCount+'</div>'
      +'<div class="card">Missing Alt: '+d.mAlt+'</div>'
      +'<div class="card">Alt Coverage: '+d.altPct+'%</div>'
      +'<div class="card">Skipped (Tiny/Hidden): '+d.skippedImgs+'</div>';

    // ── SCHEMA ────────────────────────────────────────────────────
    document.getElementById('schema').innerHTML =
      '<div class="section-title" style="grid-column:span 2"><div class="st-inner">Detected Schema</div></div>'
      +'<div class="card full"><div class="value">'+(d.schemaMarkup||'<span style="color:var(--red)">⚠️ No Schema detected. Consider adding JSON-LD structured data.</span>')+'</div></div>'
      +(d.schemaMarkup ? '<div class="card full" style="font-size:10px;color:var(--muted)">✅ Schema found! Structured data helps Google understand your page and show rich results in search.</div>' : '<div class="card full" style="font-size:10px;color:var(--muted)">💡 Add Schema markup using JSON-LD format. Common types: Article, Product, FAQ, BreadcrumbList, Organization.</div>');

    // ── SOCIAL ────────────────────────────────────────────────────
    renderSocialCards(d);

    // ── HREFLANG ─────────────────────────────────────────────────
    if (d.hreflang.length===0) {
      document.getElementById('hreflang').innerHTML =
        '<div class="section-title" style="grid-column:span 2"><div class="st-inner">Hreflang Tags</div></div>'
        +'<div class="card full"><div style="color:var(--red);font-size:12px;font-weight:600">⚠️ No hreflang tags found.</div><div style="font-size:10px;color:var(--muted);margin-top:6px">Add hreflang tags if targeting multiple languages or regions.</div></div>';
    } else {
      document.getElementById('hreflang').innerHTML =
        '<div class="section-title" style="grid-column:span 2"><div class="st-inner">Hreflang Tags <span class="badge info">'+d.hreflang.length+' Found</span></div></div>'
        +'<div class="card full">'+d.hreflang.map(h=>'<div class="hreflang-row"><span class="hreflang-lang">'+h.lang+'</span><span class="hreflang-url">'+h.url+'</span></div>').join('')+'</div>';
    }

    // ── SPEED ─────────────────────────────────────────────────────
    renderSpeedTab(tab.url);

    // ── KEYWORDS ─────────────────────────────────────────────────
    document.getElementById('keywords').innerHTML =
      '<div class="section-title" style="grid-column:span 2"><div class="st-inner">Top 20 Keywords by Density</div></div>'
      +'<div style="grid-column:span 2"><input id="kwSearch" type="text" placeholder="🔍  Filter keywords..." style="width:100%;padding:9px 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-family:var(--font);font-size:12px;outline:none;box-sizing:border-box;"></div>'
      +'<div class="card full" id="kwList">'+renderKeywords(d.bodyText)+'</div>'
      +'<div class="card full" style="font-size:10px;color:var(--muted)">ℹ️ Stop words excluded. Use this to check if your target keywords appear enough.</div>';
    document.getElementById('kwSearch').addEventListener('input', function() {
      const q = this.value.toLowerCase().trim();
      document.querySelectorAll('#kwList .kw-row').forEach(row => {
        const word = row.querySelector('.kw-word') ? row.querySelector('.kw-word').textContent.toLowerCase() : '';
        row.style.display = (!q || word.includes(q)) ? '' : 'none';
      });
    });

    // ── TIPS ──────────────────────────────────────────────────────
    document.getElementById('tips').innerHTML =
      '<div class="section-title" style="grid-column:span 2"><div class="st-inner">Auto SEO Recommendations</div></div>'
      +renderTips(d)
      +'<button class="export-btn" id="exportBtn" style="grid-column:span 2;margin-top:4px">📄 Export PDF Report</button>'
      +'<button class="export-btn" id="exportCsvBtn" style="grid-column:span 2;margin-top:6px;background:linear-gradient(135deg,var(--accent2),var(--accent))">📊 Export CSV</button>';
    document.getElementById('exportBtn').addEventListener('click', () => exportPDF(d));
    document.getElementById('exportCsvBtn').addEventListener('click', () => exportCSV(d));

    // ── COMPARE ───────────────────────────────────────────────────
    renderCompare(d, tab.url);

    // ── LINK MAP ──────────────────────────────────────────────────
    renderLinkMap(d.allLinks||[], tab.url);

    // ── SETTINGS ─────────────────────────────────────────────────
    renderSettings();

    // ── SERP PREVIEW ─────────────────────────────────────────────
    renderSERP(d, tab.url);

    // ── HISTORY ──────────────────────────────────────────────────
    renderHistory();
    saveToHistory(d, tab.url);
  });
}

startAudit();

// ── Theme Toggle ───────────────────────────────────────────────
function initTheme() {
  chrome.storage.local.get(['seoTheme'], (s) => {
    if (s.seoTheme === 'light') {
      document.body.classList.add('light');
      const btn = document.getElementById('themeToggle');
      if (btn) btn.textContent = '☀️';
    }
  });
}
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const isLight = document.body.classList.toggle('light');
      btn.textContent = isLight ? '☀️' : '🌙';
      chrome.storage.local.set({seoTheme: isLight ? 'light' : 'dark'});
    });
  }
});

// ── SERP Preview ───────────────────────────────────────────────
function renderSERP(data, url) {
  const title   = data.title || 'No title found';
  const desc    = data.desc  || 'No meta description found.';
  const tLen    = data.tLen;
  const dLen    = data.dLen;
  const tStatus = tLen >= 50 && tLen <= 60 ? 'ok'   : tLen > 60 ? 'err' : 'warn';
  const dStatus = dLen >= 120 && dLen <= 160 ? 'ok'  : dLen > 160 ? 'err' : 'warn';
  const tLabel  = tStatus==='ok'?'✅ Good':tLen>60?'⚠️ Too Long':'⚠️ Too Short';
  const dLabel  = dStatus==='ok'?'✅ Good':dLen>160?'⚠️ Too Long':'⚠️ Too Short';

  // Truncate for display like Google does
  const displayTitle = tLen > 60 ? title.substring(0,60)+'...' : title;
  const displayDesc  = dLen > 160 ? desc.substring(0,160)+'...' : desc;

  let urlParts = '';
  try {
    const u = new URL(url);
    urlParts = u.hostname + (u.pathname !== '/' ? u.pathname : '');
  } catch(e) { urlParts = url; }

  document.getElementById('serp').innerHTML =
    '<div class="section-title" style="grid-column:span 2"><div class="st-inner">Google SERP Preview</div></div>'
    +'<div class="serp-wrap">'
    +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
    +'<div style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#4285f4,#34a853);display:flex;align-items:center;justify-content:center;font-size:12px;color:white;font-weight:700">G</div>'
    +'<div><div style="font-size:13px;color:#202124;font-weight:500">'+urlParts+'</div>'
    +'<div class="serp-url">'+url.substring(0,60)+(url.length>60?'...':'')+'</div></div>'
    +'</div>'
    +'<div class="serp-title '+(tLen>60?'too-long':'')+'">'+displayTitle+'</div>'
    +'<div class="serp-desc '+(dLen>160?'too-long':'')+'">'+displayDesc+'</div>'
    +'</div>'
    +'<div class="section-title" style="grid-column:span 2"><div class="st-inner">Character Analysis</div></div>'
    +'<div class="card full">'
    +'<div style="margin-bottom:14px">'
    +'<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px"><span style="font-weight:600">Title</span><span style="font-family:var(--mono);color:'+(tStatus==='ok'?'var(--green)':tStatus==='warn'?'var(--yellow)':'var(--red)')+'">'+tLen+' / 60 chars</span></div>'
    +'<div style="background:var(--border);border-radius:6px;height:8px;overflow:hidden"><div style="height:8px;border-radius:6px;width:'+Math.min(100,Math.round((tLen/60)*100))+'%;background:'+(tStatus==='ok'?'var(--green)':tStatus==='warn'?'var(--yellow)':'var(--red)')+';transition:width .4s"></div></div>'
    +'<div style="font-size:10px;color:var(--muted);margin-top:4px">Ideal: 50–60 characters · '+tLabel+'</div>'
    +'</div>'
    +'<div>'
    +'<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px"><span style="font-weight:600">Description</span><span style="font-family:var(--mono);color:'+(dStatus==='ok'?'var(--green)':dStatus==='warn'?'var(--yellow)':'var(--red)')+'">'+dLen+' / 160 chars</span></div>'
    +'<div style="background:var(--border);border-radius:6px;height:8px;overflow:hidden"><div style="height:8px;border-radius:6px;width:'+Math.min(100,Math.round((dLen/160)*100))+'%;background:'+(dStatus==='ok'?'var(--green)':dStatus==='warn'?'var(--yellow)':'var(--red)')+';transition:width .4s"></div></div>'
    +'<div style="font-size:10px;color:var(--muted);margin-top:4px">Ideal: 120–160 characters · '+dLabel+'</div>'
    +'</div></div>'
    +'<div class="card full" style="font-size:10px;color:var(--muted)">💡 Red text in the preview above means Google will <b style="color:var(--red)">truncate</b> it in search results.</div>';
}

// ── Social Preview Cards ───────────────────────────────────────
function renderSocialCards(data) {
  const ogTitle  = data.soc.ogT || data.title || 'No OG Title';
  const ogDesc   = data.soc.ogD || data.desc  || 'No OG Description';
  const twTitle  = data.soc.twT || data.title || 'No Twitter Title';
  const ogImage  = data.soc.ogImg || '';
  let domain = '';
  try { domain = new URL(data.canon !== 'Missing' ? data.canon : 'https://example.com').hostname; } catch(e) { domain = 'example.com'; }

  const noImg1  = '<div style="width:100%;height:120px;background:linear-gradient(135deg,#2a3150,#363f5e);display:flex;align-items:center;justify-content:center;font-size:13px;color:#8e9bbf">No og:image found</div>';
  const noImg2  = '<div style="width:100%;height:110px;background:linear-gradient(135deg,#2a3150,#363f5e);display:flex;align-items:center;justify-content:center;font-size:13px;color:#8e9bbf">No og:image found</div>';
  const imgHtml   = ogImage ? '<img src="'+ogImage+'" style="width:100%;height:120px;object-fit:cover;display:block">' : noImg1;
  const twImgHtml = ogImage ? '<img src="'+ogImage+'" style="width:100%;height:110px;object-fit:cover;display:block">' : noImg2;

  document.getElementById('social').innerHTML =
    '<div class="section-title" style="grid-column:span 2"><div class="st-inner">Raw OG Tags</div></div>'
    +'<div class="card full">'
    +'<div class="hl"><span>og:title</span><span style="font-size:11px;color:var(--text);max-width:60%;text-align:right">'+(data.soc.ogT||'<span style="color:var(--red)">Missing</span>')+'</span></div>'
    +'<div class="hl"><span>og:description</span><span style="font-size:11px;color:var(--text);max-width:60%;text-align:right">'+(data.soc.ogD||'<span style="color:var(--red)">Missing</span>')+'</span></div>'
    +'<div class="hl"><span>og:image</span><span style="font-size:11px;color:var(--text);max-width:60%;text-align:right;word-break:break-all">'+(data.soc.ogImg||'<span style="color:var(--red)">Missing</span>')+'</span></div>'
    +'<div class="hl"><span>twitter:title</span><span style="font-size:11px;color:var(--text);max-width:60%;text-align:right">'+(data.soc.twT||'<span style="color:var(--red)">Missing</span>')+'</span></div>'
    +'</div>'
    +'<div class="section-title" style="grid-column:span 2"><div class="st-inner">Facebook Preview</div></div>'
    +'<div class="fb-card">'+imgHtml
    +'<div class="fb-body">'
    +'<div class="fb-domain">'+domain+'</div>'
    +'<div class="fb-title">'+ogTitle+'</div>'
    +'<div class="fb-desc">'+ogDesc+'</div>'
    +'</div></div>'
    +'<div class="section-title" style="grid-column:span 2"><div class="st-inner">Twitter/X Preview</div></div>'
    +'<div class="tw-card">'+twImgHtml
    +'<div class="tw-body">'
    +'<div class="tw-title">'+twTitle+'</div>'
    +'<div class="tw-desc">'+ogDesc+'</div>'
    +'<div class="tw-domain">🔗 '+domain+'</div>'
    +'</div></div>';
}

// ── CSV Export ─────────────────────────────────────────────────
function exportCSV(d) {
  const rows = [
    ['Metric','Value','Status'],
    ['URL', d.canon !== 'Missing' ? d.canon : 'N/A', ''],
    ['Meta Title', d.title, d.tLen>=50&&d.tLen<=60?'Good':'Review'],
    ['Title Length', d.tLen, d.tLen>=50&&d.tLen<=60?'Good':'Review'],
    ['Meta Description', d.desc||'Missing', d.dLen>=120&&d.dLen<=160?'Good':'Issue'],
    ['Description Length', d.dLen, d.dLen>=120&&d.dLen<=160?'Good':'Issue'],
    ['H1 Count', d.h.h1, d.h.h1===1?'Good':'Issue'],
    ['H2 Count', d.h.h2, ''],
    ['H3 Count', d.h.h3, ''],
    ['Word Count', d.words, d.words>=300?'Good':'Low'],
    ['Total Links', d.lCount, ''],
    ['Internal Links', d.int, ''],
    ['External Links', d.ext, ''],
    ['Nofollow Links', d.nfCount, ''],
    ['Total Images', d.imgCount, ''],
    ['Missing Alt Text', d.mAlt, d.mAlt===0?'Good':'Issue'],
    ['Alt Coverage %', d.altPct+'%', ''],
    ['Canonical Tag', d.canon, d.canon!=='Missing'?'Good':'Missing'],
    ['Robots Tag', d.robots, ''],
    ['Language', d.lang, ''],
    ['Charset', d.charset, ''],
    ['OG Title', d.soc.ogT||'Missing', d.soc.ogT?'Good':'Missing'],
    ['OG Description', d.soc.ogD||'Missing', d.soc.ogD?'Good':'Missing'],
    ['Twitter Title', d.soc.twT||'Missing', d.soc.twT?'Good':'Missing'],
    ['Hreflang Tags', d.hreflang.length, d.hreflang.length>0?'Found':'None'],
    ['Schema Markup', d.schemaMarkup?'Found':'Not Found', ''],
    ['SEO Score', calcScore(d), ''],
    ['Generated', new Date().toLocaleString(), ''],
  ];
  const csv = rows.map(r => r.map(cell => '"'+String(cell).replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'seo-audit-'+new Date().toISOString().split('T')[0]+'.csv';
  a.click();
}

// ── Audit History ──────────────────────────────────────────────
function saveToHistory(data, url) {
  chrome.storage.local.get(['seoHistory'], (s) => {
    const history = s.seoHistory || [];
    const entry = {
      url, title: data.title, score: calcScore(data),
      date: new Date().toLocaleString(),
      tLen: data.tLen, dLen: data.dLen, h1: data.h.h1,
      mAlt: data.mAlt, words: data.words
    };
    // Avoid duplicate same URL in a row
    if (history.length > 0 && history[0].url === url) history.shift();
    history.unshift(entry);
    // Keep last 20 entries
    if (history.length > 20) history.pop();
    chrome.storage.local.set({seoHistory: history});
  });
}

function renderHistory() {
  const el = document.getElementById('history');
  chrome.storage.local.get(['seoHistory'], (s) => {
    const history = s.seoHistory || [];
    if (history.length === 0) {
      el.innerHTML = '<div class="section-title" style="grid-column:span 2"><div class="st-inner">Audit History</div></div>'
        +'<div class="card full" style="text-align:center;padding:20px">'
        +'<div style="font-size:28px;margin-bottom:10px">🕓</div>'
        +'<div style="font-size:12px;color:var(--muted)">No history yet. Audit some pages and they\'ll appear here!</div>'
        +'</div>';
      return;
    }
    const scoreColor = s => s>=80?'var(--green)':s>=50?'var(--yellow)':'var(--red)';
    let html = '<div class="section-title" style="grid-column:span 2"><div class="st-inner">Audit History (Last '+history.length+')</div></div>';
    html += history.map((h,i) => {
      let favicon = '';
      try { favicon = new URL(h.url).origin + '/favicon.ico'; } catch(e) {}
      return '<div class="hist-item" id="hist-'+i+'">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
      +'<div style="display:flex;align-items:center;gap:8px">'
      +(favicon ? '<img src="'+favicon+'" width="14" height="14" style="border-radius:3px" onerror="this.remove()">' : '')
      +'<div class="hist-score" style="color:'+scoreColor(h.score)+'">'+h.score+'<span style="font-size:9px;color:var(--muted);font-weight:400"> / 100</span></div>'
      +'</div>'
      +'<div style="font-size:9px;color:var(--muted)">'+h.date+'</div>'
      +'</div>'
      +'<div class="hist-url">'+h.url+'</div>'
      +'<div style="font-size:11px;color:var(--muted);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+h.title+'</div>'
      +'<div class="hist-meta" style="margin-top:6px">'
      +'<span>📝 '+h.tLen+' chars</span>'
      +'<span>🏷️ '+h.h1+' H1</span>'
      +'<span>🖼️ '+h.mAlt+' missing alts</span>'
      +'<span>📊 '+h.words+' words</span>'
      +'</div></div>';
    }).join('');
    html += '<button class="store-btn" id="clearHistBtn">🗑️ Clear All History</button>';
    el.innerHTML = html;
    document.getElementById('clearHistBtn').addEventListener('click', () => {
      chrome.storage.local.remove(['seoHistory'], () => renderHistory());
    });
  });
}