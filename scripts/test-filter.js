// Quick checks of the filter rules against the sample data.
const assert = require('assert');
const { filterPrograms, summarize } = require('../lib/filter');
const d = require('../data/sample_data.json');
const P = d.programs;

assert.strictEqual(filterPrograms(P, {}).length, P.length, 'no filters keeps everything');
assert.strictEqual(filterPrograms(P, { region: 'All' }).length, P.length, '"All" means no filter');
assert.ok(filterPrograms(P, { region: 'West' }).every((p) => p.region === 'West'), 'region filter');
assert.ok(filterPrograms(P, { ranking: 'Top 100' }).every((p) => p.rank_num <= 100), 'ranking filter');
assert.ok(filterPrograms(P, { toefl: '85' }).every((p) => p.toefl_min === null || p.toefl_min === undefined || p.toefl_min <= 85), 'toefl filter');
assert.ok(filterPrograms(P, { deadlineAfter: '2027-01-01' }).every((p) => !p.application_deadline || p.application_deadline >= '2027-01-01'), 'deadline filter keeps unknown');
const s = summarize(P);
assert.strictEqual(s.programs, P.length);
console.log('All filter tests passed:', s);
