package it.vstudioapps.fortknox.security

import android.content.Context
import android.util.Base64
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

class AuthStore(context: Context) {
    private val prefs = context.getSharedPreferences("vault_auth_v1", Context.MODE_PRIVATE)
    private val random = SecureRandom()

    val isConfigured: Boolean get() = prefs.contains(KEY_HASH)
    var biometricEnabled: Boolean
        get() = prefs.getBoolean(KEY_BIOMETRIC, true)
        set(value) = prefs.edit().putBoolean(KEY_BIOMETRIC, value).apply()
    var dialEnabled: Boolean
        get() = prefs.getBoolean(KEY_DIAL, true)
        set(value) = prefs.edit().putBoolean(KEY_DIAL, value).apply()
    var pinEnabled: Boolean
        get() = prefs.getBoolean(KEY_PIN, true)
        set(value) = prefs.edit().putBoolean(KEY_PIN, value).apply()
    var passwordEnabled: Boolean
        get() = prefs.getBoolean(KEY_PASSWORD, false)
        set(value) = prefs.edit().putBoolean(KEY_PASSWORD, value).apply()
    var backupWarningShown: Boolean
        get() = prefs.getBoolean(KEY_BACKUP_WARNING_SHOWN, false)
        set(value) = prefs.edit().putBoolean(KEY_BACKUP_WARNING_SHOWN, value).apply()

    fun configure(secret: CharArray, recoveryCode: CharArray) {
        require(secret.size >= 4)
        val salt = ByteArray(32).also(random::nextBytes)
        val recoverySalt = ByteArray(32).also(random::nextBytes)
        prefs.edit()
            .putString(KEY_SALT, salt.encode())
            .putString(KEY_HASH, derive(secret, salt).encode())
            .putString(KEY_RECOVERY_SALT, recoverySalt.encode())
            .putString(KEY_RECOVERY_HASH, derive(recoveryCode, recoverySalt).encode())
            .apply()
        secret.fill('\u0000')
        recoveryCode.fill('\u0000')
    }

    val lockoutRemainingSeconds: Long
        get() = ((prefs.getLong(KEY_LOCKED_UNTIL, 0L) - System.currentTimeMillis()) / 1000L)
            .coerceAtLeast(0L)

    fun verify(secret: CharArray): Boolean {
        if (lockoutRemainingSeconds > 0) {
            secret.fill('\u0000')
            return false
        }
        val valid = verifyAgainst(secret, KEY_SALT, KEY_HASH)
        if (valid) {
            prefs.edit().putInt(KEY_FAILURES, 0).putLong(KEY_LOCKED_UNTIL, 0L).apply()
        } else {
            val failures = prefs.getInt(KEY_FAILURES, 0) + 1
            val delayMillis = when {
                failures >= 10 -> 5 * 60_000L
                failures >= 5 -> 30_000L
                else -> 0L
            }
            prefs.edit()
                .putInt(KEY_FAILURES, failures)
                .putLong(KEY_LOCKED_UNTIL, System.currentTimeMillis() + delayMillis)
                .apply()
        }
        return valid
    }

    fun verifyRecovery(code: CharArray): Boolean =
        verifyAgainst(code, KEY_RECOVERY_SALT, KEY_RECOVERY_HASH)

    fun replaceSecretAfterRecovery(newSecret: CharArray) {
        val salt = ByteArray(32).also(random::nextBytes)
        prefs.edit()
            .putString(KEY_SALT, salt.encode())
            .putString(KEY_HASH, derive(newSecret, salt).encode())
            .apply()
        newSecret.fill('\u0000')
    }

    private fun verifyAgainst(value: CharArray, saltKey: String, hashKey: String): Boolean {
        val salt = prefs.getString(saltKey, null)?.decode() ?: return false
        val expected = prefs.getString(hashKey, null)?.decode() ?: return false
        val actual = derive(value, salt)
        value.fill('\u0000')
        return MessageDigest.isEqual(expected, actual)
    }

    private fun derive(value: CharArray, salt: ByteArray): ByteArray {
        val spec = PBEKeySpec(value, salt, ITERATIONS, 256)
        return try {
            SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                .generateSecret(spec)
                .encoded
        } finally {
            spec.clearPassword()
        }
    }

    private fun ByteArray.encode(): String = Base64.encodeToString(this, Base64.NO_WRAP)
    private fun String.decode(): ByteArray = Base64.decode(this, Base64.NO_WRAP)

    companion object {
        private const val ITERATIONS = 210_000
        private const val KEY_SALT = "credential_salt"
        private const val KEY_HASH = "credential_hash"
        private const val KEY_RECOVERY_SALT = "recovery_salt"
        private const val KEY_RECOVERY_HASH = "recovery_hash"
        private const val KEY_BIOMETRIC = "biometric_enabled"
        private const val KEY_DIAL = "dial_enabled"
        private const val KEY_PIN = "pin_enabled"
        private const val KEY_PASSWORD = "password_enabled"
        private const val KEY_BACKUP_WARNING_SHOWN = "backup_warning_shown"
        private const val KEY_FAILURES = "failed_attempts"
        private const val KEY_LOCKED_UNTIL = "locked_until"
    }
}
