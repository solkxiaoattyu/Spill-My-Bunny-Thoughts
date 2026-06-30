import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { CorpusProvider } from "./context/CorpusContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <CorpusProvider>
        <App />
      </CorpusProvider>
    </HashRouter>
  </StrictMode>,
);
