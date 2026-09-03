import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HairPreviewPicker } from "./HairPreviewPicker";

afterEach(() => {
  cleanup();
});

const GROUPS = [
  {
    label: "Corti",
    options: [
      { label_it: "Pixie classico", value_en: "classic pixie cut" },
      { label_it: "Crew cut", value_en: "crew cut" }, // senza foto reale nella mappa
    ],
  },
];

describe("HairPreviewPicker", () => {
  it("mostra la foto reale quando esiste nella mappa anteprime", () => {
    render(
      <HairPreviewPicker id="p" label="Stile" value="" onChange={() => undefined} groups={GROUPS} previews={{ "classic pixie cut": "styles/pixie-corto.jpg" }} />,
    );
    const img = screen.getByAltText("Pixie classico") as HTMLImageElement;
    expect(img.src).toContain("/hair-previews/styles/pixie-corto.jpg");
  });

  it("mostra un pulsante di solo testo (mai una foto indovinata) se la voce non ha una foto reale", () => {
    render(
      <HairPreviewPicker id="p" label="Stile" value="" onChange={() => undefined} groups={GROUPS} previews={{ "classic pixie cut": "styles/pixie-corto.jpg" }} />,
    );
    expect(screen.queryByAltText("Crew cut")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crew cut" })).toBeInTheDocument();
  });

  it("selezionare un'opzione la evidenzia e chiama onChange con il suo value_en", () => {
    const onChange = vi.fn();
    render(
      <HairPreviewPicker id="p" label="Stile" value="" onChange={onChange} groups={GROUPS} previews={{}} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Pixie classico" }));
    expect(onChange).toHaveBeenCalledWith("classic pixie cut");
  });

  it("ricliccare l'opzione già selezionata la deseleziona (onChange con stringa vuota)", () => {
    const onChange = vi.fn();
    render(
      <HairPreviewPicker id="p" label="Stile" value="classic pixie cut" onChange={onChange} groups={GROUPS} previews={{}} />,
    );
    const selected = screen.getByRole("button", { name: "Pixie classico" });
    expect(selected.className).toContain("hair-preview-picker__item--selected");
    fireEvent.click(selected);
    expect(onChange).toHaveBeenCalledWith("");
  });
});
