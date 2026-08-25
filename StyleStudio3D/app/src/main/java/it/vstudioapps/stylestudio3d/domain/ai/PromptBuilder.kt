package it.vstudioapps.stylestudio3d.domain.ai

import it.vstudioapps.stylestudio3d.domain.model.StyleCatalogEntry
import it.vstudioapps.stylestudio3d.domain.model.WardrobeItem

/**
 * Testo del prompt usato sia per la chiamata reale all'abbonamento AI (vedi
 * `domain/ai/remote/`) sia per il percorso "senza abbonamento": quando l'utente non ha
 * collegato nessuna API, l'app prepara comunque foto + prompt pronti da incollare in una chat
 * AI esterna (es. ChatGPT) tramite [it.vstudioapps.stylestudio3d.export.ExternalChatExportHelper].
 * Un solo posto dove e' scritto il testo del prompt, cosi' i due percorsi restano coerenti.
 */
object PromptBuilder {

    fun perStile(stile: StyleCatalogEntry): String = buildString {
        append("Modifica la foto applicando questo stile di ${stile.category.etichetta.lowercase()}: \"${stile.name}\". ")
        append("Lunghezza: ${stile.attributes.length.etichetta}. Volume: ${stile.attributes.volume.etichetta}. ")
        append("Colore riferimento: ${stile.attributes.colorHex}. ")
        if (stile.attributes.tags.isNotEmpty()) append("Tag: ${stile.attributes.tags.joinToString(", ")}. ")
        append("Mantieni il viso e l'identita' della persona invariati, cambia solo lo stile richiesto.")
    }

    fun perTryOn(capo: WardrobeItem): String = buildString {
        append("Vesti la persona nella foto con un capo cosi' descritto: \"${capo.name}\" ")
        append("(categoria: ${capo.category.etichetta.lowercase()}, colore dominante ${capo.dominantColorHex}). ")
        append("Adatta il capo a posa e proporzioni della persona, mantenendo viso e sfondo invariati.")
    }
}
