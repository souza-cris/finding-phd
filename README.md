# Finding PhD

A small web app to explore US PhD programs with the same filters as the BI View tab of the PhD search workbook: Region, State, City, University, QS ranking range, Carnegie research classification, Field, PhD program, Funding, Deadline on or after, GRE, My TOEFL score and My GPA. It shows a summary, a chart by region, and the matching programs; click a row to see funding, requirements, professors and the official pages used.

Program data comes only from official university websites (gathered by the `phd-program-search` skill). Research classification is from Carnegie Classifications 2025 and ranking from the QS World University Rankings 2027.

## Data

* The app reads from **MongoDB** (database `phd_search`, collections `programs`, `excluded`, `meta`) when `MONGODB_URI` is set.
* Without `MONGODB_URI` it reads `data/master_data.json` if present, otherwise `data/sample_data.json` (fictional sample data, safe to share).
* The real `data/master_data.json` is git-ignored because this repository is public. Keep the real data in MongoDB or on your computer.

## Run it locally

```bash
npm install
cp .env.example .env      # then put your MongoDB connection string in .env
npm start                 # open http://localhost:3000
```

No MongoDB? Skip the `.env` step: the app runs on the sample data (or your local `data/master_data.json`).

## Load or reload the data into MongoDB

```bash
MONGODB_URI="mongodb+srv://..." npm run seed -- "path/to/master_data.json"
```

`master_data.json` is the file the weekly search keeps in `FINDING PHD/_phd_search_data/`. The seed script replaces the collections with the file's contents. Your computer's IP address must be on the Atlas project's IP access list.

## API

| Endpoint | Returns |
|---|---|
| `GET /api/options` | Values for each filter dropdown, the search criteria and notes |
| `GET /api/programs?region=...&state=...&ranking=Top%20100&funding=Y&deadlineAfter=2026-12-01&toefl=100&gpa=3.5` | Summary (counts, earliest deadline, by region) and the matching programs |
| `GET /api/excluded` | Universities checked but left out, with the reason |

Filter parameters: `region`, `state`, `city`, `university`, `ranking` (`Top 25`, `Top 50`, `Top 100`), `classification`, `field`, `program`, `funding` (`Y`, `N`, `Not stated`), `deadlineAfter` (YYYY-MM-DD), `gre`, `toefl`, `gpa`. Programs with no stated deadline, TOEFL minimum or GPA minimum stay in the results, as in the workbook.

## Tests

```bash
npm test
```

## Notes

* Always confirm deadlines and stipends on the official program page before applying.
* Never commit `.env` or real data while the repository is public.
| `GET /api/export` | Same filters as `/api/programs`; returns an Excel file (Programs, Professors, About this export) with no formulas |

## Campus photo

The left strip shows `public/img/campus.jpg` (any campus photo you have the right to use). Without it, the strip is solid green. Put the photo credit in the `photo-credit` element in `public/index.html`.
