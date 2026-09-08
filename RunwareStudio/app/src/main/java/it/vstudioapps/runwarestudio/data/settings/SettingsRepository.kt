package it.vstudioapps.runwarestudio.data.settings

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import it.vstudioapps.runwarestudio.data.ModelCatalog
import it.vstudioapps.runwarestudio.model.AppSettings
import it.vstudioapps.runwarestudio.model.ThemeMode
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "runwarestudio_settings")

/** Persists and exposes every non-secret user preference as a single observable [AppSettings]. */
class SettingsRepository(private val context: Context) {

    private object Keys {
        val THEME_MODE = stringPreferencesKey("theme_mode")
        val ONBOARDING_COMPLETED = booleanPreferencesKey("onboarding_completed")
        val ADULT_TERMS_ACCEPTED = booleanPreferencesKey("adult_terms_accepted")
        val LAST_MODEL_ID = stringPreferencesKey("last_model_id")
    }

    val settings: Flow<AppSettings> = context.dataStore.data.map { prefs ->
        AppSettings(
            themeMode = prefs[Keys.THEME_MODE]
                ?.let { runCatching { ThemeMode.valueOf(it) }.getOrNull() }
                ?: ThemeMode.default,
            onboardingCompleted = prefs[Keys.ONBOARDING_COMPLETED] ?: false,
            adultTermsAccepted = prefs[Keys.ADULT_TERMS_ACCEPTED] ?: false,
            lastSelectedModelId = prefs[Keys.LAST_MODEL_ID] ?: ModelCatalog.default.id
        )
    }

    suspend fun setThemeMode(mode: ThemeMode) {
        context.dataStore.edit { it[Keys.THEME_MODE] = mode.name }
    }

    suspend fun setOnboardingCompleted(completed: Boolean) {
        context.dataStore.edit { it[Keys.ONBOARDING_COMPLETED] = completed }
    }

    suspend fun setAdultTermsAccepted(accepted: Boolean) {
        context.dataStore.edit { it[Keys.ADULT_TERMS_ACCEPTED] = accepted }
    }

    suspend fun setLastSelectedModelId(modelId: String) {
        context.dataStore.edit { it[Keys.LAST_MODEL_ID] = modelId }
    }
}
