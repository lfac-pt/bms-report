import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import MyApp from "./components/App";
import SpeciesPage from "./components/SpeciesPage";
import MunicipalityPage from "./components/MunicipalityPage";
import reportWebVitals from "./reportWebVitals";
import { App, Layout, Radio } from "antd";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

import "./index.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const { Header, Content, Footer } = Layout;

function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine current route
  const currentPath = location.pathname;
  let currentValue = "diurnal";
  if (currentPath === "/nocturnal" || currentPath.startsWith("/nocturnal/")) {
    currentValue = "nocturnal";
  } else if (currentPath === "/transects" || currentPath.startsWith("/transects/")) {
    currentValue = "transects";
  } else if (currentPath === "/diurnal" || currentPath.startsWith("/diurnal/")) {
    currentValue = "diurnal";
  }

  return (
    <Header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ color: "white", fontSize: "40px" }}>Relatório BMS</div>
      <Radio.Group
        value={currentValue}
        onChange={e => {
          const value = e.target.value;
          navigate(`/${value}`);
        }}
        buttonStyle="solid"
      >
        <Radio.Button value="diurnal">Borboletas Diurnas</Radio.Button>
        <Radio.Button value="nocturnal">Borboletas Noturnas</Radio.Button>
      </Radio.Group>
    </Header>
  );
}

function AppContent() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/diurnal" replace />} />
      <Route path="/diurnal" element={<MyApp datasetType="diurnal" />} />
      <Route path="/nocturnal" element={<MyApp datasetType="nocturnal" />} />
      <Route path="/transects" element={<MyApp datasetType="transects" />} />
      <Route path="/species/:speciesName" element={<SpeciesPage />} />
      <Route path="/municipality/:municipalityName" element={<MunicipalityPage />} />
      <Route path="*" element={<Navigate to="/diurnal" replace />} />
    </Routes>
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HashRouter>
      <App>
        <Layout>
          <AppHeader />
          <Content style={{ padding: "0 48px" }}>
            <AppContent />
          </Content>
          <Footer style={{ textAlign: "center" }}>Luís Cardoso ©{new Date().getFullYear()}</Footer>
        </Layout>
      </App>
    </HashRouter>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
