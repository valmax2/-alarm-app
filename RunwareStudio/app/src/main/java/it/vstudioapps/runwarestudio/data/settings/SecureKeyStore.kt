package it.vstudioapps.runwarestudio.data.settings

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Holds the user's own Runware API key, encrypted at rest via the Android Keystore-backed
 * MasterKey. Kept separate from SettingsRepository's plaintext DataStore preferences on
 * purpose — this is the one piece of data in the app that authorizes real spend on the
 * user's Runware account. Never logged, never included in the archive database, never sent
 * anywhere except as the Authorization header of requests to api.runware.ai.
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

    private companion object {
        const val KEY_API_KEY = "runware_api_key"
    }
}
