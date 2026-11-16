// Loads master_data.json (from the weekly search) into MongoDB.
// Usage: MONGODB_URI="mongodb+srv://..." node scripts/seed.js [path/to/master_data.json]
require('dotenv').config();
const fs = require('fs');
const { MongoClient } = require('mongodb');

async function main() {
  const file = process.argv[2] || 'data/master_data.json';
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI (see .env.example)');
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'phd_search');

  const programs = (d.programs || []).map((p) => ({ ...p, _id: `${p.university} | ${p.phd_program}` }));
  await db.collection('programs').deleteMany({});
  if (programs.length) await db.collection('programs').insertMany(programs);
  await db.collection('excluded').deleteMany({});
  if ((d.not_found || []).length) await db.collection('excluded').insertMany(d.not_found);
  await db.collection('meta').replaceOne(
    { _id: 'search' },
    { _id: 'search', criteria: d.criteria || {}, notes: d.notes || [], changes: d.changes || [], loaded_at: new Date() },
    { upsert: true }
  );
  console.log(`Loaded ${programs.length} programs and ${(d.not_found || []).length} exclusions into ${db.databaseName}`);
  await client.close();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
