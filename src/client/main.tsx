import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider } from "antd";
import { App } from "./app/App";
import "antd/dist/reset.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider theme={{ token: { colorPrimary: "#315c4d", colorInfo: "#315c4d", borderRadius: 10, fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }, components: { Layout: { siderBg: "#182b25", bodyBg: "#f5f7f2", headerBg: "#ffffff" }, Card: { borderRadiusLG: 16 }, Button: { controlHeight: 38 } } }}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>,
);
