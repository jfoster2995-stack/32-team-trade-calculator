// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";             // ← IMPORTANT: loads Tailwind + tokens
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
