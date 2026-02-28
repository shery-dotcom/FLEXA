import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from "react-hot-toast";
import "./styles/global.css";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1a1a1a",
              color: "#fff",
              border: "1px solid #2e2e2e",
              fontFamily: "Inter, sans-serif",
              fontSize: "14px",
            },
            success: {
              iconTheme: { primary: "#D4AF37", secondary: "#0a0a0a" },
            },
            error: { iconTheme: { primary: "#ef5350", secondary: "#fff" } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
