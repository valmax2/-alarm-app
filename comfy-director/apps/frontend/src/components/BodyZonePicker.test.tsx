import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BodyZonePicker } from "./BodyZonePicker";

afterEach(() => {
  cleanup();
});

const GROUPS = [
  { key: "build", label_it: "Corporatura", options: [{ label_it: "Atletica", value_en: "athletic body" }, { label_it: "Curvy", value_en: "curvy body" }] },
  { key: "height", label_it: "Altezza", options: [{ label_it: "Alta", value_en: "tall" }] },
  { key: "waist", label_it: "Vita", options: [{ label_it: "Stretta", value_en: "narrow waist" }] },
];

describe("BodyZonePicker", () => {
  it("mostra solo le zone i cui gruppi esistono davvero nel catalogo, nessun pannello aperto all'avvio", () => {
    render(<BodyZonePicker groups={GROUPS} values={{}} onChange={() => undefined} />);
    expect(screen.getByRole("button", { name: "Corpo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vita" })).toBeInTheDocument();
    // "Glutei" dipende da butt-size, assente in questo catalogo di test.
    expect(screen.queryByRole("button", { name: "Glutei" })).not.toBeInTheDocument();
    expect(screen.queryByText("Corporatura")).not.toBeInTheDocument();
  });

  it("aprendo una zona mostra solo le categorie di quella zona, non delle altre", () => {
    render(<BodyZonePicker groups={GROUPS} values={{}} onChange={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Corpo" }));
    expect(screen.getByText("Corporatura")).toBeInTheDocument();
    expect(screen.getByText("Altezza")).toBeInTheDocument();
    // la categoria "Vita" (zona diversa) non è nel pannello aperto — solo il suo
    // pulsante di zona resta visibile nella riga sopra.
    expect(screen.queryByRole("button", { name: "Stretta" })).not.toBeInTheDocument();
  });

  it("ricliccando la stessa zona la richiude", () => {
    render(<BodyZonePicker groups={GROUPS} values={{}} onChange={() => undefined} />);
    const zoneBtn = screen.getByRole("button", { name: "Corpo" });
    fireEvent.click(zoneBtn);
    expect(screen.getByText("Corporatura")).toBeInTheDocument();
    fireEvent.click(zoneBtn);
    expect(screen.queryByText("Corporatura")).not.toBeInTheDocument();
  });

  it("selezionare un'opzione chiama onChange con la chiave del gruppo e il value_en reale", () => {
    const onChange = vi.fn();
    render(<BodyZonePicker groups={GROUPS} values={{}} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Corpo" }));
    fireEvent.click(screen.getByRole("button", { name: "Atletica" }));
    expect(onChange).toHaveBeenCalledWith("build", "athletic body");
  });

  it("ricliccare l'opzione già selezionata la deseleziona (onChange con stringa vuota)", () => {
    const onChange = vi.fn();
    render(<BodyZonePicker groups={GROUPS} values={{ build: "athletic body" }} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Corpo (1)" }));
    const selected = screen.getByRole("button", { name: "Atletica" });
    expect(selected.className).toContain("body-zone-picker__option--selected");
    fireEvent.click(selected);
    expect(onChange).toHaveBeenCalledWith("build", "");
  });

  it("il pulsante zona mostra il conteggio delle selezioni già fatte in quella zona", () => {
    render(<BodyZonePicker groups={GROUPS} values={{ build: "athletic body" }} onChange={() => undefined} />);
    expect(screen.getByRole("button", { name: "Corpo (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vita" })).toBeInTheDocument(); // nessuna selezione, nessun conteggio
  });
});
