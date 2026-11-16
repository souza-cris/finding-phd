// Builds a static copy of the app in dist/ (no server, no MongoDB): the data is bundled as data.json,
// filters run in the browser, and the Excel file is built in the browser with ExcelJS from cdnjs.
// This is the version published as a claude.ai artifact. Downloads there go through the artifact
// "downloads" capability; where it is missing the Download Excel button is hidden.
//
// Usage: node scripts/build-static.js [data file]   (default: data/master_data.json)
// dist/ is git-ignored because it contains the real search results.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const dataFile = path.resolve(root, process.argv[2] || 'data/master_data.json');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

function replaceOnce(text, from, to) {
  if (!text.includes(from)) throw new Error(`Build step failed: text not found: ${from.slice(0, 60)}`);
  return text.replace(from, to);
}

const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const data = {
  programs: raw.programs || [],
  excluded: raw.not_found || [],
  criteria: raw.criteria || {},
  notes: raw.notes || [],
  source: `Search results of ${(raw.criteria || {})['Run date'] || 'n/a'}`,
};

const filter = replaceOnce(read('lib/filter.js'), 'module.exports = { filterPrograms, summarize, options };', '');
let exporter = replaceOnce(read('lib/export.js'), "const ExcelJS = require('exceljs');", 'const ExcelJS = window.ExcelJS;');
exporter = replaceOnce(exporter, 'module.exports = { buildWorkbook };', '');

const shim = `
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
`;

let app = read('public/app.js');
app = replaceOnce(app, "await fetch('/api/options').then((x) => x.json())", "await api('options')");
app = replaceOnce(app, "await fetch('/api/excluded').then((x) => x.json())", "await api('excluded')");
app = replaceOnce(app, "  document.getElementById('export').href = '/api/export' + (q ? '?' + q : '');\n", '  lastQuery = q;\n');
app = replaceOnce(app, "await fetch('/api/programs?' + q).then((x) => x.json())", "await api('programs', q)");
if (app.includes('/api/')) throw new Error('Build step failed: app.js still calls the server API');

const download = `
let lastQuery = '';
const exportBtn = document.getElementById('export');
const exportMsg = document.getElementById('exportMsg');
let downloads = null;
(async () => {
  try { downloads = window.claude ? await window.claude.use('downloads') : null; } catch (e) { downloads = null; }
  if (!downloads) { exportBtn.hidden = true; exportMsg.textContent = 'Excel download is not available in this view.'; }
})();
exportBtn.onclick = async (ev) => {
  ev.preventDefault();
  if (!downloads) return;
  exportBtn.disabled = true; exportMsg.textContent = 'Preparing file...';
  try {
    const d = await getData();
    const q = Object.fromEntries(new URLSearchParams(lastQuery));
    const list = filterPrograms(d.programs, q);
    const buf = await buildWorkbook(list, q, d);
    await downloads.save({ filename: \`PhD_Programs_\${new Date().toISOString().slice(0, 10)}.xlsx\`, data: new Blob([buf]) });
    exportMsg.textContent = \`Saved \${list.length} programs.\`;
  } catch (e) {
    exportMsg.textContent = e && e.code === 'declined' ? 'Download canceled.' : 'Could not save the file' + (e && e.message ? ': ' + e.message : '.');
  } finally { exportBtn.disabled = false; }
};
`;

let html = read('public/index.html');
html = replaceOnce(html, '<a id="export" class="btn" href="/api/export" download>Download Excel</a>',
  '<span><span id="exportMsg" class="export-msg"></span> <button id="export" class="btn" type="button">Download Excel</button></span>');
html = replaceOnce(html, '<script src="app.js"></script>',
  '<script src="https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js"></script>\n  <script src="app.js"></script>');

const css = read('public/style.css') +
  '\n.export-msg { color: var(--muted); font-size: 13px; margin-right: 8px; }\n.btn:disabled { opacity: .6; cursor: wait; }\n';

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'img'), { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), html);
fs.writeFileSync(path.join(dist, 'style.css'), css);
fs.writeFileSync(path.join(dist, 'app.js'), [filter, exporter, shim, app, download].join('\n'));
fs.writeFileSync(path.join(dist, 'data.json'), JSON.stringify(data));
const photo = path.join(root, 'public/img/campus.jpg');
if (fs.existsSync(photo)) fs.copyFileSync(photo, path.join(dist, 'img/campus.jpg'));
console.log(`Built dist/ with ${data.programs.length} programs from ${path.relative(root, dataFile)}`);
