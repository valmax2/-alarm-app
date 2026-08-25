package it.vstudioapps.stylestudio3d.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import it.vstudioapps.stylestudio3d.domain.model.AiProviderConfig
import it.vstudioapps.stylestudio3d.domain.model.AiProviderPreset
import it.vstudioapps.stylestudio3d.domain.model.ProfiloStile
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "user_prefs")

data class UserPreferences(
    val onboardingCompletato: Boolean = false,
    /** Null finche' l'utente non ha ancora scelto (prima schermata dell'onboarding). */
    val profiloStile: ProfiloStile? = null,
    val narrazioneAttiva: Boolean = true,
    val aiPreset: AiProviderPreset = AiProviderPreset.OPENAI_COMPATIBLE,
    val aiBaseUrl: String = "",
    val aiModel: String = "",
    val hasApiKeyConfigured: Boolean = false,
) {
    fun toAiProviderConfig() = AiProviderConfig(aiPreset, aiBaseUrl, aiModel, hasApiKeyConfigured)
}

/**
 * Preferenze non sensibili (nessuna API key qui: quella vive in [SecureCredentialStore]).
 * `hasApiKeyConfigured` e' solo un flag di comodo per sapere se mostrare "collegato" in UI
 * senza dover aprire lo storage cifrato ad ogni ricomposizione.
 */
class UserPreferencesRepository(private val context: Context) {

    private object Keys {
        val ONBOARDING_DONE = booleanPreferencesKey("onboarding_completato")
        val NARRATION_ON = booleanPreferencesKey("narrazione_attiva")
        val AI_PRESET = stringPreferencesKey("ai_preset")
        val AI_BASE_URL = stringPreferencesKey("ai_base_url")
        val AI_MODEL = stringPreferencesKey("ai_model")
        val AI_HAS_KEY = booleanPreferencesKey("ai_has_key")
        val PROFILO_STILE = stringPreferencesKey("profilo_stile")
    }

    val preferenze: Flow<UserPreferences> = context.dataStore.data.map { prefs ->
        UserPreferences(
            onboardingCompletato = prefs[Keys.ONBOARDING_DONE] ?: false,
            profiloStile = prefs[Keys.PROFILO_STILE]?.let { runCatching { ProfiloStile.valueOf(it) }.getOrNull() },
            narrazioneAttiva = prefs[Keys.NARRATION_ON] ?: true,
            aiPreset = prefs[Keys.AI_PRESET]?.let { runCatching { AiProviderPreset.valueOf(it) }.getOrNull() }
                ?: AiProviderPreset.OPENAI_COMPATIBLE,
            aiBaseUrl = prefs[Keys.AI_BASE_URL] ?: "",
            aiModel = prefs[Keys.AI_MODEL] ?: "",
            hasApiKeyConfigured = prefs[Keys.AI_HAS_KEY] ?: false,
        )
    }

    suspend fun setOnboardingCompletato(valore: Boolean) {
        context.dataStore.edit { it[Keys.ONBOARDING_DONE] = valore }
    }

    suspend fun setNarrazioneAttiva(valore: Boolean) {
        context.dataStore.edit { it[Keys.NARRATION_ON] = valore }
    }

    suspend fun setProfiloStile(valore: ProfiloStile) {
        context.dataStore.edit { it[Keys.PROFILO_STILE] = valore.name }
    }

    suspend fun salvaConfigurazioneAi(preset: AiProviderPreset, baseUrl: String, model: String, hasApiKey: Boolean) {
        context.dataStore.edit {
            it[Keys.AI_PRESET] = preset.name
            it[Keys.AI_BASE_URL] = baseUrl
            it[Keys.AI_MODEL] = model
            it[Keys.AI_HAS_KEY] = hasApiKey
        }
    }
}
