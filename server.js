require('dotenv').config();
const express = require('express');
const path = require('path');
const { loadData } = require('./lib/data');
const { filterPrograms, summarize, options } = require('./lib/filter');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Filter options for the dropdowns, plus search criteria and notes.
app.get('/api/options', async (req, res, next) => {
  try {
    const d = await loadData();
    res.json({ options: options(d.programs), criteria: d.criteria, notes: d.notes, source: d.source });
  } catch (e) { next(e); }
});

// Filtered programs and summary. Query params: region, state, city, university, ranking,
// classification, field, program, funding, deadlineAfter (YYYY-MM-DD), gre, toefl, gpa.
app.get('/api/programs', async (req, res, next) => {
  try {
    const d = await loadData();
    const list = filterPrograms(d.programs, req.query);
    res.json({ summary: summarize(list), programs: list });
  } catch (e) { next(e); }
});

// Universities checked but left out, with the reason.
app.get('/api/excluded', async (req, res, next) => {
  try {
    const d = await loadData();
    res.json(d.excluded);
  } catch (e) { next(e); }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Finding PhD running at http://localhost:${PORT}`));
}

module.exports = app;
