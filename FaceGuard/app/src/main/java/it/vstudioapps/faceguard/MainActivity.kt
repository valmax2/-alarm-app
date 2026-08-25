package it.vstudioapps.faceguard

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.lifecycleScope
import it.vstudioapps.faceguard.data.SettingsRepository
import it.vstudioapps.faceguard.model.AppSettings
import it.vstudioapps.faceguard.security.FaceGuardDeviceAdminReceiver
import it.vstudioapps.faceguard.service.PresenceMonitorService
import it.vstudioapps.faceguard.service.PresenceStatusBus
import it.vstudioapps.faceguard.ui.FaceGuardApp
import it.vstudioapps.faceguard.ui.rememberPermissionsState
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private lateinit var settingsRepository: SettingsRepository

    private val requestCameraPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }
    private val requestNotificationsPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }
    private val requestOverlayPermission =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { }
    private val requestDeviceAdmin =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { }
    private val pickImage =
        registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
            if (uri != null) persistCustomImage(uri)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        settingsRepository = SettingsRepository(this)

        setContent {
            val settings by settingsRepository.settings.collectAsState(initial = AppSettings())
            val presenceState by PresenceStatusBus.state.collectAsState()
            val permissions = rememberPermissionsState()

            FaceGuardApp(
                settings = settings,
                permissions = permissions,
                presenceState = presenceState,
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
                }
            )
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
}
