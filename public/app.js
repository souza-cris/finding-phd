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
  const r = await fetch('/api/options').then((x) => x.json());
  for (const [name, values] of Object.entries(r.options)) {
    const sel = form.elements[name];
    if (!sel) continue;
    sel.innerHTML = '<option>All</option>' + values.map((v) => `<option>${esc(v)}</option>`).join('');
  }
  const c = r.criteria || {};
  document.getElementById('foot').textContent =
    `Data source: ${r.source}. Search run: ${c['Run date'] || 'n/a'}. ` + (r.notes || []).join(' ');
  const ex = await fetch('/api/excluded').then((x) => x.json());
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
  document.getElementById('export').href = '/api/export' + (q ? '?' + q : '');
  const r = await fetch('/api/programs?' + q).then((x) => x.json());
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
