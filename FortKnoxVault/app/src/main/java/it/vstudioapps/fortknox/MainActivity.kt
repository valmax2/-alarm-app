package it.vstudioapps.fortknox

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.WindowManager
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.platform.ComposeView
import androidx.core.content.ContextCompat
import androidx.core.content.IntentCompat
import androidx.fragment.app.FragmentActivity
import it.vstudioapps.fortknox.data.VaultRepository
import it.vstudioapps.fortknox.security.AuthStore
import it.vstudioapps.fortknox.ui.FortKnoxApp

class MainActivity : FragmentActivity() {
    private lateinit var authStore: AuthStore
    private lateinit var repository: VaultRepository
    private lateinit var crashPrefs: android.content.SharedPreferences
    private val pendingShareUris = mutableStateOf<List<Uri>?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        authStore = AuthStore(this)
        repository = VaultRepository(this)
        crashPrefs = getSharedPreferences("crash_log_v1", MODE_PRIVATE)
        installCrashHandler()
        val lastCrash = crashPrefs.getString(KEY_LAST_CRASH, null)
        pendingShareUris.value = extractSharedUris(intent)

        setContentView(
            ComposeView(this).apply {
                setContent {
                    val shareUris by pendingShareUris
                    FortKnoxApp(
                        authStore = authStore,
                        repository = repository,
                        requestBiometric = ::requestBiometric,
                        lastCrashReport = lastCrash,
                        onCrashReportDismissed = {
                            crashPrefs.edit().remove(KEY_LAST_CRASH).apply()
                        },
                        pendingShareUris = shareUris,
                        onPendingShareHandled = { pendingShareUris.value = null }
                    )
                }
            }
        )
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        extractSharedUris(intent)?.let { pendingShareUris.value = it }
    }

    private fun extractSharedUris(intent: Intent): List<Uri>? = when (intent.action) {
        Intent.ACTION_SEND ->
            IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java)
                ?.let { listOf(it) }
        Intent.ACTION_SEND_MULTIPLE ->
            IntentCompat.getParcelableArrayListExtra(intent, Intent.EXTRA_STREAM, Uri::class.java)
                ?.takeIf { it.isNotEmpty() }
        else -> null
    }

    private fun installCrashHandler() {
        val previousHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            runCatching {
                crashPrefs.edit()
                    .putString(KEY_LAST_CRASH, throwable.stackTraceToString().take(6000))
                    .commit()
            }
            previousHandler?.uncaughtException(thread, throwable)
        }
    }

    override fun onStop() {
        repository.clearShareCache()
        super.onStop()
    }

    private fun requestBiometric(onResult: (Boolean, String?) -> Unit) {
        val authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG
        if (BiometricManager.from(this).canAuthenticate(authenticators) !=
            BiometricManager.BIOMETRIC_SUCCESS
        ) {
            onResult(false, "Impronta o volto forte non configurati sul dispositivo")
            return
        }

        val prompt = BiometricPrompt(
            this,
            ContextCompat.getMainExecutor(this),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(
                    result: BiometricPrompt.AuthenticationResult
                ) {
                    onResult(true, null)
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    onResult(false, errString.toString())
                }

                override fun onAuthenticationFailed() {
                    onResult(false, "Riconoscimento non riuscito")
                }
            }
        )
        prompt.authenticate(
            BiometricPrompt.PromptInfo.Builder()
                .setTitle("Apri Fort Knox")
                .setSubtitle("Conferma la tua identità")
                .setAllowedAuthenticators(authenticators)
                .setNegativeButtonText("Usa combinazione")
                .build()
        )
    }

    companion object {
        private const val KEY_LAST_CRASH = "last_crash"
    }
}
