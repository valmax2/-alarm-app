package it.vstudioapps.stylestudio3d.data

import android.content.Context
import it.vstudioapps.stylestudio3d.domain.model.GenerationResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

/**
 * Cronologia degli scatti generati in Studio Fotografico. E' la lista che viene sincronizzata
 * su Google Drive (vedi [it.vstudioapps.stylestudio3d.drive.GoogleDriveSyncService]).
 */
class GenerationHistoryRepository(private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true }
    private val file: File get() = File(context.filesDir, "generation_history.json")

    private val _creazioni = MutableStateFlow<List<GenerationResult>>(emptyList())
    val creazioni: StateFlow<List<GenerationResult>> = _creazioni.asStateFlow()

    suspend fun inizializza() = withContext(Dispatchers.IO) {
        _creazioni.value = runCatching {
            if (!file.exists()) return@runCatching emptyList()
            json.decodeFromString(ListaSerializzabile.serializer(), file.readText()).elementi
        }.getOrDefault(emptyList())
    }

    suspend fun aggiungi(risultato: GenerationResult) = withContext(Dispatchers.IO) {
        _creazioni.value = listOf(risultato) + _creazioni.value
        salva()
    }

    suspend fun elimina(id: String) = withContext(Dispatchers.IO) {
        val voce = _creazioni.value.find { it.id == id }
        _creazioni.value = _creazioni.value.filterNot { it.id == id }
        voce?.let { runCatching { File(it.imagePath).delete() } }
        salva()
    }

    private fun salva() {
        runCatching { file.writeText(json.encodeToString(ListaSerializzabile.serializer(), ListaSerializzabile(_creazioni.value))) }
    }

    @Serializable
    private data class ListaSerializzabile(val elementi: List<GenerationResult> = emptyList())
}
