package it.vstudioapps.stylestudio3d.data

import android.content.Context
import it.vstudioapps.stylestudio3d.domain.model.StyleAttributes
import it.vstudioapps.stylestudio3d.domain.model.StyleCatalogEntry
import it.vstudioapps.stylestudio3d.domain.model.StyleCatalogSeed
import it.vstudioapps.stylestudio3d.domain.model.StyleCategory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File
import java.util.UUID

/**
 * Catalogo stili: unisce sempre il seed "di serie" definito in codice ([StyleCatalogSeed], cosi'
 * si arricchisce automaticamente con gli aggiornamenti dell'app) con le voci create dall'utente
 * e le eventuali anteprime fotorealistiche importate — le uniche due cose persistite su file.
 * Espone lo stato come [StateFlow] cosi' ogni schermata vede immediatamente un nuovo stile creato.
 */
class StyleCatalogRepository(private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true; prettyPrint = false }
    private val file: File get() = File(context.filesDir, "style_catalog.json")

    private val _stili = MutableStateFlow<List<StyleCatalogEntry>>(StyleCatalogSeed.tutti())
    val stili: StateFlow<List<StyleCatalogEntry>> = _stili.asStateFlow()

    suspend fun inizializza() = withContext(Dispatchers.IO) {
        val salvato = leggiDaFile() ?: return@withContext
        val overrides = salvato.anteprimeImportate
        val seedConOverride = StyleCatalogSeed.tutti().map { seed ->
            overrides[seed.id]?.let { seed.copy(importedPreviewPath = it) } ?: seed
        }
        val personalizzatiConOverride = salvato.personalizzati.map { custom ->
            overrides[custom.id]?.let { custom.copy(importedPreviewPath = it) } ?: custom
        }
        _stili.value = seedConOverride + personalizzatiConOverride
    }

    fun perCategoria(categoria: StyleCategory): List<StyleCatalogEntry> = _stili.value.filter { it.category == categoria }

    /** Crea e salva subito una nuova voce con nome libero scritto dall'utente. */
    suspend fun creaStilePersonalizzato(categoria: StyleCategory, nome: String, attributi: StyleAttributes): StyleCatalogEntry {
        val nuovo = StyleCatalogEntry(
            id = "custom-${UUID.randomUUID()}",
            category = categoria,
            name = nome.trim(),
            attributes = attributi,
            isBuiltIn = false,
            createdAtEpochMillis = System.currentTimeMillis(),
        )
        _stili.value = _stili.value + nuovo
        salvaSuFile()
        return nuovo
    }

    suspend fun eliminaStilePersonalizzato(id: String) {
        _stili.value = _stili.value.filterNot { it.id == id && !it.isBuiltIn }
        salvaSuFile()
    }

    /** Collega un'immagine reale (es. generata in locale con ComfyUI) a una voce qualsiasi del catalogo. */
    suspend fun impostaAnteprimaImportata(id: String, percorsoFile: String?) {
        _stili.value = _stili.value.map { if (it.id == id) it.copy(importedPreviewPath = percorsoFile) else it }
        salvaSuFile()
    }

    private suspend fun salvaSuFile() = withContext(Dispatchers.IO) {
        val personalizzati = _stili.value.filterNot { it.isBuiltIn }
        val anteprimeImportate = _stili.value.mapNotNull { entry -> entry.importedPreviewPath?.let { entry.id to it } }.toMap()
        val stato = CatalogoSalvato(personalizzati, anteprimeImportate)
        runCatching { file.writeText(json.encodeToString(CatalogoSalvato.serializer(), stato)) }
    }

    private fun leggiDaFile(): CatalogoSalvato? {
        if (!file.exists()) return null
        return runCatching { json.decodeFromString(CatalogoSalvato.serializer(), file.readText()) }.getOrNull()
    }

    @Serializable
    private data class CatalogoSalvato(
        val personalizzati: List<StyleCatalogEntry> = emptyList(),
        val anteprimeImportate: Map<String, String> = emptyMap(),
    )
}
