import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CAMERA_DIRECTOR_DEFAULTS, CameraDirector } from "./CameraDirector";

afterEach(() => {
  cleanup();
});

describe("CameraDirector", () => {
  it("da spento non mostra gli slider, solo il checkbox di attivazione", () => {
    render(
      <CameraDirector active={false} values={CAMERA_DIRECTOR_DEFAULTS} onActiveChange={() => undefined} onValuesChange={() => undefined} />,
    );
    expect(screen.getByLabelText(/Usa la Regia Camera/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Orbita/)).not.toBeInTheDocument();
  });

  it("attivando il checkbox chiama onActiveChange(true)", () => {
    const onActiveChange = vi.fn();
    render(
      <CameraDirector active={false} values={CAMERA_DIRECTOR_DEFAULTS} onActiveChange={onActiveChange} onValuesChange={() => undefined} />,
    );
    fireEvent.click(screen.getByLabelText(/Usa la Regia Camera/));
    expect(onActiveChange).toHaveBeenCalledWith(true);
  });

  it("da acceso mostra i cinque slider con i valori reali passati", () => {
    render(
      <CameraDirector
        active
        values={{ orbit: 45, elevation: -20, distance: 90, fov: 30, tilt: 5 }}
        onActiveChange={() => undefined} onValuesChange={() => undefined}
      />,
    );
    expect(screen.getByText("Orbita: 45°")).toBeInTheDocument();
    expect(screen.getByText("Elevazione: -20°")).toBeInTheDocument();
    expect(screen.getByText("Distanza: 90")).toBeInTheDocument();
    expect(screen.getByText("Zoom / FOV: 30°")).toBeInTheDocument();
    expect(screen.getByText("Tilt: 5°")).toBeInTheDocument();
  });

  it("muovere uno slider chiama onValuesChange con solo quel campo cambiato", () => {
    const onValuesChange = vi.fn();
    render(
      <CameraDirector active values={CAMERA_DIRECTOR_DEFAULTS} onActiveChange={() => undefined} onValuesChange={onValuesChange} />,
    );
    fireEvent.change(screen.getByLabelText(/Orbita/), { target: { value: "90" } });
    expect(onValuesChange).toHaveBeenCalledWith({ ...CAMERA_DIRECTOR_DEFAULTS, orbit: 90 });
  });

  it('"Reset camera" riporta tutti i valori ai default originali', () => {
    const onValuesChange = vi.fn();
    render(
      <CameraDirector
        active values={{ orbit: 90, elevation: 30, distance: 40, fov: 80, tilt: -15 }}
        onActiveChange={() => undefined} onValuesChange={onValuesChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset camera" }));
    expect(onValuesChange).toHaveBeenCalledWith(CAMERA_DIRECTOR_DEFAULTS);
  });
});
