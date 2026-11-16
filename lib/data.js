// Loads the program data from MongoDB (when MONGODB_URI is set) or from a local JSON file.
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const DB_NAME = process.env.MONGODB_DB || 'phd_search';
let client;

async function fromMongo() {
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
  }
  const db = client.db(DB_NAME);
  const programs = await db.collection('programs').find({}, { projection: { _id: 0 } }).toArray();
  const excluded = await db.collection('excluded').find({}, { projection: { _id: 0 } }).toArray();
  const meta = (await db.collection('meta').findOne({ _id: 'search' })) || {};
  return { programs, excluded, criteria: meta.criteria || {}, notes: meta.notes || [], source: 'MongoDB' };
}

function fromFile() {
  const candidates = [process.env.DATA_FILE, 'data/master_data.json', 'data/sample_data.json']
    .filter(Boolean)
    .map((f) => path.resolve(__dirname, '..', f));
  const file = candidates.find((f) => fs.existsSync(f));
  if (!file) throw new Error('No data: set MONGODB_URI or add data/master_data.json');
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    programs: d.programs || [],
    excluded: d.not_found || [],
    criteria: d.criteria || {},
    notes: d.notes || [],
    source: path.basename(file),
  };
}

async function loadData() {
  return process.env.MONGODB_URI ? fromMongo() : fromFile();
}

module.exports = { loadData };
