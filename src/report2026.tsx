/* global HTMLDivElement */
import React, { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App, ConfigProvider } from "antd";
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
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");
createRoot(root).render(
  <React.StrictMode>
    <HashRouter>
      <ConfigProvider
        theme={{
          token: {
            fontFamily: '"Raleway", Arial, sans-serif',
            colorPrimary: "#5cbce0",
            colorText: "#818181",
            colorTextHeading: "#3698bc",
            borderRadius: 4,
          },
        }}
      >
        <App>
          <ReportEmbedContext.Provider value="https://lfac-pt.github.io/bms-report/">
            <EmbeddedReport />
          </ReportEmbedContext.Provider>
        </App>
      </ConfigProvider>
    </HashRouter>
  </React.StrictMode>
);
