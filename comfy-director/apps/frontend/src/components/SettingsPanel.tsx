import { useEffect, useState } from "react";

import { bridgeClient } from "../api/bridgeClient";

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Form minimale per configurare l'URL di ComfyUI (spec §3: "Non assumere però percorsi
 * fissi"). Le altre opzioni del Bridge elencate nella spec (root path, models path,
 * custom_nodes path, directory workflow) sono dichiarate esplicitamente come non ancora
 * disponibili — arrivano in Fase 2, quando l'Inventory Engine le userà davvero.
 */
export function SettingsPanel() {
  const [comfyBaseUrl, setComfyBaseUrl] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    bridgeClient
      .getSettings()
      .then((settings) => {
        if (!cancelled) {
          setComfyBaseUrl(settings.comfy_base_url);
          setLoaded(true);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaveState("saving");
    setError(null);
    try {
      const updated = await bridgeClient.updateSettings(comfyBaseUrl);
      setComfyBaseUrl(updated.comfy_base_url);
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section className="settings-panel" aria-label="Impostazioni Bridge ComfyUI">
      <h2>Bridge ComfyUI</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="comfy-base-url">URL ComfyUI</label>
        <input
          id="comfy-base-url"
          type="text"
          value={comfyBaseUrl}
          placeholder="http://127.0.0.1:8188"
          disabled={!loaded}
          onChange={(event) => setComfyBaseUrl(event.target.value)}
        />
        <button type="submit" disabled={!loaded || saveState === "saving"}>
          {saveState === "saving" ? "Salvataggio…" : "Salva"}
        </button>
      </form>
      {saveState === "saved" && <p className="settings-panel__feedback">Impostazioni salvate.</p>}
      {error && (
        <p className="settings-panel__feedback settings-panel__feedback--error" role="alert">
          {error}
        </p>
      )}
      <p className="settings-panel__note">
        Percorso root, cartella modelli, cartella custom_nodes e directory workflow non
        sono ancora configurabili qui: arrivano con l'Inventory Engine (Fase 2). Vedi
        IMPLEMENTATION_PLAN.md.
      </p>
    </section>
  );
}
