require('dotenv').config();
const express = require('express');
const path = require('path');
const { loadData } = require('./lib/data');
const { filterPrograms, summarize, options } = require('./lib/filter');
const { buildWorkbook } = require('./lib/export');

const app = express();

// Password protection: active only when APP_USER and APP_PASSWORD are set (for example on Render).
const crypto = require('crypto');
function same(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
if (process.env.APP_USER && process.env.APP_PASSWORD) {
  app.use((req, res, next) => {
    const [scheme, encoded] = (req.headers.authorization || '').split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString();
      const i = decoded.indexOf(':');
      if (i > -1 && same(decoded.slice(0, i), process.env.APP_USER) && same(decoded.slice(i + 1), process.env.APP_PASSWORD)) return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="Finding PhD", charset="UTF-8"');
    res.status(401).send('Login required');
  });
}

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

// Excel download of the programs that match the current filters (same query params as /api/programs).
app.get('/api/export', async (req, res, next) => {
  try {
    const d = await loadData();
    const list = filterPrograms(d.programs, req.query);
    const buf = await buildWorkbook(list, req.query, d);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="PhD_Programs_${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(Buffer.from(buf));
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
