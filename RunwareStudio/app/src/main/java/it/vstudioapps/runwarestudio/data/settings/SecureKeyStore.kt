package it.vstudioapps.runwarestudio.data.settings

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Holds the user's own API keys for every provider the app talks to, encrypted at rest via
 * the Android Keystore-backed MasterKey. Kept separate from SettingsRepository's plaintext
 * DataStore preferences on purpose — these are the pieces of data in the app that authorize
 * real spend on the user's own accounts. Never logged, never included in the archive
 * database, never sent anywhere except as the auth header of requests to that provider's API.
 */
class SecureKeyStore(context: Context) {

    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context.applicationContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context.applicationContext,
            "runware_secure_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    fun getApiKey(): String? = prefs.getString(KEY_API_KEY, null)?.takeIf { it.isNotBlank() }

    fun setApiKey(key: String?) {
        prefs.edit().apply {
            if (key.isNullOrBlank()) remove(KEY_API_KEY) else putString(KEY_API_KEY, key.trim())
        }.apply()
    }

    fun hasApiKey(): Boolean = !getApiKey().isNullOrBlank()

    /** Optional: only needed for "Scambia volto (Segmind)" on Home — everything else in the
     *  app works fine without it. See data/api/SegmindApiClient.kt. */
    fun getSegmindApiKey(): String? = prefs.getString(KEY_SEGMIND_API_KEY, null)?.takeIf { it.isNotBlank() }

    fun setSegmindApiKey(key: String?) {
        prefs.edit().apply {
            if (key.isNullOrBlank()) remove(KEY_SEGMIND_API_KEY) else putString(KEY_SEGMIND_API_KEY, key.trim())
        }.apply()
    }

    fun hasSegmindApiKey(): Boolean = !getSegmindApiKey().isNullOrBlank()

    private companion object {
        const val KEY_API_KEY = "runware_api_key"
        const val KEY_SEGMIND_API_KEY = "segmind_api_key"
    }
}
