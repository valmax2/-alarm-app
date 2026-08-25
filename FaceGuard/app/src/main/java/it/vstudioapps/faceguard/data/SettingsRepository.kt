package it.vstudioapps.faceguard.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import it.vstudioapps.faceguard.model.AppSettings
import it.vstudioapps.faceguard.model.CoverMode
import it.vstudioapps.faceguard.model.FaceSignature
import it.vstudioapps.faceguard.model.ThemeMode
import it.vstudioapps.faceguard.security.FaceSignatureCrypto
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "faceguard_settings")

/** Persists and exposes every user preference as a single observable [AppSettings]. */
class SettingsRepository(private val context: Context) {

    private object Keys {
        val THEME_MODE = stringPreferencesKey("theme_mode")
        val COVER_MODE = stringPreferencesKey("cover_mode")
        val THRESHOLD_SECONDS = intPreferencesKey("absence_threshold_seconds")
        val CUSTOM_IMAGE_URI = stringPreferencesKey("custom_image_uri")
        val MONITORING_ENABLED = booleanPreferencesKey("monitoring_enabled")
        val OWNER_FACE_SIGNATURE = stringPreferencesKey("owner_face_signature")
    }

    val settings: Flow<AppSettings> = context.dataStore.data.map { prefs ->
        AppSettings(
            themeMode = prefs[Keys.THEME_MODE]?.let { runCatching { ThemeMode.valueOf(it) }.getOrNull() }
                ?: ThemeMode.default,
            coverMode = prefs[Keys.COVER_MODE]?.let { runCatching { CoverMode.valueOf(it) }.getOrNull() }
                ?: CoverMode.default,
            absenceThresholdSeconds = prefs[Keys.THRESHOLD_SECONDS] ?: AppSettings.DEFAULT_THRESHOLD_SECONDS,
            customImageUri = prefs[Keys.CUSTOM_IMAGE_URI],
            monitoringEnabled = prefs[Keys.MONITORING_ENABLED] ?: false,
            ownerFaceSignature = prefs[Keys.OWNER_FACE_SIGNATURE]
                ?.let { FaceSignatureCrypto.decrypt(it) }
                ?.let { FaceSignature.fromStorageString(it) }
        )
    }

    suspend fun setThemeMode(mode: ThemeMode) {
        context.dataStore.edit { it[Keys.THEME_MODE] = mode.name }
    }

    suspend fun setCoverMode(mode: CoverMode) {
        context.dataStore.edit { it[Keys.COVER_MODE] = mode.name }
    }

    suspend fun setAbsenceThresholdSeconds(seconds: Int) {
        context.dataStore.edit { it[Keys.THRESHOLD_SECONDS] = AppSettings.clampThresholdSeconds(seconds) }
    }

    suspend fun setCustomImageUri(uri: String?) {
        context.dataStore.edit {
            if (uri == null) it.remove(Keys.CUSTOM_IMAGE_URI) else it[Keys.CUSTOM_IMAGE_URI] = uri
        }
    }

    suspend fun setMonitoringEnabled(enabled: Boolean) {
        context.dataStore.edit { it[Keys.MONITORING_ENABLED] = enabled }
    }

    suspend fun setOwnerFaceSignature(signature: FaceSignature) {
        val encrypted = FaceSignatureCrypto.encrypt(signature.toStorageString())
        context.dataStore.edit { it[Keys.OWNER_FACE_SIGNATURE] = encrypted }
    }

    suspend fun clearOwnerFaceSignature() {
        context.dataStore.edit { it.remove(Keys.OWNER_FACE_SIGNATURE) }
    }
}
