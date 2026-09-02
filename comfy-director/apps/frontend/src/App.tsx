import { useState } from "react";

import { BridgeStatus } from "./components/BridgeStatus";
import { SettingsPanel } from "./components/SettingsPanel";

interface NavItem {
  id: string;
  label: string;
  /** Fase della roadmap (IMPLEMENTATION_PLAN.md) in cui questa sezione diventa reale.
   * `null` = già disponibile in questa consegna. */
  availableFromPhase: number | null;
}

// Barra sinistra (spec §12). Solo "Bridge ComfyUI" è reale in Fase 1: tutto il resto è
// mostrato ma disabilitato con la fase in cui arriverà — mai un pulsante che finge di
// fare qualcosa (regola 1 della spec).
const NAV_ITEMS: NavItem[] = [
  { id: "flow-type", label: "Tipo Flusso", availableFromPhase: 5 },
  { id: "ai-engine", label: "Motore AI", availableFromPhase: 5 },
  { id: "characters", label: "Personaggi", availableFromPhase: 7 },
  { id: "workflows", label: "Workflow", availableFromPhase: 3 },
  { id: "workflow-from-image", label: "Workflow da Immagine", availableFromPhase: 8 },
  { id: "prompt-from-image", label: "Prompt da Immagine", availableFromPhase: 9 },
  { id: "models", label: "Modelli", availableFromPhase: 2 },
  { id: "nodes", label: "Nodi", availableFromPhase: 2 },
  { id: "bridge", label: "Bridge ComfyUI", availableFromPhase: null },
  { id: "ai-assistant", label: "Assistente AI", availableFromPhase: 10 },
];

export default function App() {
  const [activePanel, setActivePanel] = useState<string>("bridge");

  return (
    <div className="app-shell">
      <header className="app-shell__topbar">
        <span className="app-shell__title">COMFY DIRECTOR</span>
        <span className="app-shell__workflow-name">Nessun workflow aperto</span>
        <BridgeStatus />
        <button type="button" disabled title="Disponibile da Fase 6 (Generazione)">
          GENERA
        </button>
        <button type="button" disabled title="Disponibile da Fase 6 (Generazione)">
          ABORT
        </button>
      </header>

      <div className="app-shell__body">
        <nav className="app-shell__sidebar" aria-label="Sezioni Comfy Director">
          {NAV_ITEMS.map((item) => {
            const isAvailable = item.availableFromPhase === null;
            return (
              <button
                key={item.id}
                type="button"
                className={
                  "app-shell__nav-button" +
                  (activePanel === item.id ? " app-shell__nav-button--active" : "")
                }
                disabled={!isAvailable}
                title={isAvailable ? undefined : `Non ancora disponibile — arriva in Fase ${item.availableFromPhase}`}
                onClick={() => isAvailable && setActivePanel(item.id)}
              >
                {item.label}
                {!isAvailable && <span className="app-shell__nav-badge">Fase {item.availableFromPhase}</span>}
              </button>
            );
          })}
        </nav>

        <main className="app-shell__canvas" aria-label="Canvas workflow">
          <div className="app-shell__canvas-placeholder">
            <p>Canvas del workflow — non ancora implementata.</p>
            <p className="app-shell__canvas-placeholder-note">
              Arriva in Fase 3 (vedi IMPLEMENTATION_PLAN.md). Qui apparirà il grafo reale
              del workflow, sincronizzato bidirezionalmente col modello interno.
            </p>
          </div>
        </main>

        <aside className="app-shell__right-panel" aria-label="Proprietà contestuali">
          {activePanel === "bridge" ? (
            <SettingsPanel />
          ) : (
            <p>Seleziona una sezione dalla barra sinistra.</p>
          )}
        </aside>
      </div>

      <footer className="app-shell__bottombar">
        <span>Prompt / Output / Progress / Log — non ancora implementati (Fasi 6, 9).</span>
      </footer>
    </div>
  );
}
