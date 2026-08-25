package it.vstudioapps.faceguard.security

import android.app.admin.DeviceAdminReceiver

/**
 * Grants FaceGuard the "force-lock" device-admin policy (see res/xml/device_admin.xml),
 * needed only for the "Blocco schermo" cover mode to call
 * DevicePolicyManager#lockNow(). The user opts in explicitly from Settings; without it,
 * that cover mode falls back and cannot be selected.
 */
class FaceGuardDeviceAdminReceiver : DeviceAdminReceiver()
