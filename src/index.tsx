import React from "react";
import ReactDOM from "react-dom/client";
import MyApp from "./components/App";
import reportWebVitals from "./reportWebVitals";
import { App, Layout, Radio } from "antd";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { DatasetTypeProvider, useDatasetType } from "./contexts/DatasetTypeContext";

import "./index.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const { Header, Content, Footer } = Layout;

function AppHeader() {
  const { datasetType, setDatasetType } = useDatasetType();

  return (
    <Header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ color: "white", fontSize: "40px" }}>Relatório BMS</div>
      <Radio.Group
        value={datasetType}
        onChange={(e) => setDatasetType(e.target.value)}
        buttonStyle="solid"
      >
        <Radio.Button value="diurnal">Borboletas Diurnas</Radio.Button>
        <Radio.Button value="nocturnal">Borboletas Noturnas</Radio.Button>
      </Radio.Group>
    </Header>
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App>
      <DatasetTypeProvider>
        <Layout>
          <AppHeader />
          <Content style={{ padding: "0 48px" }}>
            <MyApp />
          </Content>
          <Footer style={{ textAlign: "center" }}>Luís Cardoso ©{new Date().getFullYear()}</Footer>
        </Layout>
      </DatasetTypeProvider>
    </App>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
