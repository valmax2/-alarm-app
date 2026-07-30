package it.vstudioapps.fortknox

import android.os.Bundle
import android.view.WindowManager
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.compose.ui.platform.ComposeView
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import it.vstudioapps.fortknox.data.VaultRepository
import it.vstudioapps.fortknox.security.AuthStore
import it.vstudioapps.fortknox.ui.FortKnoxApp

class MainActivity : FragmentActivity() {
    private lateinit var authStore: AuthStore
    private lateinit var repository: VaultRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        authStore = AuthStore(this)
        repository = VaultRepository(this)

        setContentView(
            ComposeView(this).apply {
                setContent {
                    FortKnoxApp(
                        authStore = authStore,
                        repository = repository,
                        requestBiometric = ::requestBiometric
                    )
                }
            }
        )
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
}
