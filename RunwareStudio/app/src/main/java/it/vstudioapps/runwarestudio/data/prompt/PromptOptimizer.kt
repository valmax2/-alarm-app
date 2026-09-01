package it.vstudioapps.runwarestudio.data.prompt

import it.vstudioapps.runwarestudio.model.ModelCategory
import it.vstudioapps.runwarestudio.model.ModelPreset

/**
 * Adapts the already-translated (English) positive prompt to what each model family actually
 * responds well to, the way an experienced user of that specific checkpoint would phrase it by
 * hand. Purely additive (prefixes/suffixes around the user's own words, never replacing or
 * rewording them) and only ever runs when "Ottimizzazione automatica" is on — with it off,
 * GenerationViewModel sends the raw translation untouched, so manual control is always one
 * switch away. Heuristics only, tuned per checkpoint family: not a guarantee of "the best"
 * result, just a better starting point than a flat, unmodified sentence for models whose
 * community conventions expect more than that (Pony's score tags especially).
 */
object PromptOptimizer {

    fun optimizePositive(promptEn: String, model: ModelPreset): String {
        val trimmed = promptEn.trim()
        if (trimmed.isEmpty()) return trimmed

        return when {
            // Pony-family checkpoints are trained against "score_N" quality-rating tags and
            // read them as a strong quality anchor when they lead the prompt — see also the
            // matching score_6/score_5/score_4 the model's default negative prompt already
            // carries (ModelCatalog).
            model.id == "pony-realism" || model.id == "pony-diffusion-xl" -> {
                if (trimmed.contains("score_9", ignoreCase = true)) {
                    trimmed
                } else {
                    "score_9, score_8_up, score_7_up, $trimmed"
                }
            }

            model.category == ModelCategory.REALISTIC ->
                "$trimmed, professional photography, highly detailed, sharp focus, realistic lighting"

            model.category == ModelCategory.ANIME ->
                "masterpiece, best quality, $trimmed"

            model.category == ModelCategory.ARTISTIC ->
                "$trimmed, highly detailed, trending on artstation"

            // GENERAL (FLUX.1) and CHARACTER_CONSISTENCY (ACE++) already follow a plain
            // natural-language sentence closely — adding tag spam tends to hurt them more
            // than it helps, so they're passed through unchanged.
            else -> trimmed
        }
    }
}
