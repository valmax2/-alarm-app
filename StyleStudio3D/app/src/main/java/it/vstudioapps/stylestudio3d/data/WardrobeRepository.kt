package it.vstudioapps.stylestudio3d.data

import android.content.Context
import android.net.Uri
import it.vstudioapps.stylestudio3d.domain.model.GarmentCategory
import it.vstudioapps.stylestudio3d.domain.model.WardrobeItem
import it.vstudioapps.stylestudio3d.util.ImageIo
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
 * Guardaroba virtuale: ogni capo nasce da una foto reale caricata dall'utente (mai generata),
 * copiata nello storage privato dell'app cosi' resta disponibile anche se l'utente cancella la
 * foto originale dalla galleria. E' la base sia della prova virtuale sia dell'incrocio con
 * l'armocromia.
 */
class WardrobeRepository(private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true }
    private val indiceFile: File get() = File(context.filesDir, "wardrobe_index.json")
    private val cartellaFoto: File get() = File(context.filesDir, "wardrobe_photos")

    private val _capi = MutableStateFlow<List<WardrobeItem>>(emptyList())
    val capi: StateFlow<List<WardrobeItem>> = _capi.asStateFlow()

    suspend fun inizializza() = withContext(Dispatchers.IO) {
        _capi.value = runCatching {
            if (!indiceFile.exists()) return@runCatching emptyList()
            json.decodeFromString(ListaSerializzabile.serializer(), indiceFile.readText()).elementi
        }.getOrDefault(emptyList())
    }

    fun perCategoria(categoria: GarmentCategory): List<WardrobeItem> = _capi.value.filter { it.category == categoria }

    /** Copia la foto scelta dal Photo Picker nello storage privato ed estrae il colore dominante. */
    suspend fun aggiungiCapo(uriFoto: Uri, categoria: GarmentCategory, nome: String): WardrobeItem? = withContext(Dispatchers.IO) {
        val fileCopiato = ImageIo.copiaUriInStorageInterno(context, uriFoto, cartellaFoto) ?: return@withContext null
        val bitmap = ImageIo.decodificaBitmapDaFile(fileCopiato.absolutePath) ?: run {
            fileCopiato.delete()
            return@withContext null
        }
        val colore = ImageIo.coloreDominante(bitmap)
        bitmap.recycle()

        val capo = WardrobeItem(
            id = "capo-${UUID.randomUUID()}",
            category = categoria,
            name = nome.ifBlank { categoria.etichetta },
            photoPath = fileCopiato.absolutePath,
            dominantColorHex = colore,
            createdAtEpochMillis = System.currentTimeMillis(),
        )
        _capi.value = _capi.value + capo
        salvaIndice()
        capo
    }

    suspend fun rimuoviCapo(id: String) = withContext(Dispatchers.IO) {
        val capo = _capi.value.find { it.id == id }
        _capi.value = _capi.value.filterNot { it.id == id }
        capo?.let { runCatching { File(it.photoPath).delete() } }
        salvaIndice()
    }

    private fun salvaIndice() {
        runCatching { indiceFile.writeText(json.encodeToString(ListaSerializzabile.serializer(), ListaSerializzabile(_capi.value))) }
    }

    @Serializable
    private data class ListaSerializzabile(val elementi: List<WardrobeItem> = emptyList())
}
