import { useState } from "react";

import { BridgeStatus } from "./components/BridgeStatus";
import { NodePropertiesPanel } from "./components/canvas/NodePropertiesPanel";
import { WorkflowCanvas } from "./components/canvas/WorkflowCanvas";
import { ModelsPanel } from "./components/ModelsPanel";
import { NodesPanel } from "./components/NodesPanel";
import { PromptFromImagePanel } from "./components/PromptFromImagePanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { WorkflowFromImagePanel } from "./components/WorkflowFromImagePanel";
import { WorkflowsPanel } from "./components/WorkflowsPanel";
import { useWorkflowStore } from "./store/workflowStore";

interface NavItem {
  id: string;
  label: string;
  /** Fase della roadmap (IMPLEMENTATION_PLAN.md) in cui questa sezione diventa reale.
   * `null` = già disponibile in questa consegna. */
  availableFromPhase: number | null;
}

// Pulsanti dei flussi/sezioni (spec §12), sulla SINISTRA (posizione richiesta
// dall'utente — prima erano stati spostati a destra, poi riportati a sinistra).
// Solo le sezioni con availableFromPhase: null sono reali in questa consegna: tutto il
// resto è mostrato ma disabilitato con la fase in cui arriverà — mai un pulsante che
// finge di fare qualcosa (regola 1 della spec).
const NAV_ITEMS: NavItem[] = [
  { id: "flow-type", label: "Tipo Flusso", availableFromPhase: 5 },
  { id: "ai-engine", label: "Motore AI", availableFromPhase: 5 },
  { id: "characters", label: "Personaggi", availableFromPhase: 7 },
  { id: "workflows", label: "Workflow", availableFromPhase: null },
  { id: "workflow-from-image", label: "Workflow da Immagine", availableFromPhase: null },
  { id: "prompt-from-image", label: "Prompt da Immagine", availableFromPhase: null },
  { id: "models", label: "Modelli", availableFromPhase: null },
  { id: "nodes", label: "Nodi", availableFromPhase: null },
  { id: "bridge", label: "Bridge ComfyUI", availableFromPhase: null },
  { id: "ai-assistant", label: "Assistente AI", availableFromPhase: 10 },
];

const SECTION_IDS = [
  "bridge", "models", "nodes", "workflow-from-image", "prompt-from-image", "workflows",
];

export default function App() {
  const [activePanel, setActivePanel] = useState<string>("workflows");
  const workflowName = useWorkflowStore((s) => s.workflowName);
  const versionNumber = useWorkflowStore((s) => s.versionNumber);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);

  return (
    <div className="app-shell">
      <header className="app-shell__topbar">
        <span className="app-shell__title">COMFY DIRECTOR</span>
        <span className="app-shell__workflow-name">
          {workflowName ? `${workflowName} (v${versionNumber})` : "Nessun workflow aperto"}
        </span>
        <BridgeStatus />
        <button type="button" disabled title="Disponibile da Fase 6 (Generazione)">
          GENERA
        </button>
        <button type="button" disabled title="Disponibile da Fase 6 (Generazione)">
          ABORT
        </button>
      </header>

      <div className="app-shell__body">
        <div className="app-shell__side-column">
          <nav className="app-shell__nav" aria-label="Sezioni Comfy Director">
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

          <aside className="app-shell__side-panel" aria-label="Proprietà contestuali">
            {/* Un nodo selezionato sulla canvas ha sempre priorità (spec §11): mostra le
                sue proprietà reali indipendentemente dalla sezione attiva. */}
            {selectedNodeId ? (
              <NodePropertiesPanel />
            ) : (
              <>
                {activePanel === "bridge" && <SettingsPanel />}
                {activePanel === "models" && <ModelsPanel />}
                {activePanel === "nodes" && <NodesPanel />}
                {activePanel === "workflow-from-image" && <WorkflowFromImagePanel />}
                {activePanel === "prompt-from-image" && <PromptFromImagePanel />}
                {activePanel === "workflows" && <WorkflowsPanel />}
                {!SECTION_IDS.includes(activePanel) && <p>Seleziona una sezione dai pulsanti sopra.</p>}
              </>
            )}
          </aside>
        </div>

        <main className="app-shell__canvas" aria-label="Canvas workflow">
          <WorkflowCanvas />
        </main>
      </div>

      <footer className="app-shell__bottombar">
        <span>Prompt / Output / Progress / Log — non ancora implementati (Fasi 6, 9).</span>
      </footer>
    </div>
  );
}
