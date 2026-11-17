import fs from "node:fs";
import { parse } from "csv-parse/sync";
import { Row, TransectReport } from "./model";

export function readCsv(filename: string, required: string[]): Row[] {
  let headers: string[] = [];
  const rows: Row[] = parse(fs.readFileSync(filename, "utf8"), {
    bom: true,
    columns: (values: string[]) => {
      headers = values.map(value => value.trim());
      if (new Set(headers).size !== headers.length)
        throw new Error(`Duplicate CSV headers: ${filename}`);
      return headers;
    },
    skip_empty_lines: true,
    trim: true,
  });
  for (const key of required) {
    if (!headers.includes(key)) throw new Error(`${filename}: missing column ${key}`);
  }
  return rows;
}

export interface Contact {
  transectId: string;
  name: string;
  email: string;
}

export function parseContacts(rows: Row[], knownIds: Set<string>): Contact[] {
  const result: Contact[] = [];
  const seen = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const transectId = row.transect_id?.trim() || "";
    const name = row.name?.trim() || "";
    const email = row.email?.trim().toLowerCase() || "";
    if (!knownIds.has(transectId)) throw new Error(`Contact row ${index + 2}: unknown transect_id`);
    if (email && !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)) {
      throw new Error(`Contact row ${index + 2}: invalid email; use one address per row`);
    }
    const key = JSON.stringify([transectId, email, name]);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ transectId, name, email });
  }
  return result;
}

/** Neutralize formula cells for manifests opened in Excel or LibreOffice. */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function encodeCsv(rows: (string | number)[][]): string {
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function reportFilename(report: TransectReport): string {
  const slug = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70);
  // Encode every ID codepoint, avoiding filename collisions after sanitization.
  const key = /^[a-zA-Z0-9]+$/.test(report.id)
    ? report.id
    : "encoded-" +
      Array.from(report.id)
        .map(char => char.codePointAt(0)!.toString(16))
        .join("-");
  return `${report.current.year}-${slug(report.name) || "transecto"}-${key}.pdf`;
}

export function manifestRows(
  reports: TransectReport[],
  contacts: Contact[]
): (string | number)[][] {
  const rows: (string | number)[][] = [
    [
      "year",
      "transect_id",
      "transect_code",
      "transect_name",
      "report_file",
      "recipient_name",
      "recipient_email",
      "contact_source",
      "delivery_status",
      "visits",
      "species",
      "new_species",
      "threatened_species_pt",
      "gaps_over_14_days",
      "season_edge_gaps_over_14_days",
      "pending_records",
    ],
  ];
  for (const report of reports) {
    const mapped = contacts.filter(contact => contact.transectId === report.id);
    const recipients = mapped.length
      ? mapped
      : [{ transectId: report.id, name: report.owner, email: "" }];
    for (const recipient of recipients) {
      rows.push([
        report.current.year,
        report.id,
        report.code,
        report.name,
        reportFilename(report),
        recipient.name,
        recipient.email,
        mapped.length ? "contacts" : "metadata",
        recipient.email ? "ready" : recipient.name ? "missing_email" : "missing_contact",
        report.current.visits,
        report.current.speciesCount,
        report.species.filter(species => species.isNew).length,
        report.species.filter(species => ["VU", "EN", "CR"].includes(species.statusPT || ""))
          .length,
        report.gaps.filter(gap => gap.kind === "between").length,
        report.gaps.filter(gap => gap.kind !== "between").length,
        report.quality.pendingRecords,
      ]);
    }
  }
  return rows;
}
