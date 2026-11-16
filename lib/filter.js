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

module.exports = { filterPrograms, summarize, options };
