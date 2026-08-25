package it.vstudioapps.faceguard.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import it.vstudioapps.faceguard.data.SettingsRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * Restarts monitoring after the device reboots, if it was running before shutdown. Without
 * this, a phone that restarts (update, battery death, manual reboot) silently stops protecting
 * the screen until the user notices and reopens the app.
 */
class BootRestartReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        // Reading DataStore is a suspend call, and BroadcastReceiver.onReceive must return
        // quickly — goAsync() extends the receiver's lifetime just long enough to finish it.
        val pendingResult = goAsync()
        val appContext = context.applicationContext
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val settings = SettingsRepository(appContext).settings.first()
                if (settings.monitoringEnabled && settings.ownerFaceSignature != null) {
                    ContextCompat.startForegroundService(
                        appContext,
                        Intent(appContext, PresenceMonitorService::class.java)
                    )
                }
            } finally {
                pendingResult.finish()
            }
        }
    }
}
