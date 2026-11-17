// Filtering rules shared by the API. They mirror the BI View tab of the Excel workbook.

const EQ_FIELDS = {
  region: 'region',
  state: 'state',
  city: 'city',
  university: 'university',
  classification: 'research_classification',
  field: 'field',
  program: 'phd_program',
  funding: 'funding',
  gre: 'gre',
};

function isAll(v) {
  return v === undefined || v === null || v === '' || v === 'All';
}

function toNumber(v) {
  if (isAll(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function filterPrograms(programs, q = {}) {
  const rankCut = toNumber(String(q.ranking || '').replace('Top ', ''));
  const toefl = toNumber(q.toefl);
  const gpa = toNumber(q.gpa);
  const after = isAll(q.deadlineAfter) ? null : String(q.deadlineAfter).slice(0, 10);

  return programs.filter((p) => {
    for (const [param, key] of Object.entries(EQ_FIELDS)) {
      if (!isAll(q[param]) && p[key] !== q[param]) return false;
    }
    if (rankCut !== null && !(typeof p.rank_num === 'number' && p.rank_num <= rankCut)) return false;
    // Programs with no known deadline / minimum stay in the list (same as the workbook).
    if (after && p.application_deadline && p.application_deadline < after) return false;
    if (toefl !== null && typeof p.toefl_min === 'number' && p.toefl_min > toefl) return false;
    if (gpa !== null && typeof p.gpa_min === 'number' && p.gpa_min > gpa) return false;
    return true;
  });
}

function summarize(list) {
  const regions = ['Northeast', 'Midwest', 'South Atlantic', 'South Central', 'West'];
  const dated = list.map((p) => p.application_deadline).filter(Boolean).sort();
  return {
    programs: list.length,
    universities: new Set(list.map((p) => p.university)).size,
    funded: list.filter((p) => p.funding === 'Y').length,
    greNotRequired: list.filter((p) => p.gre === 'Not required').length,
    earliestDeadline: dated[0] || null,
    byRegion: regions.map((r) => ({
      region: r,
      programs: list.filter((p) => p.region === r).length,
      funded: list.filter((p) => p.region === r && p.funding === 'Y').length,
    })),
  };
}

function options(programs) {
  const uniq = (k) => [...new Set(programs.map((p) => p[k]).filter(Boolean))].sort();
  return {
    region: ['Northeast', 'Midwest', 'South Atlantic', 'South Central', 'West'],
    state: uniq('state'),
    city: uniq('city'),
    university: uniq('university'),
    ranking: ['Top 25', 'Top 50', 'Top 100'],
    classification: uniq('research_classification'),
    field: uniq('field'),
    program: uniq('phd_program'),
    funding: ['Y', 'N', 'Not stated'],
    gre: ['Required', 'Optional', 'Not required', 'Not accepted', 'Not stated'],
  };
}



// Builds a plain Excel workbook (no formulas) from the filtered programs, so people can work with it freely.
const ExcelJS = window.ExcelJS;

const PROGRAM_COLS = [
  ['Region', 'region', 16], ['State', 'state', 14], ['City', 'city', 16], ['University', 'university', 34],
  ['Ranking (QS 2027)', 'ranking', 12], ['Research Classification', 'research_classification', 14],
  ['Field', 'field', 26], ['PhD Program', 'phd_program', 40], ['PhD Length', 'phd_length', 24],
  ['Funding (Y, N)', 'funding', 12], ['Funding $', 'funding_amount', 28], ['Funding Description', 'funding_description', 50],
  ['Link', 'link', 40], ['Coordinator Name', 'coordinator_name', 28], ['Coordinator Email', 'coordinator_email', 30],
  ['GRE', 'gre', 14], ['TOEFL', 'toefl', 30], ['GPA', 'gpa', 20], ['Other Requirements', 'other_requirements', 50],
  ['Application Deadline', 'application_deadline', 14], ['Deadline Note', 'deadline_note', 36],
  ['Professors', 'professors_summary', 44], ['Official Sources', 'sources', 60], ['Verified On', 'verified_on', 12],
];
const PROF_COLS = [
  ['University', 'university', 30], ['PhD Program', 'phd_program', 36], ['Name', 'name', 26], ['Title', 'title', 26],
  ['Email', 'email', 30], ['Research Areas', 'research_areas', 60], ['Faculty Page', 'website', 45],
  ['Google Scholar', 'scholar', 45],
];
const LABELS = {
  region: 'Region', state: 'State', city: 'City', university: 'University', ranking: 'Ranking',
  classification: 'Research classification', field: 'Field', program: 'PhD program', funding: 'Funding',
  deadlineAfter: 'Deadline on or after', gre: 'GRE', toefl: 'My TOEFL score', gpa: 'My GPA',
};

function styleHeader(ws) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
  row.alignment = { vertical: 'middle', wrapText: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
}

async function buildWorkbook(programs, query, meta = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Finding PhD';
  wb.created = new Date();

  const ws = wb.addWorksheet('Programs');
  ws.columns = PROGRAM_COLS.map(([header, key, width]) => ({ header, key, width }));
  for (const p of programs) {
    const row = {};
    for (const [, key] of PROGRAM_COLS) row[key] = p[key] ?? 'Not stated';
    row.professors_summary = (p.professors || []).map((x) => `${x.name} (${x.title})`).join('; ') || 'Not stated';
    row.sources = (p.sources || []).join('\n');
    row.application_deadline = p.application_deadline ? new Date(p.application_deadline + 'T00:00:00Z') : 'Not stated';
    row.deadline_note = p.deadline_note || '';
    const r = ws.addRow(row);
    if (p.link && /^https?:/.test(p.link)) r.getCell('link').value = { text: p.link, hyperlink: p.link };
  }
  ws.getColumn('application_deadline').numFmt = 'mm/dd/yyyy';
  ws.eachRow((r, i) => { if (i > 1) r.alignment = { vertical: 'top', wrapText: true }; });
  styleHeader(ws);

  const wp = wb.addWorksheet('Professors');
  wp.columns = PROF_COLS.map(([header, key, width]) => ({ header, key, width }));
  for (const p of programs) {
    for (const x of p.professors || []) {
      wp.addRow({ university: p.university, phd_program: p.phd_program, name: x.name, title: x.title,
        email: x.email || 'Not stated', research_areas: x.research_areas, website: x.website || '', scholar: x.scholar || '' });
    }
  }
  wp.eachRow((r, i) => { if (i > 1) r.alignment = { vertical: 'top', wrapText: true }; });
  styleHeader(wp);

  const wi = wb.addWorksheet('About this export');
  wi.columns = [{ header: 'Item', key: 'k', width: 32 }, { header: 'Value', key: 'v', width: 100 }];
  wi.addRow({ k: 'Exported on', v: new Date().toISOString().slice(0, 10) });
  wi.addRow({ k: 'Programs in this file', v: programs.length });
  const used = Object.entries(query).filter(([k, v]) => LABELS[k] && v && v !== 'All');
  wi.addRow({ k: 'Filters used', v: used.length ? used.map(([k, v]) => `${LABELS[k]}: ${v}`).join('; ') : 'None (all programs)' });
  if (meta.criteria && meta.criteria['Run date']) wi.addRow({ k: 'Search run date', v: meta.criteria['Run date'] });
  wi.addRow({ k: 'Data source', v: 'Official university websites; Carnegie Classifications 2025; QS World University Rankings 2027' });
  wi.addRow({ k: 'Not stated', v: 'The official website does not say. Left blank on purpose instead of guessing.' });
  wi.addRow({ k: 'Tip', v: 'This file has no formulas: sort, filter, add columns or notes as you like. Confirm deadlines and stipends on the official page before applying.' });
  wi.getRow(1).font = { bold: true };
  wi.getColumn('v').alignment = { wrapText: true, vertical: 'top' };

  return wb.xlsx.writeBuffer();
}




// Static build: data is bundled with the page.
let DATA;
const getData = async () => DATA || (DATA = await fetch('data.json').then((x) => x.json()));
async function api(name, qs) {
  const d = await getData();
  const q = Object.fromEntries(new URLSearchParams(qs || ''));
  if (name === 'options') return { options: options(d.programs), criteria: d.criteria, notes: d.notes, source: d.source };
  if (name === 'excluded') return d.excluded;
  const list = filterPrograms(d.programs, q);
  return { summary: summarize(list), programs: list };
}

const form = document.getElementById('filters');
const tbody = document.querySelector('#results tbody');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const link = (u, t) => (u && /^https?:/.test(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t || u)}</a>` : esc(u || 'Not stated'));
const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not stated');
const pill = (f) => `<span class="pill ${f === 'Y' ? 'y' : f === 'N' ? 'n' : 'ns'}">${esc(f || 'Not stated')}</span>`;

document.getElementById('howBtn').onclick = () => {
  const h = document.getElementById('how');
  h.hidden = !h.hidden;
};

async function init() {
  const r = await api('options');
  for (const [name, values] of Object.entries(r.options)) {
    const sel = form.elements[name];
    if (!sel) continue;
    sel.innerHTML = '<option>All</option>' + values.map((v) => `<option>${esc(v)}</option>`).join('');
  }
  const c = r.criteria || {};
  document.getElementById('foot').textContent =
    `Data source: ${r.source}. Search run: ${c['Run date'] || 'n/a'}. ` + (r.notes || []).join(' ');
  const ex = await api('excluded');
  document.getElementById('excluded').innerHTML = ex.map((e) => `<li><b>${esc(e.university)}</b>: ${esc(e.reason)}</li>`).join('');
  load();
}

function params() {
  const p = new URLSearchParams();
  for (const el of form.elements) if (el.name && el.value && el.value !== 'All') p.set(el.name, el.value);
  return p.toString();
}

async function load() {
  const q = params();
  lastQuery = q;
  const r = await api('programs', q);
  const s = r.summary;
  document.getElementById('kpis').innerHTML = [
    ['Programs matching', s.programs], ['Universities', s.universities], ['Funded (Y)', s.funded],
    ['GRE not required', s.greNotRequired], ['Earliest deadline', s.earliestDeadline ? fmtDate(s.earliestDeadline) : 'None'],
  ].map(([l, v]) => `<div class="kpi"><div class="v">${esc(v)}</div><div class="l">${l}</div></div>`).join('');
  const max = Math.max(1, ...s.byRegion.map((b) => b.programs));
  document.getElementById('chart').innerHTML = '<h2>Matching programs by region</h2>' + s.byRegion.map((b) =>
    `<div class="bar-row"><span>${b.region}</span><div class="bar"><span style="width:${(b.programs / max) * 100}%"></span>${b.funded ? `<span class="f" style="width:${(b.funded / max) * 100}%"></span>` : ''}</div><span>${b.programs} (${b.funded} funded)</span></div>`
  ).join('');
  document.getElementById('count').textContent = `(${r.programs.length})`;
  tbody.innerHTML = r.programs.map((p, i) => `
    <tr class="row" data-i="${i}">
      <td><b>${esc(p.university)}</b><br><span style="color:#5b6475">${esc(p.city)}</span></td>
      <td>${esc(p.state)}</td><td>${esc(p.ranking)}</td><td>${esc(p.research_classification)}</td>
      <td>${esc(p.field)}</td><td>${link(p.link, p.phd_program)}</td><td>${pill(p.funding)}</td>
      <td>${esc(p.funding_amount)}</td><td>${esc(p.gre)}</td><td>${fmtDate(p.application_deadline)}</td>
    </tr>
    <tr class="detail" data-for="${i}" hidden><td colspan="10">${detail(p)}</td></tr>`).join('');
}

function detail(p) {
  const profs = (p.professors || []).map((x) => `<li><b>${esc(x.name)}</b>, ${esc(x.title)}. ${esc(x.research_areas)}<br>
    Email: ${x.email && x.email !== 'Not stated' ? `<a href="mailto:${esc(x.email)}">${esc(x.email)}</a>` : 'Not stated'}
    ${x.website ? ' · ' + link(x.website, 'Faculty page') : ''}${x.scholar ? ' · ' + link(x.scholar, 'Google Scholar') : ''}</li>`).join('');
  return `<div class="detail-grid">
    <div><h3>Funding</h3><p>${esc(p.funding_description)}</p></div>
    <div><h3>Length</h3><p>${esc(p.phd_length)}</p></div>
    <div><h3>Requirements</h3><p>GRE: ${esc(p.gre)}<br>TOEFL: ${esc(p.toefl)}<br>GPA: ${esc(p.gpa)}<br>${esc(p.other_requirements)}</p></div>
    <div><h3>Deadline</h3><p>${fmtDate(p.application_deadline)}${p.deadline_note ? '<br>' + esc(p.deadline_note) : ''}</p>
      <h3 style="margin-top:8px">Coordinator</h3><p>${esc(p.coordinator_name)}<br>${esc(p.coordinator_email)}</p></div>
    <div class="profs"><h3>Professors</h3><ul>${profs || '<li>Not stated</li>'}</ul></div>
    <div class="srcs profs"><h3>Official sources (verified ${esc(p.verified_on)})</h3><ul>${(p.sources || []).map((u) => `<li>${link(u)}</li>`).join('')}</ul></div>
  </div>`;
}

tbody.addEventListener('click', (e) => {
  if (e.target.closest('a')) return;
  const row = e.target.closest('tr.row');
  if (!row) return;
  const d = tbody.querySelector(`tr.detail[data-for="${row.dataset.i}"]`);
  d.hidden = !d.hidden;
});
form.addEventListener('change', load);
form.addEventListener('input', (e) => { if (e.target.type === 'number') load(); });
form.addEventListener('reset', () => setTimeout(load, 0));
init();


let lastQuery = '';
const exportBtn = document.getElementById('export');
const exportMsg = document.getElementById('exportMsg');
let downloads = null;
(async () => {
  try { downloads = window.claude ? await window.claude.use('downloads') : null; } catch (e) { downloads = null; }
  // On claude.ai the page needs the downloads capability; on a normal site (e.g. GitHub Pages) the browser saves the file.
  if (!downloads && window.claude) { exportBtn.hidden = true; exportMsg.textContent = 'Excel download is not available in this view.'; }
})();
exportBtn.onclick = async (ev) => {
  ev.preventDefault();
  if (!downloads && window.claude) return;
  exportBtn.disabled = true; exportMsg.textContent = 'Preparing file...';
  try {
    const d = await getData();
    const q = Object.fromEntries(new URLSearchParams(lastQuery));
    const list = filterPrograms(d.programs, q);
    const buf = await buildWorkbook(list, q, d);
    const filename = `PhD_Programs_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    if (downloads) await downloads.save({ filename, data: blob });
    else {
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    exportMsg.textContent = `Saved ${list.length} programs.`;
  } catch (e) {
    exportMsg.textContent = e && e.code === 'declined' ? 'Download canceled.' : 'Could not save the file' + (e && e.message ? ': ' + e.message : '.');
  } finally { exportBtn.disabled = false; }
};
