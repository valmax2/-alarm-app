package it.vstudioapps.stylestudio3d.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Storage cifrato (chiave in Android Keystore, non esportabile) per segreti che non devono mai
 * finire in chiaro su disco o in un file JSON: API key dell'abbonamento AI, eventuale token
 * Google Drive. Il nome file "secure_credentials.xml" e' escluso esplicitamente dal backup
 * (vedi res/xml/data_extraction_rules.xml), perche' la chiave di cifratura non sopravvive a un
 * ripristino su un altro dispositivo.
 */
class SecureCredentialStore(context: Context) {

    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "secure_credentials",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    fun salvaAiApiKey(apiKey: String) {
        prefs.edit().putString(KEY_AI_API_KEY, apiKey).apply()
    }

    fun leggiAiApiKey(): String? = prefs.getString(KEY_AI_API_KEY, null)

    fun rimuoviAiApiKey() {
        prefs.edit().remove(KEY_AI_API_KEY).apply()
    }

    private companion object {
        const val KEY_AI_API_KEY = "ai_api_key"
    }
}
