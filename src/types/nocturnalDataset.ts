export interface NocturnalButterflyRecord {
  "Sample ID": string;
  "Occurrence ID": string;
  Location: string;
  "Location ID": string;
  Country: string;
  Date: string;
  "Recorder name": string;
  "Identified by": string;
  "Accepted species name": string;
  Authority: string;
  Family: string;
  "Verification status": string;
  "Verified by": string;
  "Count inside": number | string;
  "Count outside": number | string;
  Latitude: string;
  Longitude: string;
  "Record status": string;
  "Record substatus": string;
  Comments: string;
  "Occurrence comment": string;
}

export type NocturnalDataset = NocturnalButterflyRecord[];
