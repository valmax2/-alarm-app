"""
ComfyUI VR Passthrough - nodi custom per convertire un video 2D piatto in un
video stereoscopico Side-by-Side pronto per essere guardato su Meta Quest 3
(in passthrough / mixed reality, tramite app di terze parti come SKYBOX VR,
DeoVR o Pigasus).

Pipeline "video 3D SBS":
    VRP_LoadVideo
        -> VRP_EstimateDepth
        -> VRP_DepthToStereoPair
        -> VRP_SideBySideCombine
        -> VRP_SaveVideoSBS

Pipeline "persona ritagliata (cutout) per passthrough":
    VRP_LoadVideo
        -> VRP_RemoveBackground   (Robust Video Matting - rimuove lo sfondo,
                                    lo sostituisce con un verde chroma-key)
        -> VRP_SaveVideoSBS       (player come HereSphere/PLAY'A/DeoVR
                                    rimuovono il verde a runtime in passthrough)

Tutti i nodi sono autosufficienti (non dipendono da altre estensioni
ComfyUI di terze parti), per evitare rotture quando quelle estensioni
cambiano la forma dei loro nodi.
"""

import os
import subprocess

import numpy as np
import torch
import torch.nn.functional as F
import cv2
import imageio_ffmpeg

import folder_paths


# --------------------------------------------------------------------------- #
# 1) Caricamento video
# --------------------------------------------------------------------------- #
class VRP_LoadVideo:
    """Carica un file video e lo trasforma in un batch di frame IMAGE."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "video_path": ("STRING", {"default": "", "multiline": False}),
            },
            "optional": {
                "max_frames": ("INT", {"default": 0, "min": 0, "max": 1_000_000, "step": 1}),
                "skip_first_frames": ("INT", {"default": 0, "min": 0, "max": 1_000_000, "step": 1}),
            },
        }

    RETURN_TYPES = ("IMAGE", "FLOAT", "STRING")
    RETURN_NAMES = ("images", "fps", "source_path")
    FUNCTION = "load"
    CATEGORY = "VR Passthrough/Video IO"

    def load(self, video_path, max_frames=0, skip_first_frames=0):
        video_path = video_path.strip().strip('"')
        if not video_path or not os.path.isfile(video_path):
            raise FileNotFoundError(f"[VRP_LoadVideo] Video non trovato: '{video_path}'")

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError(f"[VRP_LoadVideo] Impossibile aprire il video: '{video_path}'")

        fps = cap.get(cv2.CAP_PROP_FPS) or 24.0

        frames = []
        idx = 0
        while True:
            ok, frame_bgr = cap.read()
            if not ok:
                break
            idx += 1
            if idx <= skip_first_frames:
                continue
            frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            frames.append(frame_rgb)
            if max_frames and len(frames) >= max_frames:
                break
        cap.release()

        if not frames:
            raise RuntimeError(f"[VRP_LoadVideo] Nessun frame letto da '{video_path}'")

        arr = np.stack(frames, axis=0).astype(np.float32) / 255.0
        images = torch.from_numpy(arr)
        return (images, float(fps), video_path)


# --------------------------------------------------------------------------- #
# 2) Stima della profondità (Depth Anything V2)
# --------------------------------------------------------------------------- #
_DEPTH_PIPE_CACHE = {}


class VRP_EstimateDepth:
    """Esegue la stima di profondità monoculare (Depth Anything V2) su ogni
    frame, con normalizzazione condivisa su tutta la clip per ridurre lo
    sfarfallio (flicker) tra un frame e l'altro."""

    _MODEL_IDS = {
        "Small (veloce)": "depth-anything/Depth-Anything-V2-Small-hf",
        "Base": "depth-anything/Depth-Anything-V2-Base-hf",
        "Large (qualita' migliore)": "depth-anything/Depth-Anything-V2-Large-hf",
    }

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "model_size": (list(cls._MODEL_IDS.keys()), {"default": "Small (veloce)"}),
                "device": (["auto", "cuda", "cpu"], {"default": "auto"}),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("depth",)
    FUNCTION = "estimate"
    CATEGORY = "VR Passthrough/Stereo"

    def _get_pipe(self, model_size, device):
        from transformers import pipeline

        if device == "auto":
            device_id = 0 if torch.cuda.is_available() else -1
        elif device == "cuda":
            device_id = 0
        else:
            device_id = -1

        model_id = self._MODEL_IDS[model_size]
        key = (model_id, device_id)
        if key not in _DEPTH_PIPE_CACHE:
            _DEPTH_PIPE_CACHE[key] = pipeline(task="depth-estimation", model=model_id, device=device_id)
        return _DEPTH_PIPE_CACHE[key]

    def estimate(self, images, model_size, device):
        from PIL import Image

        pipe = self._get_pipe(model_size, device)

        raw_maps = []
        for i in range(images.shape[0]):
            H, W = images.shape[1], images.shape[2]
            frame = (images[i].cpu().numpy() * 255.0).astype(np.uint8)
            pil_img = Image.fromarray(frame)
            out = pipe(pil_img)

            # Usiamo il tensore grezzo (non la 'depth' visuale gia'
            # normalizzata per-frame) per poter normalizzare in modo
            # coerente su tutta la clip.
            pred = out["predicted_depth"]
            pred = pred.squeeze().detach().to("cpu").float().numpy()
            if pred.shape != (H, W):
                pred = cv2.resize(pred, (W, H), interpolation=cv2.INTER_CUBIC)
            raw_maps.append(pred)

        stacked = np.stack(raw_maps, axis=0)
        lo = np.percentile(stacked, 1)
        hi = np.percentile(stacked, 99)
        if hi - lo < 1e-6:
            hi = lo + 1e-6
        norm = np.clip((stacked - lo) / (hi - lo), 0.0, 1.0)

        # Convenzione: valore piu' alto (piu' chiaro) = oggetto piu' vicino.
        depth_rgb = np.stack([norm, norm, norm], axis=-1).astype(np.float32)
        return (torch.from_numpy(depth_rgb),)


# --------------------------------------------------------------------------- #
# 3) Da immagine + profondita' a coppia stereo L/R
# --------------------------------------------------------------------------- #
class VRP_DepthToStereoPair:
    """Genera una coppia stereo sintetica sinistra/destra a partire da
    immagine + mappa di profondita', tramite un warp orizzontale
    (Depth-Image-Based-Rendering semplificato)."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "depth": ("IMAGE",),
                "max_shift_percent": ("FLOAT", {"default": 1.5, "min": 0.0, "max": 8.0, "step": 0.1}),
                "invert_depth": ("BOOLEAN", {"default": False}),
            },
        }

    RETURN_TYPES = ("IMAGE", "IMAGE")
    RETURN_NAMES = ("left_image", "right_image")
    FUNCTION = "warp"
    CATEGORY = "VR Passthrough/Stereo"

    @staticmethod
    def _warp_eye(images, depth_centered, max_shift_px, sign):
        # images: (B,H,W,3) in [0,1]; depth_centered: (B,H,W) in [-1,1]
        # (+1 = punto piu' vicino alla camera)
        B, H, W, _ = images.shape
        device = images.device

        shift_px = depth_centered * max_shift_px.view(B, 1, 1) * 0.5 * sign

        xs = torch.linspace(-1, 1, W, device=device).view(1, 1, W).expand(B, H, W)
        ys = torch.linspace(-1, 1, H, device=device).view(1, H, 1).expand(B, H, W)

        shift_norm = shift_px / (W / 2.0)
        grid = torch.stack([xs - shift_norm, ys], dim=-1)  # (B,H,W,2)

        img_chw = images.permute(0, 3, 1, 2)
        warped = F.grid_sample(img_chw, grid, mode="bilinear", padding_mode="border", align_corners=True)
        return warped.permute(0, 2, 3, 1).contiguous()

    def warp(self, images, depth, max_shift_percent, invert_depth):
        images = images.float()
        depth = depth.float()

        if depth.shape[1:3] != images.shape[1:3]:
            depth = F.interpolate(
                depth.permute(0, 3, 1, 2), size=images.shape[1:3], mode="bilinear", align_corners=False
            ).permute(0, 2, 3, 1)

        depth_gray = depth.mean(dim=-1)  # (B,H,W) in [0,1]
        if invert_depth:
            depth_gray = 1.0 - depth_gray
        depth_centered = (depth_gray - 0.5) * 2.0  # [-1,1]

        B, H, W, _ = images.shape
        max_shift_px = torch.full((B,), max_shift_percent / 100.0 * W, device=images.device)

        left = self._warp_eye(images, depth_centered, max_shift_px, sign=-1.0)
        right = self._warp_eye(images, depth_centered, max_shift_px, sign=+1.0)
        return (left.clamp(0, 1), right.clamp(0, 1))


# --------------------------------------------------------------------------- #
# 4) Combinazione Side-by-Side
# --------------------------------------------------------------------------- #
class VRP_SideBySideCombine:
    """Affianca occhio sinistro e destro in un unico frame Side-by-Side."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "left_image": ("IMAGE",),
                "right_image": ("IMAGE",),
                "eye_width": ("INT", {"default": 1920, "min": 64, "max": 4096, "step": 2}),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("sbs_image",)
    FUNCTION = "combine"
    CATEGORY = "VR Passthrough/Stereo"

    @staticmethod
    def _resize_eye(img, eye_width):
        B, H, W, _ = img.shape
        eye_height = max(2, int(round(H * (eye_width / W))))
        eye_height -= eye_height % 2
        chw = img.permute(0, 3, 1, 2)
        resized = F.interpolate(chw, size=(eye_height, eye_width), mode="bilinear", align_corners=False)
        return resized.permute(0, 2, 3, 1)

    def combine(self, left_image, right_image, eye_width):
        eye_width -= eye_width % 2  # larghezza pari, richiesta da H.264

        left_r = self._resize_eye(left_image, eye_width)
        right_r = self._resize_eye(right_image, eye_width)
        sbs = torch.cat([left_r, right_r], dim=2)  # concatena lungo la larghezza
        return (sbs.clamp(0, 1),)


# --------------------------------------------------------------------------- #
# 5) Salvataggio video SBS (con audio originale ri-mixato)
# --------------------------------------------------------------------------- #
class VRP_SaveVideoSBS:
    """Scrive il batch di frame Side-by-Side in un file .mp4 H.264 e, se
    disponibile, rimuxa l'audio del video sorgente. Il file viene salvato
    con suffisso '_LR', convenzione riconosciuta automaticamente da molti
    player VR (SKYBOX VR, DeoVR, Pigasus) come 'Side-by-Side 3D completo'.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "fps": ("FLOAT", {"default": 24.0, "min": 1.0, "max": 120.0, "step": 0.01}),
                "filename_prefix": ("STRING", {"default": "quest3_passthrough"}),
            },
            "optional": {
                # forceInput: e' sempre un ingresso "a filo", mai un widget,
                # cosi' il collegamento nel workflow JSON resta identico
                # in qualsiasi versione di ComfyUI.
                "source_path_for_audio": ("STRING", {"default": "", "forceInput": True}),
                "crf": ("INT", {"default": 18, "min": 0, "max": 51, "step": 1}),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("output_path",)
    FUNCTION = "save"
    OUTPUT_NODE = True
    CATEGORY = "VR Passthrough/Video IO"

    def save(self, images, fps, filename_prefix, source_path_for_audio="", crf=18):
        output_dir = folder_paths.get_output_directory()
        full_output_folder, filename, counter, _subfolder, _fp = folder_paths.get_save_image_path(
            filename_prefix, output_dir, images.shape[2], images.shape[1]
        )
        final_name = f"{filename}_{counter:05}_LR.mp4"
        final_path = os.path.join(full_output_folder, final_name)

        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        has_source = bool(source_path_for_audio) and os.path.isfile(source_path_for_audio)
        video_target = final_path + ".video_only.mp4" if has_source else final_path

        writer = imageio_ffmpeg.write_frames(
            video_target,
            (images.shape[2], images.shape[1]),
            fps=fps,
            codec="libx264",
            macro_block_size=2,
            output_params=["-crf", str(crf), "-pix_fmt", "yuv420p"],
        )
        writer.send(None)
        try:
            for i in range(images.shape[0]):
                frame = (images[i].cpu().numpy() * 255.0).clip(0, 255).astype(np.uint8)
                writer.send(np.ascontiguousarray(frame))
        finally:
            writer.close()

        if has_source:
            cmd = [
                ffmpeg_exe, "-y",
                "-i", video_target,
                "-i", source_path_for_audio,
                "-map", "0:v:0", "-map", "1:a:0?",
                "-c:v", "copy", "-c:a", "aac", "-shortest",
                final_path,
            ]
            try:
                subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            except Exception as exc:  # noqa: BLE001 - non vogliamo far fallire tutto il job per l'audio
                print(f"[VRP_SaveVideoSBS] Mux audio fallito ({exc}), salvo solo il video.")
                os.replace(video_target, final_path)
            else:
                os.remove(video_target)

        print(f"[VRP_SaveVideoSBS] Video salvato: {final_path}")
        return (final_path,)


# --------------------------------------------------------------------------- #
# 6) Rimozione sfondo (persona "ritagliata" per passthrough con chroma-key)
# --------------------------------------------------------------------------- #
_RVM_MODEL_CACHE = {}


class VRP_RemoveBackground:
    """Rimuove lo sfondo da un video con una persona usando Robust Video
    Matting (RVM): non serve un vero green screen, funziona anche su un
    video normale, ed e' pensato apposta per i video (coerente tra un
    frame e l'altro, non sfarfalla come farebbe un matting fotogramma per
    fotogramma). Il risultato ha lo sfondo sostituito con un colore
    chroma-key puro, pronto per la modalita' "Chroma Key / Green Screen
    passthrough" di player come HereSphere, PLAY'A o DeoVR: il player
    rimuove il verde a runtime e la persona sembra fluttuare nella tua
    stanza reale.
    """

    _MODEL_VARIANTS = {
        "mobilenetv3 (veloce)": "mobilenetv3",
        "resnet50 (qualita' migliore)": "resnet50",
    }
    _CHROMA_COLORS = {
        "Verde (0,255,0)": (0.0, 1.0, 0.0),
        "Blu (0,0,255)": (0.0, 0.0, 1.0),
    }

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "model_variant": (list(cls._MODEL_VARIANTS.keys()), {"default": "mobilenetv3 (veloce)"}),
                "chroma_color": (list(cls._CHROMA_COLORS.keys()), {"default": "Verde (0,255,0)"}),
                "downsample_ratio": ("FLOAT", {"default": 0.25, "min": 0.1, "max": 1.0, "step": 0.05}),
            },
        }

    RETURN_TYPES = ("IMAGE", "IMAGE")
    RETURN_NAMES = ("chromakey_images", "alpha_mask")
    FUNCTION = "remove_bg"
    CATEGORY = "VR Passthrough/Cutout"

    def _get_model(self, variant, device):
        key = (variant, device)
        if key not in _RVM_MODEL_CACHE:
            # Scarica automaticamente pesi + codice del modello al primo
            # utilizzo (richiede connessione a internet la prima volta,
            # poi resta in cache locale di torch.hub).
            model = torch.hub.load("PeterL1n/RobustVideoMatting", self._MODEL_VARIANTS[variant])
            model = model.to(device).eval()
            _RVM_MODEL_CACHE[key] = model
        return _RVM_MODEL_CACHE[key]

    def remove_bg(self, images, model_variant, chroma_color, downsample_ratio):
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = self._get_model(model_variant, device)

        color = self._CHROMA_COLORS[chroma_color]
        bg_color = torch.tensor(color, device=device).view(1, 3, 1, 1)

        B = images.shape[0]
        rec = [None] * 4  # stato ricorrente RVM: da riazzerare a ogni nuova clip
        composited = []
        alphas = []

        with torch.no_grad():
            for i in range(B):
                frame = images[i].to(device).float().permute(2, 0, 1).unsqueeze(0)  # 1,3,H,W
                fgr, pha, *rec = model(frame, *rec, downsample_ratio)
                comp = fgr * pha + bg_color * (1.0 - pha)
                composited.append(comp.squeeze(0).permute(1, 2, 0).cpu())
                alphas.append(pha.squeeze(0).permute(1, 2, 0).expand(-1, -1, 3).cpu())

        return (
            torch.stack(composited, dim=0).clamp(0, 1),
            torch.stack(alphas, dim=0).clamp(0, 1),
        )


NODE_CLASS_MAPPINGS = {
    "VRP_LoadVideo": VRP_LoadVideo,
    "VRP_EstimateDepth": VRP_EstimateDepth,
    "VRP_DepthToStereoPair": VRP_DepthToStereoPair,
    "VRP_SideBySideCombine": VRP_SideBySideCombine,
    "VRP_SaveVideoSBS": VRP_SaveVideoSBS,
    "VRP_RemoveBackground": VRP_RemoveBackground,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "VRP_LoadVideo": "🎬 VR Passthrough - Carica Video",
    "VRP_EstimateDepth": "🌐 VR Passthrough - Stima Profondità",
    "VRP_DepthToStereoPair": "👀 VR Passthrough - Coppia Stereo L/R",
    "VRP_SideBySideCombine": "🖼️ VR Passthrough - Combina Side-by-Side",
    "VRP_SaveVideoSBS": "💾 VR Passthrough - Salva Video SBS (Quest 3)",
    "VRP_RemoveBackground": "✂️ VR Passthrough - Rimuovi Sfondo (Cutout)",
}
