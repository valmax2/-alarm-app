import { useEffect, useState } from "react";

import {
  bridgeClient,
  type CharacterSummaryOut,
  type PromptCatalogOption,
  type PromptCatalogOptionGroup,
  type PromptCatalogOut,
  type StructuredPromptRequest,
} from "../api/bridgeClient";
import { HAIR_COLOR_PREVIEWS, HAIR_STYLE_PREVIEWS } from "../data/hairPreviews";
import { HairPreviewPicker } from "./HairPreviewPicker";

interface Props {
  onComposed: (textEn: string) => void;
}

const EMPTY = "";

/**
 * "Costruzione guidata" del Prompt Engine — Smart Prompt Compiler portato da
 * PromptStudio (spec §9, richiesto esplicitamente dall'utente: "qui volevo
 * organizzarla meglio"). Compone il prompt inglese da selezioni guidate invece di
 * scriverlo a mano — il risultato riempie il campo "Prompt (inglese)" del Prompt
 * Engine, restando comunque editabile lì, esattamente come fa la traduzione IT→EN.
 *
 * Deferito esplicitamente, dichiarato (mai finto): nessun controllo camera
 * interattivo trascinabile (solo i cataloghi framing/angolo/lens); "Coerenza
 * Personaggio" usa SOLO un Personaggio della libreria (Fase 7) — nessun campo per
 * un'immagine di riferimento generica, perché Comfy Director non allega ancora
 * automaticamente un'immagine a un nodo del workflow (dipende dal Workflow
 * Intelligence Engine completo, Fase 5).
 */
export function StructuredPromptBuilder({ onComposed }: Props) {
  const [catalog, setCatalog] = useState<PromptCatalogOut | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [characters, setCharacters] = useState<CharacterSummaryOut[]>([]);
  const [composing, setComposing] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const [gender, setGender] = useState<"female" | "male">("female");
  const [age, setAge] = useState("");
  const [clothingState, setClothingState] = useState(EMPTY);
  const [underwearItem, setUnderwearItem] = useState(EMPTY);
  const [body, setBody] = useState<Record<string, string>>({});
  const [faceMode, setFaceMode] = useState<"" | "create">("");
  const [face, setFace] = useState<Record<string, string>>({});
  const [hairMode, setHairMode] = useState<"" | "keep" | "change">("");
  const [hair, setHair] = useState(EMPTY);
  const [hairColor, setHairColor] = useState(EMPTY);
  const [customAction, setCustomAction] = useState("");
  const [action, setAction] = useState(EMPTY);
  const [pose, setPose] = useState(EMPTY);
  const [customScene, setCustomScene] = useState("");
  const [environment, setEnvironment] = useState(EMPTY);
  const [customPhoto, setCustomPhoto] = useState("");
  const [cameraFraming, setCameraFraming] = useState(EMPTY);
  const [cameraAngle, setCameraAngle] = useState(EMPTY);
  const [cameraLens, setCameraLens] = useState(EMPTY);
  const [light, setLight] = useState(EMPTY);
  const [coherentCharacterId, setCoherentCharacterId] = useState(EMPTY);

  useEffect(() => {
    bridgeClient.getPromptCatalog().then(setCatalog).catch((err: unknown) => setCatalogError(err instanceof Error ? err.message : String(err)));
    bridgeClient.listCharacters().then(setCharacters).catch(() => setCharacters([]));
  }, []);

  useEffect(() => {
    // Cambiando genere, i gruppi corpo disponibili cambiano (es. "Seno" esiste solo
    // per "female") — le selezioni fatte per l'altro genere non hanno più senso.
    setBody({});
  }, [gender]);

  function bodyGroups(): PromptCatalogOptionGroup[] {
    return catalog?.body[gender] ?? [];
  }

  async function handleCompose() {
    setComposing(true);
    setComposeError(null);
    try {
      const request: StructuredPromptRequest = {
        gender,
        age: age.trim() ? Number(age) : null,
        clothing_state: clothingState || null,
        underwear_item: underwearItem || null,
        body,
        face_mode: faceMode,
        face,
        hair_mode: hairMode,
        hair: hair || null,
        hair_color: hairColor || null,
        custom_action: customAction.trim() || null,
        action: action || null,
        pose: pose || null,
        custom_scene: customScene.trim() || null,
        environment: environment || null,
        custom_photo: customPhoto.trim() || null,
        camera_framing: cameraFraming || null,
        camera_angle: cameraAngle || null,
        camera_lens: cameraLens || null,
        light: light || null,
        coherent_character_id: coherentCharacterId || null,
      };
      const result = await bridgeClient.composeStructuredPrompt(request);
      onComposed(result.text_en);
    } catch (err) {
      setComposeError(err instanceof Error ? err.message : String(err));
    } finally {
      setComposing(false);
    }
  }

  function optionSelect(
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: PromptCatalogOption[],
  ) {
    return (
      <div key={id}>
        <label htmlFor={id}>{label}</label>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Non specificato</option>
          {options.map((o) => (
            <option key={o.value_en} value={o.value_en}>
              {o.label_it}
            </option>
          ))}
        </select>
      </div>
    );
  }

  function groupedSelect(
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    categories: Record<string, PromptCatalogOption[]>,
  ) {
    return (
      <div key={id}>
        <label htmlFor={id}>{label}</label>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Non specificato</option>
          {Object.entries(categories).map(([category, options]) => (
            <optgroup key={category} label={category}>
              {options.map((o) => (
                <option key={o.value_en} value={o.value_en}>
                  {o.label_it}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    );
  }

  if (catalogError) {
    return (
      <p role="alert" className="settings-panel__feedback--error">
        {catalogError}
      </p>
    );
  }
  if (!catalog) return <p>Caricamento cataloghi…</p>;

  return (
    <section aria-label="Costruzione guidata">
      <button type="button" onClick={() => setExpanded((v) => !v)}>
        {expanded ? "▾" : "▸"} Costruzione guidata (Smart Prompt Compiler)
      </button>
      {expanded && (
        <div className="structured-prompt-builder">
          <p className="settings-panel__hint">
            Componi il prompt da menu guidati invece di scriverlo a mano. Il risultato riempie il campo "Prompt
            (inglese)" sopra, restando comunque editabile.
          </p>

          <label htmlFor="sp-gender">Genere</label>
          <select id="sp-gender" value={gender} onChange={(e) => setGender(e.target.value as "female" | "male")}>
            <option value="female">Donna</option>
            <option value="male">Uomo</option>
          </select>

          <label htmlFor="sp-age">Età (18+)</label>
          <input id="sp-age" type="number" min={18} max={100} value={age} onChange={(e) => setAge(e.target.value)} />

          {optionSelect("sp-clothing", "Abbigliamento", clothingState, setClothingState, catalog.clothing_states)}
          {clothingState === "underwear" &&
            groupedSelect("sp-underwear-item", "Capo specifico", underwearItem, setUnderwearItem, catalog.underwear_categories)}

          <h4>Personaggio coerente</h4>
          <label htmlFor="sp-character">Usa un personaggio della libreria per l'identità</label>
          <select id="sp-character" value={coherentCharacterId} onChange={(e) => setCoherentCharacterId(e.target.value)}>
            <option value="">Nessuno (descrivi il viso qui sotto)</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="settings-panel__hint">
            Se selezioni un personaggio, la descrizione del viso qui sotto viene sostituita da un blocco di coerenza
            d'identità basato sui suoi dati (nome, descrizione, tag, note) — mai sommati.
          </p>

          <h4>Corpo</h4>
          {bodyGroups().map((group) =>
            optionSelect(
              `sp-body-${group.key}`, group.label_it, body[group.key] ?? "",
              (v) => setBody((prev) => ({ ...prev, [group.key]: v })), [...group.options],
            ),
          )}

          {!coherentCharacterId && (
            <>
              <h4>Viso</h4>
              <label htmlFor="sp-face-mode">
                <input
                  id="sp-face-mode" type="checkbox" checked={faceMode === "create"}
                  onChange={(e) => setFaceMode(e.target.checked ? "create" : "")}
                />{" "}
                Descrivi i tratti del viso
              </label>
              {faceMode === "create" &&
                catalog.face.map((group) =>
                  optionSelect(
                    `sp-face-${group.key}`, group.label_it, face[group.key] ?? "",
                    (v) => setFace((prev) => ({ ...prev, [group.key]: v })), [...group.options],
                  ),
                )}
            </>
          )}

          <h4>Capelli</h4>
          <label htmlFor="sp-hair-mode">Modalità</label>
          <select id="sp-hair-mode" value={hairMode} onChange={(e) => setHairMode(e.target.value as "" | "keep" | "change")}>
            <option value="">Non specificato</option>
            <option value="keep" disabled={!coherentCharacterId} title={!coherentCharacterId ? "Richiede un personaggio coerente selezionato" : undefined}>
              Mantieni quelli del personaggio coerente
            </option>
            <option value="change">Cambia acconciatura</option>
          </select>
          {hairMode === "change" && (
            <>
              <HairPreviewPicker
                id="sp-hair-style" label="Stile" value={hair} onChange={setHair} previews={HAIR_STYLE_PREVIEWS}
                groups={Object.entries(catalog.hair_categories).map(([label, options]) => ({ label, options }))}
              />
              <HairPreviewPicker
                id="sp-hair-color" label="Colore" value={hairColor} onChange={setHairColor} previews={HAIR_COLOR_PREVIEWS}
                groups={[{ label: "", options: catalog.hair_colors }]}
              />
            </>
          )}

          <h4>Azione / Posa / Ambiente</h4>
          {optionSelect("sp-action", "Azione", action, setAction, catalog.actions)}
          <label htmlFor="sp-custom-action">Azione personalizzata (sostituisce quella sopra)</label>
          <input id="sp-custom-action" type="text" value={customAction} onChange={(e) => setCustomAction(e.target.value)} />
          {optionSelect("sp-pose", "Posa", pose, setPose, catalog.poses)}
          {optionSelect("sp-environment", "Ambiente", environment, setEnvironment, catalog.environments)}
          <label htmlFor="sp-custom-scene">Scena personalizzata (sostituisce l'ambiente sopra)</label>
          <input id="sp-custom-scene" type="text" value={customScene} onChange={(e) => setCustomScene(e.target.value)} />

          <h4>Camera e luce</h4>
          {catalog.camera.map((group) =>
            optionSelect(
              `sp-camera-${group.key}`, group.label_it,
              group.key === "framing" ? cameraFraming : group.key === "angle" ? cameraAngle : cameraLens,
              group.key === "framing" ? setCameraFraming : group.key === "angle" ? setCameraAngle : setCameraLens,
              [...group.options],
            ),
          )}
          {optionSelect("sp-light", "Luce", light, setLight, catalog.lights)}

          <label htmlFor="sp-custom-photo">Note fotografiche libere (aggiunte in fondo al prompt)</label>
          <textarea id="sp-custom-photo" value={customPhoto} onChange={(e) => setCustomPhoto(e.target.value)} rows={2} />

          {composeError && (
            <p role="alert" className="settings-panel__feedback--error">
              {composeError}
            </p>
          )}
          <button type="button" onClick={() => void handleCompose()} disabled={composing}>
            {composing ? "Composizione…" : "Componi prompt"}
          </button>
        </div>
      )}
    </section>
  );
}
