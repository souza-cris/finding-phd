// Builds a plain Excel workbook (no formulas) from the filtered programs, so people can work with it freely.
const ExcelJS = require('exceljs');

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

module.exports = { buildWorkbook };
