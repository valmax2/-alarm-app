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

private val Context.voiceSettingsDataStore by preferencesDataStore(name = "voice_clone_per_voice_settings")

/**
 * Le slider (stabilità, somiglianza, stile, ecc.) salvate per ciascuna voce clonata
 * separatamente, non un unico default condiviso — regolare "Checca" non deve toccare i valori
 * già trovati per un'altra voce. La chiave è il voice_id ElevenLabs.
 */
class VoiceSettingsRepository(context: Context) {

    private val dataStore = context.applicationContext.voiceSettingsDataStore
    private val json = Json { ignoreUnknownKeys = true }

    /** Tutte le impostazioni salvate, per voice_id. Chi la usa filtra sulla voce che gli serve. */
    val allSettings: Flow<Map<String, VoiceGenerationSettings>> = dataStore.data.map { prefs ->
        val raw = prefs[KEY_SETTINGS] ?: return@map emptyMap()
        runCatching { json.decodeFromString<Map<String, VoiceGenerationSettings>>(raw) }
            .getOrDefault(emptyMap())
    }

    suspend fun setSettingsFor(voiceId: String, settings: VoiceGenerationSettings) {
        dataStore.edit { prefs ->
            val current = prefs[KEY_SETTINGS]?.let {
                runCatching { json.decodeFromString<Map<String, VoiceGenerationSettings>>(it) }.getOrDefault(emptyMap())
            } ?: emptyMap()
            prefs[KEY_SETTINGS] = json.encodeToString(current + (voiceId to settings))
        }
    }

    companion object {
        private val KEY_SETTINGS = stringPreferencesKey("per_voice_settings_json")
    }
}
