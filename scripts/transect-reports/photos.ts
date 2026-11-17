import fs from "node:fs";
import path from "node:path";
import { SPECIES_FAMILIES } from "../../src/constants";

interface PhotoCredit {
  src?: string;
  photographer: string;
  license: string | null;
  licenseUrl?: string;
  url: string | null;
}

export interface SpeciesPhoto {
  filename: string;
  credit: PhotoCredit | null;
}

const PUBLIC = path.resolve(__dirname, "../../public");
const credits: Record<string, PhotoCredit> = JSON.parse(
  fs.readFileSync(path.join(PUBLIC, "data/photo-credits.json"), "utf8")
);
const resultCredits: Record<string, PhotoCredit> = JSON.parse(
  fs.readFileSync(path.join(PUBLIC, "data/results-photo-credits.json"), "utf8")
);

/** Match the website's species/family paths, then its supplementary results-photo catalogue. */
export function speciesPhoto(species: string): SpeciesPhoto | null {
  const family = SPECIES_FAMILIES[species];
  const candidates = [
    ...(family
      ? [
          {
            src: `imgs/sp/${family}/${species.replace(/\//g, "_")}.jpg`,
            credit: credits[species] || null,
          },
        ]
      : []),
    ...(resultCredits[species]?.src
      ? [{ src: resultCredits[species].src!, credit: resultCredits[species] }]
      : []),
  ];
  for (const candidate of candidates) {
    const filename = path.resolve(PUBLIC, candidate.src);
    if (
      filename.startsWith(PUBLIC + path.sep) &&
      fs.existsSync(filename) &&
      fs.statSync(filename).isFile()
    ) {
      return { filename, credit: candidate.credit };
    }
  }
  return null;
}
