import type { PromptCatalogOption } from "../api/bridgeClient";

interface Group {
  label: string;
  options: PromptCatalogOption[];
}

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  groups: Group[];
  /** value_en -> path relativo sotto /hair-previews/, es. "styles/pixie-corto.jpg". */
  previews: Record<string, string>;
}

/**
 * Griglia di anteprime cliccabili per stile/colore capelli — sostituisce il menu a
 * tendina testuale nella Costruzione guidata (Smart Prompt Compiler, portato da
 * PromptStudio su richiesta esplicita dell'utente). Le foto reali (73 stili + 18
 * colori, `src/data/hairPreviews.ts`) coprono la maggior parte del catalogo, ma non
 * tutto: una voce senza foto resta comunque selezionabile come pulsante di solo
 * testo — mai un abbinamento indovinato/fuorviante.
 */
export function HairPreviewPicker({ id, label, value, onChange, groups, previews }: Props) {
  return (
    <div className="hair-preview-picker">
      <span id={`${id}-label`} className="hair-preview-picker__label">
        {label}
      </span>
      <div role="group" aria-labelledby={`${id}-label`} className="hair-preview-picker__groups">
        {groups.map((group) => (
          <div key={group.label || "_"} className="hair-preview-picker__group">
            {group.label && <h5>{group.label}</h5>}
            <div className="hair-preview-picker__grid">
              {group.options.map((option) => {
                const previewFile = previews[option.value_en];
                const selected = value === option.value_en;
                return (
                  <button
                    key={option.value_en}
                    type="button"
                    className={`hair-preview-picker__item${selected ? " hair-preview-picker__item--selected" : ""}`}
                    onClick={() => onChange(selected ? "" : option.value_en)}
                    title={option.label_it}
                    aria-pressed={selected}
                  >
                    {previewFile ? (
                      <>
                        <img
                          src={`/hair-previews/${previewFile}`}
                          alt={option.label_it}
                          className="hair-preview-picker__thumb"
                        />
                        <span className="hair-preview-picker__caption">{option.label_it}</span>
                      </>
                    ) : (
                      // Nessuna foto reale per questa voce: il testo compare una sola
                      // volta (niente didascalia duplicata sotto un segnaposto che
                      // mostra già la stessa etichetta).
                      <span className="hair-preview-picker__thumb hair-preview-picker__thumb--placeholder">
                        {option.label_it}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
