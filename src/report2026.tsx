/* global HTMLDivElement */
import React, { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "antd";
import AnnualResultsPage from "./components/AnnualResultsPage";
import { ReportEmbedContext } from "./contexts/ReportEmbedContext";
import { connectReportEmbed } from "./utils/reportEmbed";
import "./registerCharts";
import "./index.css";
import "./report2026.css";

function EmbeddedReport() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => (root.current ? connectReportEmbed(root.current) : undefined), []);
  return (
    <div ref={root} className="embedded-report">
      <AnnualResultsPage embedded />
      <footer className="embedded-report-footer">
        Censos de Borboletas de Portugal · Resultados de 2026 ·{" "}
        <a
          href="https://lfac-pt.github.io/bms-report/#/results/2026"
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir relatório completo ↗
        </a>
      </footer>
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");
createRoot(root).render(
  <React.StrictMode>
    <HashRouter>
      <App>
        <ReportEmbedContext.Provider value="https://lfac-pt.github.io/bms-report/">
          <EmbeddedReport />
        </ReportEmbedContext.Provider>
      </App>
    </HashRouter>
  </React.StrictMode>
);
