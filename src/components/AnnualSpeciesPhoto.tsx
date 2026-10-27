import { useState } from "react";
import { BugOutlined } from "@ant-design/icons";
import { SPECIES_FAMILIES } from "../constants";

export interface PhotoCredit {
  src?: string;
  photographer: string;
  license: string | null;
  licenseUrl?: string;
  url: string | null;
  changes?: string;
}

export default function AnnualSpeciesPhoto({
  species,
  credits,
}: {
  species: string;
  credits: Record<string, PhotoCredit>;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const credit = credits[species];
  const source =
    credit?.src || `imgs/sp/${SPECIES_FAMILIES[species]}/${species.replace(/\//g, "_")}.jpg`;
  const failed = failedSource === source;
  return (
    <figure className="annual-species-photo">
      {failed ? (
        <div className="annual-photo-fallback">
          <BugOutlined />
          <span>Fotografia não disponível</span>
        </div>
      ) : (
        <img src={source} alt={species} loading="lazy" onError={() => setFailedSource(source)} />
      )}
      {!failed && credit && (
        <figcaption>
          {credit.url ? (
            <a href={credit.url} target="_blank" rel="noopener noreferrer">
              {credit.photographer}
            </a>
          ) : (
            credit.photographer
          )}
          {credit.license && (
            <>
              {" "}
              ·{" "}
              <a
                href={credit.licenseUrl || credit.url || undefined}
                target="_blank"
                rel="noopener noreferrer"
              >
                {credit.license}
              </a>
            </>
          )}
          {credit.changes && <span> · {credit.changes}</span>}
        </figcaption>
      )}
    </figure>
  );
}
