import { baseUrlFromSettings } from "./state.js";

export class ComfyUIError extends Error {}

export class ComfyUIClient {
  constructor(settings) {
    this.settings = settings;
    this.baseUrl = baseUrlFromSettings(settings);
    if (!this.baseUrl) {
      throw new ComfyUIError("Impostazioni di connessione mancanti o incomplete.");
    }
  }

  _authHeaders() {
    const headers = {};
    const { user, pass } = this.settings;
    if (user) {
      headers["Authorization"] = "Basic " + btoa(`${user}:${pass || ""}`);
    } else if (pass) {
      headers["Authorization"] = `Bearer ${pass}`;
    }
    return headers;
  }

  async _fetch(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers: { ...this._authHeaders(), ...(options.headers || {}) },
      });
    } catch (err) {
      throw new ComfyUIError(
        `Impossibile raggiungere ComfyUI su ${this.baseUrl}. Verifica IP/porta e che il server sia raggiungibile dal browser (CORS incluso).`
      );
    }
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new ComfyUIError(`ComfyUI ha risposto ${response.status}: ${text || response.statusText}`);
    }
    return response;
  }

  async testConnection() {
    const response = await this._fetch("/system_stats");
    return response.json();
  }

  async uploadImage(blob, filename, subfolder = "comic-studio") {
    const form = new FormData();
    form.append("image", blob, filename);
    form.append("subfolder", subfolder);
    form.append("overwrite", "true");
    const response = await this._fetch("/upload/image", { method: "POST", body: form });
    return response.json(); // { name, subfolder, type }
  }

  async queuePrompt(promptGraph, clientId) {
    const response = await this._fetch("/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: promptGraph, client_id: clientId }),
    });
    return response.json(); // { prompt_id, number, node_errors }
  }

  async getHistory(promptId) {
    const response = await this._fetch(`/history/${promptId}`);
    return response.json();
  }

  viewImageUrl({ filename, subfolder = "", type = "output" }) {
    const params = new URLSearchParams({ filename, subfolder, type });
    return `${this.baseUrl}/view?${params.toString()}`;
  }

  /**
   * Polls /history until the queued prompt has finished, returning the list
   * of produced images. ComfyUI has no completion webhook over plain HTTP,
   * so polling is the simplest transport-agnostic option here.
   */
  async waitForResult(promptId, { intervalMs = 1500, timeoutMs = 180000 } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const history = await this.getHistory(promptId);
      const entry = history?.[promptId];
      if (entry?.status?.completed) {
        const images = [];
        for (const output of Object.values(entry.outputs || {})) {
          for (const img of output.images || []) images.push(img);
        }
        return images;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new ComfyUIError("Timeout in attesa del risultato da ComfyUI.");
  }

  async fetchImageBlob(imageRef) {
    const response = await this._fetch(
      `/view?${new URLSearchParams({
        filename: imageRef.filename,
        subfolder: imageRef.subfolder || "",
        type: imageRef.type || "output",
      }).toString()}`
    );
    return response.blob();
  }
}
