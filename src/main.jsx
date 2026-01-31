// src/main.jsx
console.log("ENV KEY from main:", import.meta.env.VITE_FIREBASE_API_KEY);
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./styles/shell.css"; // ✅ NEW
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
