import { createContext } from "react";

// Null keeps normal in-app routing; embedded reports link out to the complete application.
export const ReportEmbedContext = createContext<string | null>(null);
