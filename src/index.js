import React from 'react';
import ReactDOM from 'react-dom/client';
import MyApp from './components/App';
import reportWebVitals from './reportWebVitals';
import { App, Layout } from "antd";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

import "./index.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);


const { Header, Content, Footer } = Layout;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App>
      <Layout>
        <Header style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{color: "white", "fontSize": "40px"}}>Relatório BMS</div>
        </Header>
        <Content style={{ padding: '0 48px' }}>
          <MyApp />
        </Content>
        <Footer style={{ textAlign: 'center' }}>
          Luís Cardoso ©{new Date().getFullYear()}
        </Footer>
      </Layout>
    </App>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
