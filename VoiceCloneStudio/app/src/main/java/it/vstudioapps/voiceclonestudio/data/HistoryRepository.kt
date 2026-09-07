package it.vstudioapps.voiceclonestudio.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

private val Context.historyDataStore by preferencesDataStore(name = "voice_clone_history")

/**
 * Tiene la lista dei clip generati (TTS e conversione), più recenti prima. Le impostazioni
 * complete di ogni generazione restano salvate, così l'utente può richiamarle e ripartire
 * dagli stessi valori invece di ritararli da zero.
 */
class HistoryRepository(context: Context) {

    private val appContext = context.applicationContext
    private val dataStore = appContext.historyDataStore
    private val json = Json { ignoreUnknownKeys = true }

    val clips: Flow<List<GeneratedClip>> = dataStore.data.map { prefs ->
        val raw = prefs[KEY_CLIPS] ?: return@map emptyList()
        runCatching { json.decodeFromString<List<GeneratedClip>>(raw) }
            .getOrDefault(emptyList())
            .sortedByDescending { it.createdAtEpochMillis }
    }

    suspend fun addClip(clip: GeneratedClip) {
        dataStore.edit { prefs ->
            val current = prefs[KEY_CLIPS]?.let {
                runCatching { json.decodeFromString<List<GeneratedClip>>(it) }.getOrDefault(emptyList())
            } ?: emptyList()
            prefs[KEY_CLIPS] = json.encodeToString(current + clip)
        }
    }

    suspend fun removeClip(clipId: String) {
        val existing = clips.first()
        val target = existing.firstOrNull { it.id == clipId }
        dataStore.edit { prefs ->
            val current = prefs[KEY_CLIPS]?.let {
                runCatching { json.decodeFromString<List<GeneratedClip>>(it) }.getOrDefault(emptyList())
            } ?: emptyList()
            prefs[KEY_CLIPS] = json.encodeToString(current.filterNot { it.id == clipId })
        }
        target?.let { File(it.filePath).delete() }
    }

    /** Cartella dove salvare i clip prima di registrarli in cronologia. */
    fun clipsDir(): File = File(appContext.getExternalFilesDir(null), "clips").apply { mkdirs() }

    companion object {
        private val KEY_CLIPS = stringPreferencesKey("clips_json")
    }
}
