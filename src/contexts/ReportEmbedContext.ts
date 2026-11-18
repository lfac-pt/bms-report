import { createContext } from "react";

// Null preserves the regular app; a value enables the standalone report presentation.
export const ReportEmbedContext = createContext<string | null>(null);
