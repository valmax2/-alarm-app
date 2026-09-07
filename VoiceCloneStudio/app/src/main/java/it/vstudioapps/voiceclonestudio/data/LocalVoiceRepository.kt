package it.vstudioapps.voiceclonestudio.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

private val Context.localVoicesDataStore by preferencesDataStore(name = "voice_clone_local_voices")

/**
 * Voci gestite per il backend "server personale": qui non c'è nulla da caricare da nessuna
 * parte, la voce È i suoi campioni audio, tenuti sul telefono e inviati al server ad ogni
 * generazione. Stesso pattern di [HistoryRepository] (lista JSON in DataStore).
 */
class LocalVoiceRepository(context: Context) {

    private val appContext = context.applicationContext
    private val dataStore = appContext.localVoicesDataStore
    private val json = Json { ignoreUnknownKeys = true }

    val voices: Flow<List<LocalVoice>> = dataStore.data.map { prefs ->
        val raw = prefs[KEY_VOICES] ?: return@map emptyList()
        runCatching { json.decodeFromString<List<LocalVoice>>(raw) }
            .getOrDefault(emptyList())
            .sortedByDescending { it.createdAtEpochMillis }
    }

    suspend fun addVoice(voice: LocalVoice) {
        dataStore.edit { prefs ->
            val current = prefs[KEY_VOICES]?.let {
                runCatching { json.decodeFromString<List<LocalVoice>>(it) }.getOrDefault(emptyList())
            } ?: emptyList()
            prefs[KEY_VOICES] = json.encodeToString(current + voice)
        }
    }

    suspend fun removeVoice(voiceId: String) {
        var toDelete: LocalVoice? = null
        dataStore.edit { prefs ->
            val current = prefs[KEY_VOICES]?.let {
                runCatching { json.decodeFromString<List<LocalVoice>>(it) }.getOrDefault(emptyList())
            } ?: emptyList()
            toDelete = current.firstOrNull { it.id == voiceId }
            prefs[KEY_VOICES] = json.encodeToString(current.filterNot { it.id == voiceId })
        }
        toDelete?.sampleFilePaths?.forEach { File(it).delete() }
    }

    /** Cartella dove salvare i campioni audio delle voci locali (persistente, sopravvive alla cache). */
    fun samplesDir(): File = File(appContext.getExternalFilesDir(null), "local_voice_samples").apply { mkdirs() }

    companion object {
        private val KEY_VOICES = stringPreferencesKey("local_voices_json")
    }
}
