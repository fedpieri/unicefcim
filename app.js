/* ═══════════════════════════════════════════════════════
   UNICEF PF4C · Application logic
   ═════════════════════════════════════════════════════ */

/* ── State ── */
let selIso3 = null, cmpList = [], cmpIndKey = 'gdppc';
let extraData = [], csvOpen = false, dark = true;

/* ─────────────────────────────────────────────────────
   DARK MODE
───────────────────────────────────────────────────── */
function toggleDark() {
  dark = !dark;
  document.body.classList.toggle('light', !dark);
  document.getElementById('toggle-dot').textContent = dark ? '☾' : '☀';
  buildGlobe(); // rebuild globe with correct star/light settings
}

/* ─────────────────────────────────────────────────────
   CSV UPLOAD
───────────────────────────────────────────────────── */
function toggleCSV() {
  csvOpen = !csvOpen;
  document.getElementById('csv-panel').style.display = csvOpen ? 'block' : 'none';
  document.getElementById('btn-csv').classList.toggle('active', csvOpen);
}

document.getElementById('file-in').addEventListener('change', e => {
  if (e.target.files[0]) handleCSV(e.target.files[0]);
});

const dz = document.querySelector('.drop-zone');
dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('drag'); });
dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
dz.addEventListener('drop', e => {
  e.preventDefault(); dz.classList.remove('drag');
  if (e.dataTransfer.files[0]) handleCSV(e.dataTransfer.files[0]);
});

function handleCSV(file) {
  Papa.parse(file, {
    header: true, skipEmptyLines: true, dynamicTyping: false,
    complete: ({ data, meta }) => {
      if (!meta.fields.includes('iso3') || !meta.fields.includes('year')) {
        alert('CSV non valido: le colonne "iso3" e "year" sono obbligatorie.'); return;
      }
      const src = ['IMF','WB','OECD','UNICEF'].find(s => file.name.toUpperCase().includes(s)) || 'Custom';
      extraData.push({ name:file.name, source:src, indicators:meta.fields.filter(f=>f!=='iso3'&&f!=='year'), data });
      updateCSVList();
      if (selIso3) renderCountryPanel(selIso3);
    }
  });
}

function updateCSVList() {
  document.getElementById('csv-list').innerHTML = extraData.map(d =>
    `<div style="display:flex;justify-content:space-between;margin-top:5px;font-size:9px;color:var(--txts)">
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px">${d.name}</span>
      ${srcBadge(d.source)}
    </div>`
  ).join('');
}

/* ─────────────────────────────────────────────────────
   CANVAS CHARTS
───────────────────────────────────────────────────── */
function drawSparkline(canvas, series, color) {
  if (!canvas || !series || series.length < 2) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 200, H = 70;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const vals = series.map(p => p.value);
  const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx - mn || 1;
  const px = i => i / (series.length-1) * (W-16) + 8;
  const py = v => H - 8 - (v-mn)/rng * (H-16);

  // Grid
  ctx.strokeStyle = 'rgba(28,171,226,0.08)'; ctx.lineWidth = 1;
  [0, .5, 1].forEach(t => {
    ctx.beginPath(); ctx.moveTo(0, 8+t*(H-16)); ctx.lineTo(W, 8+t*(H-16)); ctx.stroke();
  });

  // Fill area
  ctx.beginPath(); ctx.moveTo(px(0), py(vals[0]));
  series.forEach((p,i) => i > 0 && ctx.lineTo(px(i), py(p.value)));
  ctx.lineTo(px(series.length-1), H); ctx.lineTo(px(0), H); ctx.closePath();
  ctx.fillStyle = color + '22'; ctx.fill();

  // Line
  ctx.beginPath(); ctx.moveTo(px(0), py(vals[0]));
  series.forEach((p,i) => i > 0 && ctx.lineTo(px(i), py(p.value)));
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

  // Dots
  series.forEach((p,i) => {
    ctx.beginPath(); ctx.arc(px(i), py(p.value), 2.5, 0, Math.PI*2);
    ctx.fillStyle = color; ctx.fill();
  });

  // Year labels
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = '7px sans-serif'; ctx.textAlign = 'center';
  [0, Math.floor(series.length/2), series.length-1].forEach(i => {
    ctx.fillText(series[i].year, px(i), H-1);
  });
}

function drawBars(canvas, items, palette) {
  if (!canvas || !items || !items.length) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 400, H = 130;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const vals = items.map(it => it.value || 0);
  const mx = Math.max(...vals) || 1;
  const bw = Math.floor((W-40) / items.length) - 6;
  const maxH = H - 30;

  items.forEach((it, i) => {
    const x = 20 + i*(bw+6);
    const h = Math.max(2, (it.value||0)/mx * maxH);
    const y = H - 20 - h;
    ctx.fillStyle = palette[i % palette.length] + 'cc';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, bw, h, 3);
    else ctx.rect(x, y, bw, h);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(fmt(it.value, 1), x+bw/2, y-3);
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = '7px sans-serif';
    ctx.fillText((it.label||'').slice(0,7), x+bw/2, H-5);
  });
}

function drawCmpLine(canvas) {
  if (!canvas || !cmpList.length) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 400, H = 130;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const allPts = cmpList.flatMap(iso3 => getSeries(iso3, cmpIndKey));
  if (!allPts.length) return;
  const years = [...new Set(allPts.map(p => p.year))].sort();
  if (years.length < 2) return;
  const allVals = allPts.map(p => p.value);
  const mn = Math.min(...allVals), mx = Math.max(...allVals), rng = mx-mn || 1;
  const px = i => i / (years.length-1) * (W-20) + 10;
  const py = v => H - 18 - (v-mn)/rng * (H-28);

  // Grid
  ctx.strokeStyle = 'rgba(28,171,226,0.08)'; ctx.lineWidth = 1;
  [0, .5, 1].forEach(t => {
    ctx.beginPath(); ctx.moveTo(0, 10+t*(H-28)); ctx.lineTo(W, 10+t*(H-28)); ctx.stroke();
  });

  // Lines — no end-of-line labels (legend is below)
  cmpList.forEach((iso3, ci) => {
    const series = getSeries(iso3, cmpIndKey);
    if (series.length < 2) return;
    const col = CMP_PALETTE[ci % CMP_PALETTE.length];

    ctx.beginPath();
    series.forEach((p,i) => {
      const xi = px(years.indexOf(p.year)), yi = py(p.value);
      i === 0 ? ctx.moveTo(xi,yi) : ctx.lineTo(xi,yi);
    });
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

    series.forEach(p => {
      ctx.beginPath(); ctx.arc(px(years.indexOf(p.year)), py(p.value), 2.5, 0, Math.PI*2);
      ctx.fillStyle = col; ctx.fill();
    });
  });

  // X axis years
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = '7px sans-serif'; ctx.textAlign = 'center';
  years.filter((_,i) => i===0 || i===years.length-1 || years.length<=6).forEach(y => {
    ctx.fillText(y, px(years.indexOf(y)), H-3);
  });
}

/* ─────────────────────────────────────────────────────
   COUNTRY PANEL
───────────────────────────────────────────────────── */
function renderCountryPanel(iso3) {
  selIso3 = iso3;
  const info = getInfo(iso3);
  const ownKeys  = Object.keys(DB[iso3]?.s || {});
  const extraKeys = extraData.filter(d => d.data.some(r => r.iso3 === iso3)).flatMap(d => d.indicators);
  const allKeys  = [...new Set([...ownKeys, ...extraKeys])];

  const KPI = [
    {k:'gdppc', l:'GDP per capita (US$)'},
    {k:'pop18',  l:'Pop. under 18'},
    {k:'u5m',   l:'U5 Mortality (per 1k)'},
    {k:'ghlt',  l:'Gov. health (% GDP)'},
    {k:'gedu',  l:'Gov. education (% GDP)'},
    {k:'dbt',   l:'Gross debt (% GDP)'},
  ];

  const kpiHTML = KPI.map(({k,l}) => {
    const latest = getLatest(iso3, k);
    if (!latest) return '';
    return `<div class="glass kpi-card">
      <div class="kpi-lbl">${l}</div>
      <div class="kpi-val">${fmt(latest.value, 2)}</div>
      ${srcBadge(SOURCES[k]||'—')}
    </div>`;
  }).filter(Boolean).join('');

  const chartsHTML = allKeys.slice(0, 14).map(k => {
    const series = getSeries(iso3, k);
    if (!series.length) return '';
    const latest = series[series.length-1];
    const prev   = series[series.length-2];
    const delta  = prev ? ((latest.value - prev.value) / Math.abs(prev.value) * 100) : null;
    const src    = SOURCES[k] || 'Custom';
    const col    = srcColor(src);
    const uid    = `sp_${iso3}_${k}`;
    const csvKey = `${iso3}_${k}`;
    // Register CSV data safely (no JSON-in-onclick)
    registerCSV(csvKey, series);

    return `<div class="glass chart-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px">
        <div>
          <div class="chart-lbl" style="color:var(--txt)">${LABELS[k]||k}</div>
          ${srcBadge(src)}
        </div>
        <div style="text-align:right;margin-left:8px;flex-shrink:0">
          <div class="chart-val">${fmt(latest.value, 2)}</div>
          ${delta!=null ? `<div class="chart-delta ${delta>=0?'up':'down'}">${delta>=0?'▲':'▼'} ${Math.abs(delta).toFixed(1)}%</div>` : ''}
          <div style="font-size:8px;color:var(--txts)">${latest.year}</div>
        </div>
      </div>
      <canvas class="sparkline" id="${uid}"></canvas>
      <button class="dl-btn" data-csv-key="${csvKey}" data-csv-fn="${iso3}_${k}.csv">↓ CSV</button>
    </div>`;
  }).filter(Boolean).join('');

  document.getElementById('panel').innerHTML = `
    <div class="glass country-hdr">
      <div class="c-flag">${info.flag}</div>
      <div style="flex:1">
        <div class="c-name">${info.n}</div>
        <div class="c-region">${(info.region||'').toUpperCase()}</div>
        <div style="margin-top:5px;display:flex;gap:4px;flex-wrap:wrap">
          <span class="badge" style="background:rgba(28,171,226,.15);color:var(--ub)">${iso3}</span>
          <span class="badge" style="background:rgba(55,78,162,.15);color:var(--ud)">${ownKeys.length} indicatori</span>
        </div>
      </div>
    </div>
    <div class="kpi-grid">${kpiHTML}</div>
    <div class="charts-grid">${chartsHTML || `<div class="glass hint-txt" style="grid-column:span 2">Nessun dato per ${info.n}</div>`}</div>
  `;

  // Wire CSV buttons with data-attributes (no JSON-in-onclick)
  document.querySelectorAll('#panel .dl-btn[data-csv-key]').forEach(btn => {
    btn.addEventListener('click', () => dlCSV(btn.dataset.csvFn, btn.dataset.csvKey));
  });

  // Draw sparklines after DOM paint
  requestAnimationFrame(() => {
    allKeys.slice(0, 14).forEach(k => {
      const el = document.getElementById(`sp_${iso3}_${k}`);
      if (el) drawSparkline(el, getSeries(iso3, k), srcColor(SOURCES[k]||'Custom'));
    });
  });
}

/* ─────────────────────────────────────────────────────
   VIEW SWITCHING
───────────────────────────────────────────────────── */
function showGlobe() {
  selIso3 = null;
  document.getElementById('globe-wrap').classList.remove('split');
  document.getElementById('panel').className = '';
  document.getElementById('cmp-panel').className = '';
  document.getElementById('btn-back').style.display = 'none';
  document.getElementById('btn-cmp').classList.remove('active');
  document.getElementById('legend').style.display = 'block';
  document.getElementById('globe-hint').style.display = 'block';
}

function showCountry(iso3) {
  document.getElementById('globe-wrap').classList.add('split');
  document.getElementById('panel').className = 'visible';
  document.getElementById('cmp-panel').className = '';
  document.getElementById('btn-back').style.display = 'inline-block';
  document.getElementById('btn-cmp').classList.remove('active');
  document.getElementById('legend').style.display = 'none';
  document.getElementById('globe-hint').style.display = 'none';
  renderCountryPanel(iso3);
}

function showComparison() {
  document.getElementById('globe-wrap').classList.add('split');
  document.getElementById('panel').className = '';
  document.getElementById('cmp-panel').className = 'visible';
  document.getElementById('btn-back').style.display = 'inline-block';
  document.getElementById('btn-cmp').classList.add('active');
  document.getElementById('legend').style.display = 'none';
  document.getElementById('globe-hint').style.display = 'none';
  renderComparison();
}

/* ─────────────────────────────────────────────────────
   COMPARISON PANEL
───────────────────────────────────────────────────── */
function renderComparison() {
  const panel = document.getElementById('cmp-panel');
  const availInds = [...new Set(cmpList.flatMap(iso3 => Object.keys(DB[iso3]?.s||{})))]
    .sort((a,b) => (LABELS[a]||a).localeCompare(LABELS[b]||b));
  if (availInds.length && !availInds.includes(cmpIndKey)) cmpIndKey = availInds[0];

  const tags = allISO.map((iso3,i) => {
    const idx = cmpList.indexOf(iso3);
    const sel = idx >= 0;
    const col = sel ? CMP_PALETTE[idx % CMP_PALETTE.length] : '';
    const info = getInfo(iso3);
    return `<button class="cmp-tag${sel?' sel':''}" data-iso3="${iso3}"
      style="${sel?`border-color:${col};color:${col};background:${col}18`:''}"
      >${info.flag} ${iso3}</button>`;
  }).join('');

  const chips = cmpList.map((iso3,i) => {
    const col  = CMP_PALETTE[i % CMP_PALETTE.length];
    const info = getInfo(iso3);
    return `<div class="cmp-chip" style="background:${col}15;border-color:${col}55;color:${col}">
      ${info.flag} <span style="font-weight:600">${info.n}</span>
      <span class="rm" data-rm-iso3="${iso3}" style="color:${col}">&times;</span>
    </div>`;
  }).join('');

  const indSel = cmpList.length >= 2 && availInds.length ? `
    <div class="glass" style="padding:11px 15px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <span style="font-size:9px;color:var(--txts);letter-spacing:1px">INDICATORE:</span>
      <select class="ind-select" id="ind-sel">
        ${availInds.map(k=>`<option value="${k}"${k===cmpIndKey?' selected':''}>${LABELS[k]||k}</option>`).join('')}
      </select>
      ${srcBadge(SOURCES[cmpIndKey]||'—')}
    </div>` : '';

  // Register comparison CSV
  const buildCmpRows = () => {
    const years = [...new Set(cmpList.flatMap(iso3=>getSeries(iso3,cmpIndKey).map(p=>p.year)))].sort();
    return years.map(y => {
      const row = {year:y};
      cmpList.forEach(iso3 => { const pt=getSeries(iso3,cmpIndKey).find(p=>p.year===y); if(pt) row[iso3]=pt.value; });
      return row;
    });
  };
  if (cmpList.length >= 2) registerCSV('cmp_current', buildCmpRows());

  const legend = cmpList.length >= 2 ? `
    <div class="cmp-legend">
      ${cmpList.map((iso3,i) => {
        const col = CMP_PALETTE[i % CMP_PALETTE.length];
        const info = getInfo(iso3);
        return `<div class="cmp-legend-item">
          <span class="cmp-legend-swatch" style="background:${col}"></span>
          ${info.flag} ${info.n}
        </div>`;
      }).join('')}
    </div>` : '';

  const chartHTML = cmpList.length >= 2 ? `
    <div class="glass" style="padding:14px 16px">
      <div style="font-size:11px;font-weight:600;color:var(--txt);margin-bottom:8px">${LABELS[cmpIndKey]||cmpIndKey}</div>
      <div style="font-size:8.5px;color:var(--txts);letter-spacing:.8px;margin-bottom:6px">ULTIMO ANNO DISPONIBILE</div>
      <canvas id="cmp-bar" style="width:100%;height:130px;display:block"></canvas>
      <div style="font-size:8.5px;color:var(--txts);letter-spacing:.8px;margin:12px 0 5px">SERIE STORICA</div>
      <canvas id="cmp-line" style="width:100%;height:130px;display:block"></canvas>
      ${legend}
      <button class="dl-btn" id="btn-dl-cmp" style="margin-top:8px">↓ Scarica CSV</button>
    </div>`
    : `<div class="glass hint-txt">Seleziona almeno 2 paesi per confrontare</div>`;

  panel.innerHTML = `
    <div class="glass" style="padding:14px 16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
        <span style="font-size:10px;font-weight:700;color:var(--ub);letter-spacing:1.5px">SELEZIONA PAESI</span>
        <span class="badge" style="background:rgba(55,78,162,.15);color:var(--ud)">${cmpList.length} selezionati · ${allISO.length} disponibili</span>
        ${cmpList.length ? `<button class="btn" id="btn-desel" style="font-size:9px;padding:2px 8px">× Deseleziona</button>` : ''}
      </div>
      <input class="cmp-search" id="cmp-search" placeholder="Cerca per nome, ISO3 o regione…"/>
      <div class="cmp-countries" id="cmp-tags">${tags}</div>
      <div class="cmp-selected">${chips}</div>
    </div>
    ${indSel}
    ${chartHTML}
  `;

  // Wire events (no inline onclick)
  document.querySelectorAll('.cmp-tag').forEach(btn => {
    btn.addEventListener('click', () => toggleCmp(btn.dataset.iso3));
  });
  document.querySelectorAll('.rm[data-rm-iso3]').forEach(el => {
    el.addEventListener('click', () => toggleCmp(el.dataset.rmIso3));
  });
  const deselBtn = document.getElementById('btn-desel');
  if (deselBtn) deselBtn.addEventListener('click', () => { cmpList = []; renderComparison(); });
  const srch = document.getElementById('cmp-search');
  if (srch) srch.addEventListener('input', e => filterCmpTags(e.target.value));
  const indSel2 = document.getElementById('ind-sel');
  if (indSel2) indSel2.addEventListener('change', e => { cmpIndKey = e.target.value; renderComparison(); });
  const dlBtn = document.getElementById('btn-dl-cmp');
  if (dlBtn) dlBtn.addEventListener('click', () => dlCSV(`comparison_${cmpIndKey}.csv`, 'cmp_current'));

  if (cmpList.length >= 2) {
    requestAnimationFrame(() => {
      const barEl  = document.getElementById('cmp-bar');
      const lineEl = document.getElementById('cmp-line');
      if (barEl)  drawBars(barEl, cmpList.map((iso3,i) => ({
        label: (DB[iso3]?.n||iso3).slice(0,8),
        value: (getLatest(iso3, cmpIndKey)||{}).value
      })), CMP_PALETTE);
      if (lineEl) drawCmpLine(lineEl);
    });
  }
}

function filterCmpTags(q) {
  const lo = q.toLowerCase();
  document.querySelectorAll('.cmp-tag').forEach(btn => {
    const iso3 = btn.dataset.iso3, info = getInfo(iso3);
    const match = !lo || iso3.toLowerCase().includes(lo) || (info.n||'').toLowerCase().includes(lo) || (info.region||'').toLowerCase().includes(lo);
    btn.style.display = match ? '' : 'none';
  });
}

function toggleCmp(iso3) {
  const idx = cmpList.indexOf(iso3);
  idx >= 0 ? cmpList.splice(idx, 1) : cmpList.push(iso3);
  renderComparison();
}
