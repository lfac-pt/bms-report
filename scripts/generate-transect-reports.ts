/** Bulk season recaps. Run `npm run reports:transects -- --help` for usage. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parseArgs } from "node:util";
import {
  parseObservations,
  parseVisits,
  buildReport,
  seasonBounds,
  countTransectsInMunicipality,
} from "./transect-reports/model";
import {
  readCsv,
  parseContacts,
  reportFilename,
  manifestRows,
  encodeCsv,
} from "./transect-reports/io";
import { renderReport } from "./transect-reports/pdf";
import { resolveMunicipalities } from "./transect-reports/municipalities";

const HELP = `Generate Portuguese PDF season reports and a recipient manifest.

  npm run reports:transects -- --year 2026 [options]

  --year YYYY          Required season year
  --data PATH          Occurrences CSV (default: raw-data/all.csv)
  --metadata PATH      Transect metadata (default: raw-data/metadata.csv)
  --municipalities PATH Municipality boundaries (default: public/data/portugal-municipalities.geojson)
  --contacts PATH      Optional CSV: transect_id,name,email (one recipient per row)
  --visits PATH        Optional CSV: Transect ID,Transect Sample ID,Date
  --transect ID        Only this Transect ID; repeat to select several
  --start MM-DD        First day included (default: 03-01)
  --end MM-DD          Last day included (default: 09-30)
  --accepted-only      Include only Accepted sightings in species counts
  --out-dir PATH       New/empty directory (default: output/pdf/transects/YYYY)
  --help               Show this help

Defaults include valid/new mainland transects with a visit in the chosen year,
including those whose visits all fall outside the reporting window. Explicit
--transect selections can include routes with no visits that year. No email is sent.
Existing non-empty output directories are refused to avoid mixing report batches.
`;

function main() {
  const { values } = parseArgs({
    options: {
      year: { type: "string" },
      data: { type: "string", default: "raw-data/all.csv" },
      metadata: { type: "string", default: "raw-data/metadata.csv" },
      municipalities: { type: "string", default: "public/data/portugal-municipalities.geojson" },
      contacts: { type: "string" },
      visits: { type: "string" },
      transect: { type: "string", multiple: true },
      start: { type: "string", default: "03-01" },
      end: { type: "string", default: "09-30" },
      "accepted-only": { type: "boolean", default: false },
      "out-dir": { type: "string" },
      help: { type: "boolean", default: false },
    },
    strict: true,
    allowPositionals: false,
  });
  if (values.help) {
    console.log(HELP);
    return;
  }
  if (!values.year || !/^\d{4}$/.test(values.year))
    throw new Error("Provide --year YYYY (see --help)");
  const year = Number(values.year);
  const window = { start: values.start!, end: values.end! };
  seasonBounds(year, window);
  const output = path.resolve(values["out-dir"] || `output/pdf/transects/${year}`);
  if (
    fs.existsSync(output) &&
    (!fs.statSync(output).isDirectory() || fs.readdirSync(output).length > 0)
  ) {
    throw new Error(
      "Output directory must be new or empty; choose another --out-dir for a fresh batch"
    );
  }
  const municipalityRegistry = resolveMunicipalities(
    readCsv(values.metadata!, ["Transect ID", "Transect Name", "Situação"]),
    JSON.parse(fs.readFileSync(values.municipalities!, "utf8").replace(/^\uFEFF/, ""))
  );
  const metadata = municipalityRegistry.metadata;
  const ids = new Set<string>();
  for (const row of metadata) {
    const id = row["Transect ID"].trim();
    if (!id || ids.has(id)) throw new Error(`Missing or duplicate Transect ID in metadata: ${id}`);
    ids.add(id);
  }
  const parsed = parseObservations(
    readCsv(values.data!, ["Transect ID", "Date", "Preferred Species Name", "Abundance Count"])
  );
  const visits = values.visits ? parseVisits(readCsv(values.visits, ["Transect ID", "Date"])) : [];
  const contacts = values.contacts
    ? parseContacts(readCsv(values.contacts, ["transect_id", "name", "email"]), ids)
    : [];
  const requested = new Set(values.transect || []);
  for (const id of requested) {
    if (!ids.has(id)) throw new Error(`Unknown --transect ID: ${id}`);
  }
  const eligible = metadata.filter(row => ["Válido", "Novo"].includes(row["Situação"].trim()));
  const eligibleIds = new Set(eligible.map(row => row["Transect ID"]));
  for (const id of requested) {
    if (!eligibleIds.has(id))
      throw new Error(`Transect ${id} is not marked Válido or Novo in metadata`);
  }
  const visitedThisYear = new Set(
    [...parsed.observations, ...visits]
      .filter(row => row.date.startsWith(`${year}-`))
      .map(row => row.transectId)
  );
  const selected = eligible.filter(row =>
    requested.size ? requested.has(row["Transect ID"]) : visitedThisYear.has(row["Transect ID"])
  );
  if (!selected.length) throw new Error(`No eligible transects found for ${year}`);
  const reports = selected
    .map(row =>
      buildReport(
        row,
        parsed.observations,
        visits,
        year,
        window,
        values["accepted-only"],
        !!values.visits,
        municipalityRegistry.complete
          ? countTransectsInMunicipality(metadata, row.Concelho || "")
          : null
      )
    )
    .sort((a, b) => a.name.localeCompare(b.name, "pt"));
  const manifest = manifestRows(reports, contacts);
  const inputPaths = [
    values.data!,
    values.metadata!,
    values.municipalities!,
    values.contacts,
    values.visits,
  ].filter((value): value is string => !!value);
  const provenance = {
    generatedAt: new Date().toISOString(),
    year,
    window,
    acceptedOnly: values["accepted-only"],
    reportCount: reports.length,
    reportsWithoutVolunteerNames: reports.filter(report => !report.volunteers.length).length,
    municipalities: {
      boundaryResolved: municipalityRegistry.diagnostics.filter(item => item.source === "boundary")
        .length,
      metadataResolved: municipalityRegistry.diagnostics.filter(item => item.source === "metadata")
        .length,
      unresolved: municipalityRegistry.diagnostics.filter(item => item.source === "unresolved"),
      corrections: municipalityRegistry.diagnostics.filter(
        item => item.original !== item.municipality
      ),
      uniquenessClaimsEnabled: municipalityRegistry.complete,
    },
    coverArtwork: {
      asset: "scripts/transect-reports/assets/butterfly-engraving.png",
      sha256: crypto
        .createHash("sha256")
        .update(
          fs.readFileSync(path.join(__dirname, "transect-reports/assets/butterfly-engraving.png"))
        )
        .digest("hex"),
    },
    recipientRows: manifest.length - 1,
    duplicateOccurrencesRemoved: parsed.duplicates,
    skippedRowsWithoutTransectId: parsed.missingTransectRows,
    unmappedDataTransects: [
      ...new Set([...parsed.observations, ...visits].map(row => row.transectId)),
    ].filter(id => !ids.has(id)),
    conservation: {
      scope: "Portugal continental",
      categories: ["CR", "EN", "VU"],
      source: "src/utils/endangered_pt.ts",
      sha256: crypto
        .createHash("sha256")
        .update(fs.readFileSync(path.join(__dirname, "../src/utils/endangered_pt.ts")))
        .digest("hex"),
      reference: "https://lvinvertebrados.pt/",
      note: "Project-curated snapshot; verify updates before distribution. Unlisted does not mean Least Concern.",
    },
    inputs: inputPaths.map(filename => ({
      file: path.basename(filename),
      sha256: crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex"),
    })),
  };
  // Publish the batch only after every PDF and manifest has been written successfully.
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const staging = fs.mkdtempSync(path.join(path.dirname(output), ".transect-reports-"));
  try {
    for (const report of reports) {
      fs.writeFileSync(path.join(staging, reportFilename(report)), renderReport(report));
    }
    fs.writeFileSync(path.join(staging, "recipients.csv"), encodeCsv(manifest));
    fs.writeFileSync(
      path.join(staging, "season-summary.json"),
      JSON.stringify(reports, null, 2) + "\n"
    );
    fs.writeFileSync(path.join(staging, "run.json"), JSON.stringify(provenance, null, 2) + "\n");
    if (fs.existsSync(output)) fs.rmdirSync(output);
    fs.renameSync(staging, output);
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  const missingEmail = manifest.slice(1).filter(row => row[8] !== "ready").length;
  console.log(`Generated ${reports.length} PDF(s) in ${output}`);
  console.log(
    `recipients.csv: ${manifest.length - 1} recipient row(s); ${missingEmail} need contact details.`
  );
  console.log(`Removed ${parsed.duplicates} duplicate occurrence(s). No email sent.`);
  if (parsed.missingTransectRows)
    console.warn(
      `Skipped ${parsed.missingTransectRows} occurrence row(s) without a Transect ID; see run.json.`
    );
}

try {
  main();
} catch (error) {
  console.error(
    `Report generation failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
}
