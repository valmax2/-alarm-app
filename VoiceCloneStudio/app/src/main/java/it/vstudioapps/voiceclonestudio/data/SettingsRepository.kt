package it.vstudioapps.voiceclonestudio.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "voice_clone_settings")

/** Preferenze non sensibili: backend scelto, ultimo modello/valori usati, per non doverli reimpostare ad ogni generazione. */
class SettingsRepository(context: Context) {

    private val dataStore = context.applicationContext.dataStore

    /** Quale motore genera la voce: ElevenLabs (cloud, a pagamento) o il server personale (gratis, sul PC dell'utente). */
    val backend: Flow<Backend> = dataStore.data.map { prefs ->
        val name = prefs[KEY_BACKEND]
        runCatching { name?.let { Backend.valueOf(it) } }.getOrNull() ?: Backend.SELF_HOSTED
    }

    suspend fun setBackend(backend: Backend) {
        dataStore.edit { it[KEY_BACKEND] = backend.name }
    }

    /** Indirizzo del server personale, es. "http://192.168.1.23:8020". */
    val serverUrl: Flow<String> = dataStore.data.map { it[KEY_SERVER_URL] ?: "" }

    suspend fun setServerUrl(url: String) {
        dataStore.edit { it[KEY_SERVER_URL] = url.trim() }
    }

    val defaultModelId: Flow<String> = dataStore.data.map {
        it[KEY_MODEL_ID] ?: TTS_MODELS.first().id
    }

    val defaultSettings: Flow<VoiceGenerationSettings> = dataStore.data.map { prefs ->
        VoiceGenerationSettings(
            stability = prefs[KEY_STABILITY] ?: VoiceGenerationSettings.RECOMMENDED.stability,
            similarityBoost = prefs[KEY_SIMILARITY] ?: VoiceGenerationSettings.RECOMMENDED.similarityBoost,
            style = prefs[KEY_STYLE] ?: VoiceGenerationSettings.RECOMMENDED.style,
            speakerBoost = prefs[KEY_SPEAKER_BOOST] ?: VoiceGenerationSettings.RECOMMENDED.speakerBoost,
            speed = prefs[KEY_SPEED] ?: VoiceGenerationSettings.RECOMMENDED.speed
        )
    }

    val selfHostedSettings: Flow<SelfHostedGenerationSettings> = dataStore.data.map { prefs ->
        SelfHostedGenerationSettings(
            speed = prefs[KEY_SELF_HOSTED_SPEED] ?: SelfHostedGenerationSettings.RECOMMENDED.speed
        )
    }

    suspend fun setDefaultModelId(modelId: String) {
        dataStore.edit { it[KEY_MODEL_ID] = modelId }
    }

    suspend fun setDefaultSettings(settings: VoiceGenerationSettings) {
        dataStore.edit {
            it[KEY_STABILITY] = settings.stability
            it[KEY_SIMILARITY] = settings.similarityBoost
            it[KEY_STYLE] = settings.style
            it[KEY_SPEAKER_BOOST] = settings.speakerBoost
            it[KEY_SPEED] = settings.speed
        }
    }

    suspend fun setSelfHostedSettings(settings: SelfHostedGenerationSettings) {
        dataStore.edit { it[KEY_SELF_HOSTED_SPEED] = settings.speed }
    }

    companion object {
        private val KEY_BACKEND = stringPreferencesKey("backend")
        private val KEY_SERVER_URL = stringPreferencesKey("server_url")
        private val KEY_MODEL_ID = stringPreferencesKey("default_model_id")
        private val KEY_STABILITY = floatPreferencesKey("default_stability")
        private val KEY_SIMILARITY = floatPreferencesKey("default_similarity")
        private val KEY_STYLE = floatPreferencesKey("default_style")
        private val KEY_SPEAKER_BOOST = booleanPreferencesKey("default_speaker_boost")
        private val KEY_SPEED = floatPreferencesKey("default_speed")
        private val KEY_SELF_HOSTED_SPEED = floatPreferencesKey("self_hosted_speed")
    }
}
