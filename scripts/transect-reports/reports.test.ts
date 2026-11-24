import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parse } from "csv-parse/sync";
import {
  buildReport,
  parseObservations,
  parseVisits,
  parseDate,
  seasonBounds,
  countTransectsInMunicipality,
  Row,
  Observation,
} from "./model";
import { parseContacts, manifestRows, encodeCsv, reportFilename } from "./io";
import { volunteerCredit, seasonHighlights, visitFrequency } from "./presentation";
import { speciesPhoto } from "./photos";
import { resolveMunicipalities, MunicipalityBoundaries } from "./municipalities";

const metadata = {
  "Transect ID": "T1",
  "Transect Name": "Vale das Borboletas",
  "Transect Code": "PT-1",
  Responsável: "Ana",
  Situação: "Válido",
};
const window = { start: "03-01", end: "09-30" };
const observation = (
  date: string,
  species = "Pieris rapae",
  count = 1,
  sampleId = date,
  status = "Accepted"
): Observation => ({ transectId: "T1", date, species, count, sampleId, status });
const report = (rows: Observation[], year = 2026) => buildReport(metadata, rows, [], year, window);
const csvRow = (overrides: Row = {}): Row => ({
  "Transect ID": "T1",
  Date: "01/03/2026",
  "Preferred Species Name": "Pieris rapae",
  "Abundance Count": "1",
  "Record status": "Accepted",
  ...overrides,
});

test("highlight photos use existing local files and credits, with supplementary photos and table fallback", () => {
  const melitaea = speciesPhoto("Melitaea deione");
  assert.ok(melitaea);
  assert.ok(melitaea.filename.endsWith("Nymphalidae/Melitaea deione.jpg"));
  assert.equal(melitaea.credit?.photographer, "Luís Cardoso");
  assert.ok(speciesPhoto("Euphydryas aurinia"));
  assert.equal(speciesPhoto("Callophrys avis"), null); // A credit entry alone is not a photo.
  const alcon = speciesPhoto("Phengaris alcon");
  assert.ok(alcon);
  assert.ok(alcon.filename.endsWith("imgs/results/phengaris-alcon.jpg"));
  assert.equal(alcon.credit?.license, "CC BY 2.0");
  assert.ok(
    speciesPhoto("Polyommatus icarus/celina")?.filename.endsWith("Polyommatus icarus_celina.jpg")
  );
  assert.equal(speciesPhoto("../../missing"), null);
});

test("volunteer credits prefer an explicit team, deduplicate names and fall back to the owner", () => {
  assert.deepEqual(report([]).volunteers, ["Ana"]);
  const team = buildReport(
    { ...metadata, Voluntários: " Ana Silva; Rui Santos; Ana Silva " },
    [],
    [],
    2026,
    window
  );
  assert.deepEqual(team.volunteers, ["Ana Silva", "Rui Santos"]);
  assert.equal(team.owner, "Ana");
  assert.deepEqual(
    buildReport({ ...metadata, Responsável: "" }, [], [], 2026, window).volunteers,
    []
  );
});

test("volunteer credits include only recorders for the transect and season window", () => {
  const visits = parseVisits([
    { "Transect ID": "T1", Date: "01/03/2026", "Recorded by": "Silva, Luís; Ana Costa" },
    { "Transect ID": "T1", Date: "30/09/2026", "Recorded by": "Luis Silva; Rui Santos" },
    { "Transect ID": "T1", Date: "01/10/2026", "Recorded by": "Outside the window" },
    { "Transect ID": "T1", Date: "01/03/2025", "Recorded by": "Previous year" },
    { "Transect ID": "T2", Date: "01/03/2026", "Recorded by": "Other route" },
    { "Transect ID": "T1", Date: "08/03/2026" },
  ]);
  const result = buildReport({ ...metadata, Voluntários: "Ana Costa" }, [], visits, 2026, window);
  assert.deepEqual(result.volunteers, ["Ana Costa", "Luís Silva", "Rui Santos"]);
  assert.equal(result.current.visits, 3);
});

test("strict dates and UTC gaps handle leap years without date rollover", () => {
  assert.equal(parseDate("29/02/2024"), "2024-02-29");
  for (const value of ["29/02/2025", "31/04/2026", "1/03/2026", "2026-03-01"])
    assert.throws(() => parseDate(value));
  assert.throws(() => seasonBounds(2026, { start: "09-30", end: "03-01" }));
});

test("reader-facing copy celebrates discoveries, omits zero threatened counts and credits volunteers by name", () => {
  assert.equal(volunteerCredit(["Luis Cardoso"]), "Luis Cardoso");
  assert.equal(volunteerCredit(["Ana", "Rui", "Luís"]), "Ana, Rui e Luís");
  assert.equal(volunteerCredit([]), "");
  const result = report([
    observation("2025-03-01"),
    observation("2026-03-01", "Colias crocea"),
    observation("2026-03-08", "Vanessa atalanta"),
  ]);
  const copy = seasonHighlights(result).join(" ");
  assert.match(copy, /2 novas espécies/);
  assert.match(copy, /intervalos de até 14 dias/);
  assert.doesNotMatch(copy, /Excelente regularidade/);
  assert.doesNotMatch(copy, /ameaçada|0 intervalo|\(s\)/);
  assert.equal(copy.includes("!"), false);
  const threatened = report([observation("2026-03-01", "Euchloe tagis")]);
  assert.match(seasonHighlights(threatened).join(" "), /1 espécie ameaçada/);
});

test("municipality highlights require one registered route and known municipality data", () => {
  const rows: Row[] = [
    { ...metadata, Concelho: "Penela" },
    { ...metadata, "Transect ID": "other", Concelho: " PENELA ", Estado: "Inativo" },
    { ...metadata, "Transect ID": "new", Concelho: "Penela", Situação: "Novo" },
    { ...metadata, "Transect ID": "void", Concelho: "Penela", Situação: "Nulo" },
    { ...metadata, "Transect ID": "elsewhere", Concelho: "Coimbra" },
  ];
  assert.equal(countTransectsInMunicipality(rows, "penela"), 3);
  assert.equal(countTransectsInMunicipality(rows, "Coimbra"), 1);
  assert.equal(countTransectsInMunicipality(rows, ""), null);
  assert.equal(countTransectsInMunicipality(rows, "Unknown"), null);
  assert.equal(countTransectsInMunicipality([rows[0], rows[0]], "Penela"), 1);
  const result = {
    ...report([observation("2026-03-01"), observation("2026-03-08")]),
    municipality: "Penela",
    municipalityTransectCount: 1,
  };
  assert.match(seasonHighlights(result).join(" "), /único transecto.*concelho de Penela/);
  for (const count of [null, 2, 3])
    assert.doesNotMatch(
      seasonHighlights({ ...result, municipalityTransectCount: count }).join(" "),
      /único transecto/
    );
  assert.doesNotMatch(
    seasonHighlights({ ...result, municipality: "" }).join(" "),
    /único transecto/
  );
});

test("municipalities use the declared projected CRS and official boundaries instead of locality labels", () => {
  const boundaries: MunicipalityBoundaries = JSON.parse(
    fs
      .readFileSync(
        path.join(__dirname, "../../public/data/portugal-municipalities.geojson"),
        "utf8"
      )
      .replace(/^\uFEFF/, "")
  );
  const result = resolveMunicipalities(
    [
      { ...metadata, Concelho: "A locality", "Spatial Refere": "38.72, -9.14" },
      { ...metadata, "Transect ID": "north", Concelho: "A park", "Spatial Refere": "41.30, -7.75" },
      { ...metadata, "Transect ID": "manual", Concelho: " PENELA " },
    ],
    boundaries
  );
  assert.equal(result.complete, true);
  assert.deepEqual(
    result.metadata.map(row => row.Concelho),
    ["Lisboa", "Vila Real", "Penela"]
  );
  assert.deepEqual(
    result.diagnostics.map(row => row.source),
    ["boundary", "boundary", "metadata"]
  );
  assert.throws(() =>
    resolveMunicipalities([], { ...boundaries, crs: { properties: { name: "EPSG:3857" } } })
  );
  assert.throws(() => resolveMunicipalities([], { ...boundaries, crs: undefined }));
});

test("unlocated or ambiguous routes cannot silently acquire a municipality", () => {
  const boundaries: MunicipalityBoundaries = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { Concelho: "EXAMPLE" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [2, 0],
              [2, 2],
              [0, 2],
              [0, 0],
            ],
          ],
        },
      },
    ],
  };
  const result = resolveMunicipalities(
    [
      { ...metadata, Concelho: "Example", "Spatial Refere": "10, 10" },
      { ...metadata, "Transect ID": "unknown", Concelho: "Unknown" },
    ],
    boundaries
  );
  assert.equal(result.complete, false);
  assert.deepEqual(
    result.metadata.map(row => row.Concelho),
    ["", ""]
  );
  const overlapping = resolveMunicipalities([{ ...metadata, "Spatial Refere": "1, 1" }], {
    ...boundaries,
    features: [...boundaries.features, ...boundaries.features],
  });
  assert.equal(overlapping.complete, false);
});

test("visit-frequency scale has explicit two-, three- and four-week thresholds", () => {
  const regularDates = (interval: number) => {
    const dates: string[] = [];
    for (
      let day = Date.parse("2026-03-01T00:00:00Z");
      day <= Date.parse("2026-09-30T00:00:00Z");
      day += interval * 86400000
    )
      dates.push(new Date(day).toISOString().slice(0, 10));
    return dates;
  };
  for (const [interval, expected] of [
    [14, 3],
    [15, 2],
    [21, 2],
    [22, 1],
    [28, 1],
    [29, 0],
  ]) {
    const assessment = visitFrequency(
      report(regularDates(interval).map(date => observation(date)))
    );
    assert.equal(assessment.level, expected);
    assert.equal(assessment.longestGapDays, interval);
  }
});

test("frequency grading cannot award a high rating to a short cluster or insufficient visits", () => {
  assert.equal(visitFrequency(report([])).level, null);
  assert.equal(visitFrequency(report([observation("2026-04-01")])).level, null);
  const cluster = visitFrequency(report([observation("2026-04-01"), observation("2026-04-08")]));
  assert.equal(cluster.level, 0);
  assert.match(cluster.label, /equipa/);
  assert.doesNotMatch(
    seasonHighlights(report([observation("2026-04-01"), observation("2026-04-08")])).join(" "),
    /Excelente regularidade/
  );
});

test("sections share visits, separate sample IDs on one date remain separate", () => {
  const result = report([
    observation("2026-03-01", "Pieris rapae", 2, "walk-1"),
    observation("2026-03-01", "Colias crocea", 3, "walk-1"),
    observation("2026-03-01", "Pieris rapae", 1, "walk-2"),
  ]);
  assert.equal(result.current.visits, 2);
  assert.equal(result.current.meanPerVisit, 3);
  assert.equal(result.species.find(item => item.name === "Pieris rapae")!.visits, 2);
});

test("weekly flight charts normalize by all visits, preserve true zeros and leave unvisited weeks empty", () => {
  const result = buildReport(
    metadata,
    [
      observation("2026-03-01", "Pieris rapae", 2, "first"),
      observation("2026-03-01", "Pieris rapae", 4, "first"),
      observation("2026-03-02", "Colias crocea", 9, "second"),
      observation("2026-03-08", "Pieris rapae", 0, "zero"),
      observation("2026-03-22", "Pieris rapae", 3, "late"),
    ],
    [{ transectId: "T1", date: "2026-03-03", sampleId: "empty" }],
    2026,
    window
  );
  const pieris = result.species.find(item => item.name === "Pieris rapae")!;
  assert.equal(result.weekly[0].visits, 3);
  assert.deepEqual(pieris.weeklyMean.slice(0, 4), [2, 0, null, 3]);
  assert.equal(result.weekly[1].visits, 1);
  assert.equal(result.weekly[2].visits, 0);
  for (const species of result.species) {
    assert.equal(species.weeklyMean.length, result.weekly.length);
    const weightedTotal = species.weeklyMean.reduce<number>(
      (sum, mean, index) => sum + (mean || 0) * result.weekly[index].visits,
      0
    );
    assert.equal(weightedTotal, species.individuals);
  }
});

test("weekly charts respect partial weeks, custom window boundaries and accepted-only filtering", () => {
  const result = buildReport(
    metadata,
    [
      observation("2026-03-02", "Pieris rapae", 50),
      observation("2026-03-03", "Pieris rapae", 2),
      observation("2026-03-09", "Pieris rapae", 4),
      observation("2026-03-10", "Pieris rapae", 3),
      observation("2026-03-10", "Pieris rapae", 9, "pending", "Unconfirmed"),
      observation("2026-03-11", "Pieris rapae", 50),
    ],
    [],
    2026,
    { start: "03-03", end: "03-10" },
    true
  );
  assert.deepEqual(result.weekly, [
    { start: "2026-03-03", end: "2026-03-09", visits: 2 },
    { start: "2026-03-10", end: "2026-03-10", visits: 2 },
  ]);
  assert.deepEqual(result.species[0].weeklyMean, [3, 1.5]);
  assert.equal(result.current.individuals, 9);
});

test("ID-less records merge with a known visit on the date and ambiguous records fail", () => {
  assert.equal(
    report([
      observation("2026-03-01", "Pieris rapae", 2, ""),
      observation("2026-03-01", "Colias crocea", 3, "v"),
    ]).current.visits,
    1
  );
  assert.equal(report([observation("2026-03-01", "Pieris rapae", 2, "")]).quality.dateFallbacks, 1);
  assert.throws(() =>
    report([
      observation("2026-03-01", "Pieris rapae", 2, ""),
      observation("2026-03-01", "Pieris rapae", 1, "a"),
      observation("2026-03-01", "Colias crocea", 1, "b"),
    ])
  );
  assert.throws(() =>
    report([
      observation("2026-03-01", "Pieris rapae", 1, "a"),
      observation("2026-03-02", "Pieris rapae", 1, "a"),
    ])
  );
});

test("zero, unknown, rejected and supplemental visits contribute effort without false species", () => {
  const result = buildReport(
    metadata,
    [
      observation("2026-03-01", "Pieris rapae", 0),
      observation("2026-03-15", "Pieris", 5),
      observation("2026-03-30", "Euchloe tagis", 2, "rejected", "Rejected"),
    ],
    [{ transectId: "T1", date: "2026-04-01", sampleId: "empty" }],
    2026,
    window,
    false,
    true
  );
  assert.equal(result.current.visits, 4);
  assert.equal(result.current.individuals, 0);
  assert.equal(result.current.speciesCount, 0);
  assert.equal(result.quality.unidentifiedIndividuals, 5);
  assert.equal(result.quality.rejectedRecords, 1);
  assert.equal(result.monthly.find(month => month.month === "2026-05")!.mean, null);
  assert.equal(result.monthly[0].mean, 0);
});

test("only gaps strictly over 14 days are flagged, including season edges separately", () => {
  const result = report([
    observation("2026-03-16"),
    observation("2026-03-30"),
    observation("2026-04-14"),
  ]);
  assert.deepEqual(
    result.gaps.filter(gap => gap.kind === "between"),
    [{ from: "2026-03-30", to: "2026-04-14", days: 15, kind: "between" }]
  );
  assert.equal(result.gaps[0].kind, "start");
  assert.equal(result.gaps[0].days, 15);
  assert.equal(result.gaps.at(-1)!.kind, "end");
  assert.equal(report([]).gaps[0].kind, "whole-season");
});

test("new species use all prior years, ignore future years, zeros and rejected records", () => {
  const result = report([
    observation("2024-02-01", "Pieris rapae"),
    observation("2025-04-01", "Euchloe tagis", 0),
    observation("2025-05-01", "Colias crocea", 1, "old", "Rejected"),
    observation("2026-03-01", "Pieris rapae"),
    observation("2026-03-15", "Euchloe tagis"),
    observation("2026-04-01", "Colias crocea"),
    observation("2027-03-01", "Euchloe tagis"),
  ]);
  assert.deepEqual(
    result.species
      .filter(item => item.isNew)
      .map(item => item.name)
      .sort(),
    ["Colias crocea", "Euchloe tagis"]
  );
  assert.equal(result.species.find(item => item.name === "Euchloe tagis")!.statusPT, "VU");
  assert.equal(result.history.length, 1); // 2024 has observations only outside the comparison window.
  assert.equal(result.history[0].year, 2025);
  assert.equal(report([observation("2026-03-01")]).species[0].isNew, false);
});

test("history comparisons use the same date window and exclude missing years", () => {
  const result = report([
    observation("2023-03-01", "Pieris rapae", 10),
    observation("2023-12-01", "Pieris rapae", 100),
    observation("2026-03-01", "Pieris rapae", 4),
    observation("2026-10-01", "Pieris rapae", 50),
  ]);
  assert.deepEqual(
    result.history.map(item => item.year),
    [2023]
  );
  assert.equal(result.history[0].meanPerVisit, 10);
  assert.equal(result.current.individuals, 4);
  assert.equal(result.quality.outOfWindowVisits, 1);
});

test("accepted-only excludes pending counts while retaining visits", () => {
  const result = buildReport(
    metadata,
    [
      observation("2026-03-01", "Euchloe tagis", 3, "p", "Unconfirmed"),
      observation("2026-03-02", "Pieris rapae", 2),
    ],
    [],
    2026,
    window,
    true
  );
  assert.equal(result.current.visits, 2);
  assert.equal(result.current.individuals, 2);
  assert.equal(result.quality.pendingRecords, 1);
});

test("occurrence IDs deduplicate safely, taxonomy corrections apply, malformed counts fail", () => {
  const row = csvRow({ "Occurrence ID": "a", "Preferred Species Name": "Polyommatus icarus" });
  const result = parseObservations([row, row, csvRow({ "Transect ID": "" })]);
  assert.equal(result.duplicates, 1);
  assert.equal(result.missingTransectRows, 1);
  assert.equal(result.observations[0].species, "Polyommatus icarus/celina");
  assert.throws(() => parseObservations([row, { ...row, "Abundance Count": "2" }]));
  for (const count of ["", "-1", "1.5", "oops"])
    assert.throws(() => parseObservations([csvRow({ "Abundance Count": count })]));
});

test("recipient mapping supports teams and flags missing addresses without inventing them", () => {
  const contacts = parseContacts(
    [
      { transect_id: "T1", name: "Ana", email: "ANA@example.org" },
      { transect_id: "T1", name: "Rui", email: "rui@example.org" },
    ],
    new Set(["T1"])
  );
  const rows = manifestRows([report([])], contacts);
  assert.equal(rows.length, 3);
  assert.equal(rows[1][6], "ana@example.org");
  assert.equal(rows[2][8], "ready");
  assert.equal(manifestRows([report([])], [])[1][8], "missing_email");
  assert.throws(() =>
    parseContacts([{ transect_id: "missing", name: "Ana", email: "" }], new Set(["T1"]))
  );
  assert.throws(() =>
    parseContacts(
      [{ transect_id: "T1", name: "Ana", email: "a@example.org;b@example.org" }],
      new Set(["T1"])
    )
  );
});

test("CSV cells preserve Portuguese text and neutralize formulas; filenames cannot traverse", () => {
  const encoded = encodeCsv([["=HYPERLINK(1)", 'São "João"', "@user"]]);
  const decoded = parse(encoded, { bom: true });
  assert.deepEqual(decoded[0], ["'=HYPERLINK(1)", 'São "João"', "'@user"]);
  const one = report([]);
  one.id = "../../a";
  one.name = "../../São João";
  assert.equal(path.basename(reportFilename(one)), reportFilename(one));
  assert.notEqual(reportFilename(one), reportFilename({ ...one, id: "a" }));
});

test("CLI generates only the selected Gateira fixture with correctly mapped recipients and refuses stale output", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "bms-reports-test-"));
  try {
    fs.writeFileSync(
      path.join(temp, "data.csv"),
      encodeCsv([
        ["Transect ID", "Date", "Preferred Species Name", "Abundance Count", "Record status"],
        ["330931", "01/03/2026", "Euchloe tagis", 2, "Accepted"],
      ])
    );
    fs.writeFileSync(
      path.join(temp, "metadata.csv"),
      encodeCsv([
        ["Transect ID", "Transect Name", "Situação", "Responsável", "Concelho"],
        ["330931", "Gateira", "Válido", "Ana", "Penela"],
        ["other", "Another registered route", "Válido", "", "Penela"],
      ])
    );
    fs.writeFileSync(
      path.join(temp, "contacts.csv"),
      encodeCsv([
        ["transect_id", "name", "email"],
        ["330931", "Coordenadora", "ana@example.org"],
      ])
    );
    fs.writeFileSync(
      path.join(temp, "visits.csv"),
      encodeCsv([
        ["Transect ID", "Date", "Recorded by"],
        ["330931", "01/03/2026", "Santos, Rui"],
      ])
    );
    const output = path.join(temp, "output");
    const args = [
      "--import",
      "tsx",
      "scripts/generate-transect-reports.ts",
      "--year",
      "2026",
      "--transect",
      "330931",
      "--data",
      path.join(temp, "data.csv"),
      "--metadata",
      path.join(temp, "metadata.csv"),
      "--contacts",
      path.join(temp, "contacts.csv"),
      "--visits",
      path.join(temp, "visits.csv"),
      "--out-dir",
      output,
    ];
    const run = () => spawnSync(process.execPath, args, { encoding: "utf8" });
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    const pdfs = fs.readdirSync(output).filter(file => file.endsWith(".pdf"));
    assert.equal(pdfs.length, 1);
    assert.ok(
      fs.readFileSync(path.join(output, pdfs[0])).subarray(0, 5).equals(Buffer.from("%PDF-"))
    );
    const recipients: Row[] = parse(fs.readFileSync(path.join(output, "recipients.csv")), {
      bom: true,
      columns: true,
    });
    assert.equal(recipients[0].recipient_email, "ana@example.org");
    assert.equal(recipients[0].report_file, pdfs[0]);
    const provenance = JSON.parse(fs.readFileSync(path.join(output, "run.json"), "utf8"));
    assert.equal(provenance.inputs.length, 5);
    assert.equal(provenance.reportCount, 1);
    const summary = JSON.parse(fs.readFileSync(path.join(output, "season-summary.json"), "utf8"));
    assert.equal(summary[0].municipalityTransectCount, 2); // Counts the unselected route too.
    assert.deepEqual(summary[0].volunteers, ["Ana", "Rui Santos"]);
    assert.equal(run().status, 1);
    assert.equal(
      fs.readdirSync(temp).filter(file => file.startsWith(".transect-reports-")).length,
      0
    );
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
