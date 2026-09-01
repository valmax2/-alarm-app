package it.vstudioapps.runwarestudio.data

import it.vstudioapps.runwarestudio.model.ModelCategory
import it.vstudioapps.runwarestudio.model.ModelPreset

/**
 * Curated "pronti all'uso" model list shown in the picker (Home -> "Modello" -> scheda).
 * Runware hosts tens of thousands of checkpoints identified by AIR (`provider:id@version`);
 * this is a deliberately short, hand-picked starting set covering the common use cases
 * (general, photoreal, anime, character-consistent editing) rather than trying to mirror
 * their whole catalog on-device. The user can still type any other AIR into "Modello
 * personalizzato" in Settings if they know one they want that isn't listed here.
 *
 * AIR ids below are the well-known public Runware/Civitai base checkpoints as documented at
 * runware.ai/docs — double-check against Runware's model explorer before shipping, since
 * providers occasionally retire or renumber versions.
 */
object ModelCatalog {

    val presets: List<ModelPreset> = listOf(
        ModelPreset(
            id = "flux-schnell",
            air = "runware:100@1",
            displayName = "FLUX.1 Schnell",
            description = "Modello generale veloce, ottimo equilibrio qualità/velocità per bozze rapide.",
            category = ModelCategory.GENERAL,
            defaultSteps = 4,
            defaultCfgScale = 1f,
            defaultWidth = 1024,
            defaultHeight = 1024,
            defaultScheduler = "Default"
        ),
        ModelPreset(
            id = "flux-dev",
            air = "runware:101@1",
            displayName = "FLUX.1 Dev",
            description = "Versione qualità superiore di FLUX, più lenta ma più dettagliata e coerente col prompt.",
            category = ModelCategory.GENERAL,
            defaultSteps = 28,
            defaultCfgScale = 3.5f,
            defaultWidth = 1024,
            defaultHeight = 1024,
            defaultScheduler = "Default"
        ),
        ModelPreset(
            id = "ace-plus-plus",
            air = "runware:102@1",
            displayName = "ACE++ Coerenza personaggio",
            description = "Pensato per mantenere lo stesso personaggio/volto tra più immagini partendo da foto di riferimento.",
            category = ModelCategory.CHARACTER_CONSISTENCY,
            defaultSteps = 30,
            defaultCfgScale = 5f,
            defaultWidth = 1024,
            defaultHeight = 1024,
            defaultScheduler = "Default",
            supportsCharacterReference = true
        ),
        ModelPreset(
            id = "sdxl-base",
            air = "civitai:101055@128078",
            displayName = "SDXL 1.0 Base",
            description = "Stable Diffusion XL di base: versatile, buona resa fotorealistica generale.",
            category = ModelCategory.REALISTIC,
            defaultSteps = 32,
            defaultCfgScale = 6.5f,
            defaultWidth = 1024,
            defaultHeight = 1024,
            defaultScheduler = "DPM++ 2M Karras"
        ),
        ModelPreset(
            id = "realistic-vision",
            air = "civitai:4201@130072",
            displayName = "Realistic Vision",
            description = "Checkpoint fotorealistico molto usato per ritratti e scene realistiche.",
            category = ModelCategory.REALISTIC,
            defaultSteps = 30,
            defaultCfgScale = 5f,
            defaultWidth = 832,
            defaultHeight = 1216,
            defaultScheduler = "DPM++ SDE Karras"
        ),
        ModelPreset(
            id = "pony-realism",
            air = "civitai:372465@914390",
            displayName = "Pony Realism",
            description = "Checkpoint fotorealistico permissivo, popolare per contenuti per adulti consenzienti. Richiede il filtro NSFW disattivato in Impostazioni.",
            category = ModelCategory.ADULT,
            defaultSteps = 30,
            defaultCfgScale = 6f,
            defaultWidth = 896,
            defaultHeight = 1152,
            defaultScheduler = "DPM++ 2M Karras",
            adultCapable = true
        ),
        ModelPreset(
            id = "pony-diffusion-xl",
            air = "civitai:257749@290640",
            displayName = "Pony Diffusion XL",
            description = "Base molto flessibile per stili anime/illustrazione, incluse varianti per adulti consenzienti.",
            category = ModelCategory.ADULT,
            defaultSteps = 28,
            defaultCfgScale = 7f,
            defaultWidth = 1024,
            defaultHeight = 1024,
            defaultScheduler = "Euler A",
            adultCapable = true
        ),
        ModelPreset(
            id = "anything-v5",
            air = "civitai:9409@30163",
            displayName = "Anything V5",
            description = "Checkpoint anime/illustrazione generico, buono per personaggi stilizzati.",
            category = ModelCategory.ANIME,
            defaultSteps = 26,
            defaultCfgScale = 7f,
            defaultWidth = 832,
            defaultHeight = 1216,
            defaultScheduler = "Euler A"
        ),
        ModelPreset(
            id = "dreamshaper",
            air = "civitai:4384@128713",
            displayName = "DreamShaper",
            description = "Ottimo generalista artistico, buon compromesso tra realismo e illustrazione.",
            category = ModelCategory.ARTISTIC,
            defaultSteps = 25,
            defaultCfgScale = 6f,
            defaultWidth = 1024,
            defaultHeight = 1024,
            defaultScheduler = "DPM++ 2M"
        )
    )

    fun byId(id: String): ModelPreset? = presets.find { it.id == id }

    val default: ModelPreset get() = presets.first()
}
