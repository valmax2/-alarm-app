import { useState } from "react";

import type { PromptCatalogOptionGroup } from "../api/bridgeClient";

interface Zone {
  key: string;
  title: string;
  // Chiavi di OptionGroup (bridge.prompt_engine.catalogs) che appartengono a questa
  // zona — stessa mappa di PromptStudio's body_director.js `targetGroups`, dato che
  // catalogs.py ha già ereditato quelle stesse chiavi (build/height/breast-size/
  // breast-shape/waist/hips/butt-size/legs/skin-tone/skin-detail/areola-size/
  // areola-color/pubic-style/chest) nel porting dello Smart Prompt Compiler.
  groupKeys: string[];
}

const ZONES: Zone[] = [
  { key: "build", title: "Corpo", groupKeys: ["build", "height"] },
  { key: "chest", title: "Torace / Seno", groupKeys: ["breast-size", "breast-shape", "areola-size", "areola-color", "chest"] },
  { key: "waist", title: "Vita", groupKeys: ["waist"] },
  { key: "hips", title: "Fianchi", groupKeys: ["hips"] },
  { key: "butt", title: "Glutei", groupKeys: ["butt-size"] },
  { key: "legs", title: "Gambe", groupKeys: ["legs"] },
  { key: "skin", title: "Pelle", groupKeys: ["skin-tone", "skin-detail", "pubic-style"] },
];

interface Props {
  groups: PromptCatalogOptionGroup[];
  values: Record<string, string>;
  onChange: (groupKey: string, value: string) => void;
}

/**
 * Navigazione a zone per gli attributi del corpo (porting di "Body Director" da
 * PromptStudio, `body_director.js`, su richiesta esplicita dell'utente di rendere
 * l'app "super"): sostituisce l'elenco piatto di un menu a tendina per ogni
 * categoria (10-13 select in fila) con zone cliccabili (Corpo/Torace/Vita/Fianchi/
 * Glutei/Gambe/Pelle) che aprono solo le categorie di quella zona.
 *
 * Adattamento deliberato rispetto all'originale: qui è puro riordino/raggruppamento
 * dello stesso catalogo già portato in Fase 9 (Task #32) — nessun dato nuovo, nessun
 * "personaggio a schermo intero" (quello vive già nella libreria Personaggi, Fase 7).
 */
export function BodyZonePicker({ groups, values, onChange }: Props) {
  const [activeZone, setActiveZone] = useState<string | null>(null);

  const zonesWithGroups = ZONES.map((zone) => ({
    zone,
    groups: zone.groupKeys.map((key) => groups.find((g) => g.key === key)).filter((g): g is PromptCatalogOptionGroup => !!g),
  })).filter((z) => z.groups.length > 0);

  const active = zonesWithGroups.find((z) => z.zone.key === activeZone);

  return (
    <div className="body-zone-picker">
      <div role="group" aria-label="Zone del corpo" className="body-zone-picker__zones">
        {zonesWithGroups.map(({ zone, groups: zoneGroups }) => {
          const selectedCount = zoneGroups.filter((g) => values[g.key]).length;
          const isActive = activeZone === zone.key;
          return (
            <button
              key={zone.key}
              type="button"
              className={`body-zone-picker__zone-btn${isActive ? " body-zone-picker__zone-btn--active" : ""}`}
              aria-pressed={isActive}
              onClick={() => setActiveZone(isActive ? null : zone.key)}
            >
              {zone.title}
              {selectedCount > 0 ? ` (${selectedCount})` : ""}
            </button>
          );
        })}
      </div>

      {active && (
        <div className="body-zone-picker__panel">
          {active.groups.map((group) => (
            <div key={group.key} className="body-zone-picker__category">
              <span className="body-zone-picker__category-label">{group.label_it}</span>
              <div className="body-zone-picker__options">
                {group.options.map((option) => {
                  const selected = values[group.key] === option.value_en;
                  return (
                    <button
                      key={option.value_en}
                      type="button"
                      className={`body-zone-picker__option${selected ? " body-zone-picker__option--selected" : ""}`}
                      aria-pressed={selected}
                      onClick={() => onChange(group.key, selected ? "" : option.value_en)}
                    >
                      {option.label_it}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
