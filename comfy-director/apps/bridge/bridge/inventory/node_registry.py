"""Registro dei loader "noti" e di quale loro input rappresenta una scelta di file
modello (docs/module-boundaries.md #inventory).

Importante — questo NON è "hardcodare i parametri dei custom node" (vietato dalla
regola 2 della spec): i VALORI (i nomi file effettivamente disponibili, min/max/default,
ecc.) vengono sempre letti dinamicamente da `/object_info` in fase di sync. Questo
registro dice solo, per una manciata di classi di nodo ben note e stabili nell'ecosistema
ComfyUI, *quale* dei loro parametri è un selettore di file modello e *che tipo* di
modello rappresenta — un'informazione interpretativa versionata (equivalente a una
`internal_rule` del Compatibility Engine), non un dato che ComfyUI possa fornirci da
solo (lo schema /object_info non distingue "questo ENUM è una lista di checkpoint" da
"questo ENUM è una lista di sample_scheduler").

Un nodo/parametro non presente qui viene semplicemente ignorato ai fini
dell'estrazione della lista modelli (Fase 2 v1) — non è un errore, è una limitazione
dichiarata: l'inventario mostrerà comunque il nodo stesso (Fase 2 legge TUTTI i nodi),
solo non ne dedurrà una lista di file modello.

Estensibile: aggiungere una voce qui quando si scopre un altro loader ben noto la cui
convenzione di naming è stabile nell'ecosistema (core ComfyUI o estensioni molto diffuse
come ComfyUI_IPAdapter_plus / ComfyUI_InstantID).
"""

from __future__ import annotations

REGISTRY_VERSION = 1

# class_type -> [(nome parametro enum, model_type)]
KNOWN_MODEL_LOADER_PARAMS: dict[str, list[tuple[str, str]]] = {
    # --- core ComfyUI ---
    "CheckpointLoaderSimple": [("ckpt_name", "checkpoint")],
    "CheckpointLoader": [("ckpt_name", "checkpoint")],
    "unCLIPCheckpointLoader": [("ckpt_name", "checkpoint")],
    "LoraLoader": [("lora_name", "lora")],
    "LoraLoaderModelOnly": [("lora_name", "lora")],
    "VAELoader": [("vae_name", "vae")],
    "ControlNetLoader": [("control_net_name", "controlnet")],
    "DiffControlNetLoader": [("control_net_name", "controlnet")],
    "CLIPLoader": [("clip_name", "clip")],
    "DualCLIPLoader": [("clip_name1", "clip"), ("clip_name2", "clip")],
    "CLIPVisionLoader": [("clip_name", "clip_vision")],
    "UNETLoader": [("unet_name", "diffusion_model")],
    "UpscaleModelLoader": [("model_name", "upscale")],
    "StyleModelLoader": [("style_model_name", "other")],
    "GLIGENLoader": [("gligen_name", "other")],
    "PhotoMakerLoader": [("photomaker_model_name", "other")],
    # --- estensioni community molto diffuse (nomi di classe secondo le convenzioni
    # correnti dei rispettivi repo; se l'utente ha una versione con nomi diversi,
    # semplicemente questa voce non farà match — nessun danno) ---
    "IPAdapterModelLoader": [("ipadapter_file", "ipadapter")],
    "InstantIDModelLoader": [("instantid_file", "instantid")],
}


def known_classes() -> frozenset[str]:
    return frozenset(KNOWN_MODEL_LOADER_PARAMS.keys())
