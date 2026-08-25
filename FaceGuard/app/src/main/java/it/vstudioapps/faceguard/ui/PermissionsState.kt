package it.vstudioapps.faceguard.ui

import android.Manifest
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import it.vstudioapps.faceguard.security.FaceGuardDeviceAdminReceiver

/** Snapshot of every OS-level permission FaceGuard's features depend on. */
data class PermissionsState(
    val cameraGranted: Boolean,
    val notificationsGranted: Boolean,
    val overlayGranted: Boolean,
    val deviceAdminActive: Boolean,
    val batteryOptimizationIgnored: Boolean
) {
    /** Camera + notifications are all that's needed to start monitoring at all. */
    val canStartMonitoring: Boolean get() = cameraGranted && notificationsGranted
}

private fun snapshot(context: Context): PermissionsState {
    val cameraGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
        PackageManager.PERMISSION_GRANTED
    val notificationsGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
    } else {
        true
    }
    val overlayGranted = Settings.canDrawOverlays(context)
    val devicePolicyManager = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    val adminComponent = ComponentName(context, FaceGuardDeviceAdminReceiver::class.java)
    val deviceAdminActive = devicePolicyManager.isAdminActive(adminComponent)
    val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    val batteryOptimizationIgnored = powerManager.isIgnoringBatteryOptimizations(context.packageName)

    return PermissionsState(
        cameraGranted,
        notificationsGranted,
        overlayGranted,
        deviceAdminActive,
        batteryOptimizationIgnored
    )
}

/**
 * Re-checks every permission whenever the Activity resumes, which is when the user comes back
 * from a system Settings screen after granting (or denying) one of them.
 */
@Composable
fun rememberPermissionsState(): PermissionsState {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var state by remember { mutableStateOf(snapshot(context)) }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                state = snapshot(context)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    return state
}
