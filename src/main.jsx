// src/main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./styles/shell.css";
import App from "./App.jsx";
import { ToastProvider } from "./hooks/useToasts.jsx";
import Toaster from "./components/Toaster";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <Toaster />
    </ToastProvider>
  </StrictMode>
);
