export interface ButterflyRecord {
  "Transect Sample ID": string;
  "Section Sample ID": string;
  "Transect ID": string;
  "Occurrence ID": string;
  "Section Name": string;
  Date: string;
  "Species Name (entered)": string;
  "Preferred Species Name": string;
  "Taxon Group": string;
  "Walk % Sun": string | number;
  "Walk % Cloud": string | number;
  "Section % Sun": string | number;
  "Section % Cloud": string | number;
  Reliability: string;
  "Abundance count": number;
  "Record status": string;
  "Record substatus": string;
  Comments: string;
  "Occurrence comment": string;
}

export type Dataset = ButterflyRecord[];
