#!/usr/bin/env python3
# ==============================================================================
# bridge_server.py — Prompt Studio Bridge
#
# A small local server that connects Prompt Studio (running in your browser,
# on this PC, a tablet or a phone on the same network) to your ComfyUI
# installation. It ONLY reads/writes inside the folders you configure below
# (the ComfyUI folder and, optionally, one personal folder) — it never
# exposes the rest of the computer.
#
# No external dependencies: pure Python 3 standard library. Start it with
# AVVIA_BRIDGE.bat (Windows) or `python3 bridge_server.py` (macOS/Linux).
# ==============================================================================

import json
import mimetypes
import os
import struct
import sys
import uuid
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(SCRIPT_DIR, "bridge_config.json")
LIBRARY_DIR = os.path.join(SCRIPT_DIR, "workflow_library")
INVENTORY_CACHE_PATH = os.path.join(SCRIPT_DIR, "inventory_cache.json")

PORT = 8765
CLIENT_ID = str(uuid.uuid4())

MODEL_FOLDERS = {
    "checkpoints": "checkpoints",
    "loras": "loras",
    "vae": "vae",
    "text_encoders": "text_encoders",
    "clip": "clip",
    "controlnet": "controlnet",
    "upscale_models": "upscale_models",
    "diffusion_models": "diffusion_models",
    "unet": "unet",
}
MODEL_EXTENSIONS = (".safetensors", ".ckpt", ".pt", ".pth", ".bin", ".gguf")

os.makedirs(LIBRARY_DIR, exist_ok=True)


# ------------------------------------------------------------------ config --

def load_config():
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"comfy_root": "", "personal_root": "", "comfy_api_url": "http://127.0.0.1:8188"}


def save_config(cfg):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)


CONFIG = load_config()


# ------------------------------------------------------------ safe path ---

def resolve_root(root_key):
    if root_key == "comfy":
        return CONFIG.get("comfy_root") or ""
    if root_key == "personal":
        return CONFIG.get("personal_root") or ""
    return ""


def safe_join(root_dir, rel_path):
    """Joins rel_path under root_dir, refusing to escape it (no ../ tricks)."""
    if not root_dir:
        raise ValueError("Cartella non configurata.")
    root_abs = os.path.abspath(root_dir)
    target = os.path.abspath(os.path.join(root_abs, rel_path or ""))
    if not (target == root_abs or target.startswith(root_abs + os.sep)):
        raise PermissionError("Percorso fuori dalla cartella autorizzata.")
    return target


# ----------------------------------------------------- safetensors meta ---

def read_safetensors_metadata(path):
    """Reads the JSON header of a .safetensors file (no external deps) and
    pulls out a few known 'base model' hints written by common training/
    export tools. Returns {} if unavailable — never guesses."""
    try:
        with open(path, "rb") as f:
            header_len_bytes = f.read(8)
            if len(header_len_bytes) < 8:
                return {}
            (header_len,) = struct.unpack("<Q", header_len_bytes)
            if header_len <= 0 or header_len > 20_000_000:
                return {}
            header_json = f.read(header_len)
            header = json.loads(header_json.decode("utf-8", errors="ignore"))
    except Exception:
        return {}

    meta = header.get("__metadata__", {}) or {}
    base_model = (
        meta.get("modelspec.architecture")
        or meta.get("ss_base_model_version")
        or meta.get("ss_sd_model_name")
        or meta.get("model_type")
    )
    out = {}
    if base_model:
        out["base_model"] = str(base_model)
    return out


# ------------------------------------------------------------- inventory --

def scan_inventory():
    root = CONFIG.get("comfy_root") or ""
    inv = {k: [] for k in MODEL_FOLDERS}
    inv["custom_nodes"] = []
    inv["scanned_at"] = None

    if root and os.path.isdir(root):
        models_dir = os.path.join(root, "models")
        for key, folder in MODEL_FOLDERS.items():
            folder_path = os.path.join(models_dir, folder)
            if not os.path.isdir(folder_path):
                continue
            for dirpath, _dirs, files in os.walk(folder_path):
                for fname in files:
                    if not fname.lower().endswith(MODEL_EXTENSIONS):
                        continue
                    full = os.path.join(dirpath, fname)
                    rel = os.path.relpath(full, folder_path).replace(os.sep, "/")
                    entry = {"name": rel, "path": rel}
                    if fname.lower().endswith(".safetensors"):
                        meta = read_safetensors_metadata(full)
                        if meta:
                            entry["metadata"] = meta
                    inv[key].append(entry)

        custom_nodes_dir = os.path.join(root, "custom_nodes")
        if os.path.isdir(custom_nodes_dir):
            for name in sorted(os.listdir(custom_nodes_dir)):
                full = os.path.join(custom_nodes_dir, name)
                if os.path.isdir(full) and not name.startswith("__"):
                    inv["custom_nodes"].append({"name": name, "path": name})

    import datetime
    inv["scanned_at"] = datetime.datetime.now().isoformat()
    with open(INVENTORY_CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(inv, f, indent=2, ensure_ascii=False)
    return inv


def get_cached_inventory():
    if os.path.exists(INVENTORY_CACHE_PATH):
        try:
            with open(INVENTORY_CACHE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return scan_inventory()


# ------------------------------------------------------------- workflows --

def workflow_search_dirs():
    root = CONFIG.get("comfy_root") or ""
    dirs = []
    if root and os.path.isdir(root):
        for candidate in (
            os.path.join(root, "user", "default", "workflows"),
            os.path.join(root, "workflows"),
            os.path.join(os.path.dirname(root), "workflows"),
        ):
            if os.path.isdir(candidate):
                dirs.append(candidate)
    return dirs


def list_workflows():
    results = []
    for dirpath, _dirs, files in os.walk(LIBRARY_DIR):
        for fname in files:
            if fname.lower().endswith(".json"):
                rel = os.path.relpath(os.path.join(dirpath, fname), LIBRARY_DIR).replace(os.sep, "/")
                results.append({"name": fname[:-5], "path": "library/" + rel})

    root = CONFIG.get("comfy_root") or ""
    for base in workflow_search_dirs():
        for dirpath, _dirs, files in os.walk(base):
            for fname in files:
                if fname.lower().endswith(".json"):
                    full = os.path.join(dirpath, fname)
                    rel = os.path.relpath(full, root).replace(os.sep, "/")
                    results.append({"name": fname[:-5], "path": "comfy/" + rel})
    return results


def read_workflow(path):
    if path.startswith("library/"):
        full = safe_join(LIBRARY_DIR, path[len("library/"):])
    elif path.startswith("comfy/"):
        full = safe_join(CONFIG.get("comfy_root") or "", path[len("comfy/"):])
    else:
        raise FileNotFoundError("Percorso workflow sconosciuto.")
    with open(full, "r", encoding="utf-8") as f:
        return json.load(f)


def write_workflow_to_library(name, workflow_json):
    safe_name = "".join(c for c in name if c.isalnum() or c in (" ", "-", "_")).strip() or "workflow"
    fname = safe_name + ".json"
    full = os.path.join(LIBRARY_DIR, fname)
    with open(full, "w", encoding="utf-8") as f:
        json.dump(workflow_json, f, indent=2, ensure_ascii=False)
    return "library/" + fname


def delete_workflow(path):
    if not path.startswith("library/"):
        raise PermissionError("Si possono eliminare solo i workflow della libreria di Prompt Studio, non i file dentro ComfyUI.")
    full = safe_join(LIBRARY_DIR, path[len("library/"):])
    os.remove(full)


# --------------------------------------------------------- ComfyUI proxy --

def comfy_api_url():
    return (CONFIG.get("comfy_api_url") or "http://127.0.0.1:8188").rstrip("/")


def comfy_request(path, data=None, method="GET"):
    url = comfy_api_url() + path
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, method=method,
                                  headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def comfy_generate(workflow_json):
    result = comfy_request("/prompt", {"prompt": workflow_json, "client_id": CLIENT_ID}, method="POST")
    return result.get("prompt_id")


def describe_comfy_http_error(err):
    """ComfyUI answers a bad /prompt submission with 400 and a JSON body
    naming exactly which node/input failed validation (e.g. a checkpoint
    or LoRA filename that doesn't exist on this machine). Surface that
    instead of a generic 'unreachable' message."""
    try:
        raw = err.read()
        data = json.loads(raw.decode("utf-8", errors="ignore"))
    except Exception:
        return str(err)

    parts = []
    top_error = data.get("error")
    if isinstance(top_error, dict) and top_error.get("message"):
        parts.append(top_error["message"])

    node_errors = data.get("node_errors")
    if isinstance(node_errors, dict):
        for node_id, info in node_errors.items():
            class_type = info.get("class_type", "?")
            for er in info.get("errors", []) or []:
                msg = er.get("message", "")
                details = er.get("details", "")
                parts.append(f"nodo {node_id} ({class_type}): {msg} {details}".strip())

    if not parts:
        return json.dumps(data, ensure_ascii=False)[:500]
    return " | ".join(parts)[:800]


def describe_execution_error(info):
    """Turns ComfyUI's execution_error payload (node id/type, exception
    type/message, a full Python traceback...) into one readable line
    instead of dumping the whole traceback at the user."""
    if not isinstance(info, dict):
        return str(info)
    node_type = info.get("node_type", "?")
    node_id = info.get("node_id", "?")
    exc_type = info.get("exception_type", "")
    exc_msg = info.get("exception_message", "").strip()
    summary = f"Nodo {node_id} ({node_type})"
    if exc_type or exc_msg:
        summary += f": {exc_type}: {exc_msg}" if exc_type else f": {exc_msg}"
    return summary[:600]


def comfy_status(prompt_id):
    try:
        history = comfy_request(f"/history/{prompt_id}")
    except urllib.error.URLError as e:
        return {"status": "error", "error": str(e)}
    entry = history.get(prompt_id)
    if not entry:
        return {"status": "queued"}
    status_info = entry.get("status", {})
    if status_info.get("status_str") == "error" or status_info.get("completed") is False and status_info.get("messages"):
        for msg in status_info.get("messages", []):
            if isinstance(msg, list) and msg and msg[0] == "execution_error":
                return {"status": "error", "error": describe_execution_error(msg[1] if len(msg) > 1 else {})}
    outputs = entry.get("outputs", {})
    images = []
    for _node_id, out in outputs.items():
        for img in out.get("images", []) or []:
            images.append(img)
    if images:
        return {"status": "completed", "images": images}
    if status_info.get("completed"):
        return {"status": "completed", "images": []}
    return {"status": "running"}


# ------------------------------------------------------------- HTTP glue --

class Handler(BaseHTTPRequestHandler):
    server_version = "PromptStudioBridge/1.0"

    def log_message(self, fmt, *args):
        sys.stderr.write("[bridge] " + (fmt % args) + "\n")

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _error(self, message, status=400):
        self._json({"error": message}, status)

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        try:
            if parsed.path == "/health":
                self._json({"status": "ok", "version": "1.0.0"})
            elif parsed.path == "/config":
                self._json(CONFIG)
            elif parsed.path == "/browse":
                root = qs.get("root", [""])[0]
                rel = unquote(qs.get("path", [""])[0])
                self._handle_browse(root, rel)
            elif parsed.path == "/file":
                root = qs.get("root", [""])[0]
                rel = unquote(qs.get("path", [""])[0])
                self._handle_file(root, rel)
            elif parsed.path == "/inventory":
                self._json(get_cached_inventory())
            elif parsed.path == "/workflows":
                self._json(list_workflows())
            elif parsed.path == "/workflow":
                rel = unquote(qs.get("path", [""])[0])
                self._json(read_workflow(rel))
            elif parsed.path == "/comfyui/status":
                prompt_id = qs.get("prompt_id", [""])[0]
                self._json(comfy_status(prompt_id))
            elif parsed.path == "/comfyui/image":
                self._handle_comfy_image(qs)
            else:
                self._error("Non trovato", 404)
        except PermissionError as e:
            self._error(str(e), 403)
        except FileNotFoundError as e:
            self._error(str(e), 404)
        except Exception as e:
            self._error(str(e), 500)

    def do_POST(self):
        parsed = urlparse(self.path)
        try:
            if parsed.path == "/config":
                body = self._read_json_body()
                CONFIG["comfy_root"] = body.get("comfy_root", CONFIG.get("comfy_root", ""))
                CONFIG["personal_root"] = body.get("personal_root", CONFIG.get("personal_root", ""))
                if body.get("comfy_api_url"):
                    CONFIG["comfy_api_url"] = body["comfy_api_url"]
                save_config(CONFIG)
                self._json(CONFIG)
            elif parsed.path == "/inventory/rescan":
                self._json(scan_inventory())
            elif parsed.path == "/workflow/import":
                body = self._read_json_body()
                path = write_workflow_to_library(body.get("name", "workflow"), body.get("workflow", {}))
                self._json({"path": path})
            elif parsed.path == "/comfyui/generate":
                body = self._read_json_body()
                prompt_id = comfy_generate(body.get("workflow", {}))
                self._json({"prompt_id": prompt_id})
            elif parsed.path == "/comfyui/input":
                qs = parse_qs(urlparse(self.path).query)
                filename = unquote(qs.get("filename", ["image.png"])[0])
                self._handle_upload_input(filename)
            else:
                self._error("Non trovato", 404)
        except urllib.error.HTTPError as e:
            # ComfyUI WAS reached — it rejected the workflow. Different
            # problem from "unreachable", so give the real reason.
            detail = describe_comfy_http_error(e)
            self._error(f"ComfyUI ha rifiutato il workflow (HTTP {e.code}): {detail}", 400)
        except urllib.error.URLError as e:
            self._error(f"ComfyUI non raggiungibile su {comfy_api_url()}: {e}", 502)
        except PermissionError as e:
            self._error(str(e), 403)
        except Exception as e:
            self._error(str(e), 500)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        try:
            if parsed.path == "/workflow":
                rel = unquote(qs.get("path", [""])[0])
                delete_workflow(rel)
                self._json({"ok": True})
            else:
                self._error("Non trovato", 404)
        except PermissionError as e:
            self._error(str(e), 403)
        except Exception as e:
            self._error(str(e), 500)

    # ---- helpers ----

    def _handle_browse(self, root_key, rel):
        root_dir = resolve_root(root_key)
        target = safe_join(root_dir, rel)
        if not os.path.isdir(target):
            raise FileNotFoundError("Cartella non trovata.")
        entries = []
        for name in sorted(os.listdir(target)):
            if name.startswith("."):
                continue
            full = os.path.join(target, name)
            entries.append({"name": name, "type": "dir" if os.path.isdir(full) else "file"})
        self._json(entries)

    def _handle_file(self, root_key, rel):
        root_dir = resolve_root(root_key)
        target = safe_join(root_dir, rel)
        if not os.path.isfile(target):
            raise FileNotFoundError("File non trovato.")
        ctype = mimetypes.guess_type(target)[0] or "application/octet-stream"
        with open(target, "rb") as f:
            data = f.read()
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _handle_upload_input(self, filename):
        root = CONFIG.get("comfy_root") or ""
        if not root or not os.path.isdir(root):
            raise ValueError("Cartella ComfyUI non configurata.")
        # Basename only — never allow writing outside ComfyUI's input folder.
        safe_name = os.path.basename(filename.replace("\\", "/")) or "image.png"
        input_dir = os.path.join(root, "input")
        os.makedirs(input_dir, exist_ok=True)
        target = safe_join(input_dir, safe_name)
        length = int(self.headers.get("Content-Length") or 0)
        data = self.rfile.read(length) if length else b""
        with open(target, "wb") as f:
            f.write(data)
        self._json({"filename": safe_name})

    def _handle_comfy_image(self, qs):
        filename = qs.get("filename", [""])[0]
        subfolder = qs.get("subfolder", [""])[0]
        ftype = qs.get("type", ["output"])[0]
        from urllib.parse import urlencode
        url = comfy_api_url() + "/view?" + urlencode({"filename": filename, "subfolder": subfolder, "type": ftype})
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                data = resp.read()
                ctype = resp.headers.get("Content-Type", "image/png")
        except urllib.error.URLError as e:
            self._error(f"ComfyUI non raggiungibile: {e}", 502)
            return
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main():
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("=" * 60)
    print(" Prompt Studio Bridge")
    print(f" In ascolto su http://127.0.0.1:{PORT}")
    print(f" Cartella ComfyUI configurata: {CONFIG.get('comfy_root') or '(non impostata)'}")
    print(" Lascia questa finestra aperta finché usi Prompt Studio.")
    print(" Premi CTRL+C per fermare il Bridge.")
    print("=" * 60)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nBridge fermato.")


if __name__ == "__main__":
    main()
