export interface CameraDirectorValues {
  orbit: number;
  elevation: number;
  distance: number;
  fov: number;
  tilt: number;
}

export const CAMERA_DIRECTOR_DEFAULTS: CameraDirectorValues = { orbit: 0, elevation: 0, distance: 80, fov: 50, tilt: 0 };

interface Slider {
  key: keyof CameraDirectorValues;
  label: string;
  min: number;
  max: number;
  unit: string;
}

// Stessi range dei cinque <input type="range"> dell'originale PromptStudio
// (`index.html`: directorOrbit/-Elevation/-Distance/-Fov/-Tilt).
const SLIDERS: Slider[] = [
  { key: "orbit", label: "Orbita", min: -180, max: 180, unit: "°" },
  { key: "elevation", label: "Elevazione", min: -60, max: 60, unit: "°" },
  { key: "distance", label: "Distanza", min: 30, max: 140, unit: "" },
  { key: "fov", label: "Zoom / FOV", min: 20, max: 100, unit: "°" },
  { key: "tilt", label: "Tilt", min: -30, max: 30, unit: "°" },
];

interface Props {
  active: boolean;
  values: CameraDirectorValues;
  onActiveChange: (active: boolean) => void;
  onValuesChange: (values: CameraDirectorValues) => void;
}

/**
 * Regia Camera (porting di "Camera Director" da PromptStudio, `cameraDirectorPrompt()`
 * in `app.js`): cinque slider numerici che si traducono in una frase inglese di
 * posizionamento camera (orbita/elevazione/distanza/FOV/tilt), calcolata lato Bridge
 * (`bridge.prompt_engine.compiler.camera_director_prompt`, stessa funzione usata da
 * "Componi prompt" — nessuna logica duplicata qui). Quando attiva, sostituisce del
 * tutto i menu Taglio/Angolo/Lens del catalogo qui sopra (stessa regola
 * dell'originale: "sostituisce DEL TUTTO", mai una fusione parziale).
 *
 * Adattamento deliberato: qui niente vista 3D trascinabile (tre diagrammi SVG
 * top/frontale/destra) né anteprima testuale dal vivo mentre si trascina — come per
 * tutte le altre sezioni della Costruzione guidata, il risultato si vede componendo
 * il prompt con il pulsante in fondo, non prima.
 */
export function CameraDirector({ active, values, onActiveChange, onValuesChange }: Props) {
  return (
    <div className="camera-director">
      <label htmlFor="cd-active">
        <input
          id="cd-active" type="checkbox" checked={active}
          onChange={(e) => onActiveChange(e.target.checked)}
        />{" "}
        Usa la Regia Camera (sostituisce Taglio/Angolo/Lens qui sopra)
      </label>
      {active && (
        <div className="camera-director__sliders">
          {SLIDERS.map((slider) => (
            <label key={slider.key} htmlFor={`cd-${slider.key}`} className="camera-director__slider">
              <span>
                {slider.label}: {values[slider.key]}
                {slider.unit}
              </span>
              <input
                id={`cd-${slider.key}`} type="range" min={slider.min} max={slider.max} value={values[slider.key]}
                onChange={(e) => onValuesChange({ ...values, [slider.key]: Number(e.target.value) })}
              />
            </label>
          ))}
          <button type="button" onClick={() => onValuesChange(CAMERA_DIRECTOR_DEFAULTS)}>
            Reset camera
          </button>
        </div>
      )}
    </div>
  );
}
