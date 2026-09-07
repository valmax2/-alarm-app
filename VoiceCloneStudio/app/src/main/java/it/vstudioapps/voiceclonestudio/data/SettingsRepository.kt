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

/** Preferenze non sensibili: ultimo modello usato e ultimi valori delle slider, per non doverli reimpostare ad ogni generazione. */
class SettingsRepository(context: Context) {

    private val dataStore = context.applicationContext.dataStore

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

    companion object {
        private val KEY_MODEL_ID = stringPreferencesKey("default_model_id")
        private val KEY_STABILITY = floatPreferencesKey("default_stability")
        private val KEY_SIMILARITY = floatPreferencesKey("default_similarity")
        private val KEY_STYLE = floatPreferencesKey("default_style")
        private val KEY_SPEAKER_BOOST = booleanPreferencesKey("default_speaker_boost")
        private val KEY_SPEED = floatPreferencesKey("default_speed")
    }
}
