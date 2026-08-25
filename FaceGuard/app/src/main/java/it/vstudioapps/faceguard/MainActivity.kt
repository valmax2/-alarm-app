package it.vstudioapps.faceguard

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import it.vstudioapps.faceguard.billing.BillingRepository
import it.vstudioapps.faceguard.data.SettingsRepository
import it.vstudioapps.faceguard.model.AppSettings
import it.vstudioapps.faceguard.model.FaceSignature
import it.vstudioapps.faceguard.security.FaceGuardDeviceAdminReceiver
import it.vstudioapps.faceguard.service.PresenceMonitorService
import it.vstudioapps.faceguard.service.PresenceStatusBus
import it.vstudioapps.faceguard.ui.FaceGuardApp
import it.vstudioapps.faceguard.ui.rememberPermissionsState
import kotlinx.coroutines.launch

// BiometricPrompt requires a FragmentActivity: it needs to attach an invisible Fragment to
// host the system biometric dialog and receive its result.
class MainActivity : FragmentActivity() {

    private lateinit var settingsRepository: SettingsRepository
    private lateinit var billingRepository: BillingRepository
    private lateinit var crashPrefs: android.content.SharedPreferences
    private val showEnrollment = mutableStateOf(false)

    private val requestCameraPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }
    private val requestNotificationsPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }
    private val requestOverlayPermission =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { }
    private val requestDeviceAdmin =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { }
    private val requestBatteryOptimizationExemption =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { }
    private val pickImage =
        registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
            if (uri != null) persistCustomImage(uri)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        settingsRepository = SettingsRepository(this)
        billingRepository = BillingRepository(this)
        billingRepository.connect()
        crashPrefs = getSharedPreferences("crash_log_v1", MODE_PRIVATE)
        installCrashHandler()
        val lastCrash = crashPrefs.getString(KEY_LAST_CRASH, null)

        setContent {
            val settings by settingsRepository.settings.collectAsState(initial = AppSettings())
            val presenceState by PresenceStatusBus.state.collectAsState()
            val isPro by billingRepository.isPro.collectAsState()
            val proPriceLabel by billingRepository.proPriceLabel.collectAsState()
            val permissions = rememberPermissionsState()
            val enrolling by showEnrollment

            // Mirrors Billing's entitlement into DataStore: PresenceMonitorService has no
            // access to BillingClient itself, so this is how it finds out the Pro state at all.
            LaunchedEffect(isPro) {
                settingsRepository.setProEntitlement(isPro)
            }

            FaceGuardApp(
                settings = settings,
                permissions = permissions,
                presenceState = presenceState,
                showEnrollment = enrolling,
                isPro = isPro,
                onPurchasePro = { billingRepository.launchPurchase(this) },
                proPriceLabel = proPriceLabel,
                lastCrashReport = lastCrash,
                onCrashReportDismissed = { crashPrefs.edit().remove(KEY_LAST_CRASH).apply() },
                onRequestCameraPermission = {
                    requestCameraPermission.launch(android.Manifest.permission.CAMERA)
                },
                onRequestNotificationsPermission = {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        requestNotificationsPermission.launch(android.Manifest.permission.POST_NOTIFICATIONS)
                    }
                },
                onRequestOverlayPermission = {
                    val intent = Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:$packageName")
                    )
                    requestOverlayPermission.launch(intent)
                },
                onRequestDeviceAdmin = {
                    val adminComponent = ComponentName(this, FaceGuardDeviceAdminReceiver::class.java)
                    val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                        putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent)
                        putExtra(
                            DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                            getString(R.string.device_admin_explanation)
                        )
                    }
                    requestDeviceAdmin.launch(intent)
                },
                onRevokeDeviceAdmin = {
                    val devicePolicyManager =
                        getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
                    val adminComponent = ComponentName(this, FaceGuardDeviceAdminReceiver::class.java)
                    devicePolicyManager.removeActiveAdmin(adminComponent)
                },
                onRequestBatteryOptimizationExemption = {
                    val intent = Intent(
                        Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                        Uri.parse("package:$packageName")
                    )
                    requestBatteryOptimizationExemption.launch(intent)
                },
                onPickCustomImage = {
                    pickImage.launch(
                        androidx.activity.result.PickVisualMediaRequest(
                            ActivityResultContracts.PickVisualMedia.ImageOnly
                        )
                    )
                },
                onThemeModeChange = { mode ->
                    lifecycleScope.launch { settingsRepository.setThemeMode(mode) }
                },
                onCoverModeChange = { mode ->
                    lifecycleScope.launch { settingsRepository.setCoverMode(mode) }
                },
                onThresholdChange = { seconds ->
                    lifecycleScope.launch { settingsRepository.setAbsenceThresholdSeconds(seconds) }
                },
                onToggleMonitoring = { enabled ->
                    lifecycleScope.launch { settingsRepository.setMonitoringEnabled(enabled) }
                    if (enabled) {
                        PresenceMonitorService.start(this)
                    } else {
                        PresenceMonitorService.stop(this)
                    }
                },
                onStartEnrollment = { startEnrollment(settings.monitoringEnabled) },
                onEnrollmentComplete = { signature ->
                    lifecycleScope.launch { settingsRepository.setOwnerFaceSignature(signature) }
                    showEnrollment.value = false
                },
                onCancelEnrollment = { showEnrollment.value = false },
                onClearEnrollment = {
                    lifecycleScope.launch {
                        settingsRepository.clearOwnerFaceSignature()
                        settingsRepository.setMonitoringEnabled(false)
                    }
                    PresenceMonitorService.stop(this)
                }
            )
        }
    }

    override fun onDestroy() {
        billingRepository.disconnect()
        super.onDestroy()
    }

    /**
     * The monitoring service and the enrollment screen can't hold the front camera at the
     * same time, so monitoring is stopped first if it was running. A successful system
     * biometric check (fingerprint/Face Unlock/PIN) — proving this really is the device's
     * owner — gates entry to the capture screen itself.
     */
    private fun startEnrollment(monitoringWasRunning: Boolean) {
        if (monitoringWasRunning) {
            lifecycleScope.launch { settingsRepository.setMonitoringEnabled(false) }
            PresenceMonitorService.stop(this)
        }
        requestBiometric { success, _ ->
            if (success) showEnrollment.value = true
        }
    }

    /**
     * Records the last uncaught crash to SharedPreferences (not to any external service — see
     * the "robustezza" discussion: real Crashlytics needs the user's own Firebase project) so
     * it can be shown once, next launch, instead of silently vanishing from a debug APK with
     * no attached debugger.
     */
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

    private fun persistCustomImage(uri: Uri) {
        runCatching {
            contentResolver.takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION
            )
        }
        lifecycleScope.launch { settingsRepository.setCustomImageUri(uri.toString()) }
    }

    private fun requestBiometric(onResult: (Boolean, String?) -> Unit) {
        val authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG or
            BiometricManager.Authenticators.DEVICE_CREDENTIAL
        if (BiometricManager.from(this).canAuthenticate(authenticators) !=
            BiometricManager.BIOMETRIC_SUCCESS
        ) {
            onResult(false, "Nessun blocco schermo sicuro configurato sul dispositivo")
            return
        }

        val prompt = BiometricPrompt(
            this,
            ContextCompat.getMainExecutor(this),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    onResult(true, null)
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    onResult(false, errString.toString())
                }

                override fun onAuthenticationFailed() {
                    onResult(false, "Verifica non riuscita")
                }
            }
        )
        prompt.authenticate(
            BiometricPrompt.PromptInfo.Builder()
                .setTitle("Conferma la tua identità")
                .setSubtitle("Serve per registrare il volto da riconoscere")
                .setAllowedAuthenticators(authenticators)
                .build()
        )
    }

    companion object {
        private const val KEY_LAST_CRASH = "last_crash"
    }
}
