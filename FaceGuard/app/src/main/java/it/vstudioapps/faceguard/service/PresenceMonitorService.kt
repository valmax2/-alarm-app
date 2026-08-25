package it.vstudioapps.faceguard.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.Settings
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import it.vstudioapps.faceguard.MainActivity
import it.vstudioapps.faceguard.R
import it.vstudioapps.faceguard.camera.FaceDetectionAnalyzer
import it.vstudioapps.faceguard.data.SettingsRepository
import it.vstudioapps.faceguard.model.AppSettings
import it.vstudioapps.faceguard.model.CoverMode
import it.vstudioapps.faceguard.overlay.CoverOverlayController
import it.vstudioapps.faceguard.security.FaceGuardDeviceAdminReceiver
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Foreground service that keeps the front camera running, feeds every frame to ML Kit face
 * detection, and — once the user's face has been missing for the configured threshold —
 * activates whichever cover mode is currently selected.
 *
 * The cover is re-armed the moment a face is seen again: [CoverMode.BLACK_SCREEN] and
 * [CoverMode.CUSTOM_IMAGE] are removed immediately, while [CoverMode.LOCK_SCREEN] simply
 * waits for the next absence, since the device is already locked by the system at that point.
 */
class PresenceMonitorService : LifecycleService() {

    private lateinit var settingsRepository: SettingsRepository
    private lateinit var overlayController: CoverOverlayController
    private lateinit var cameraExecutor: ExecutorService
    private lateinit var devicePolicyManager: DevicePolicyManager
    private lateinit var adminComponent: ComponentName

    private var cameraProvider: ProcessCameraProvider? = null
    private var analyzer: FaceDetectionAnalyzer? = null

    @Volatile private var currentSettings = AppSettings()
    @Volatile private var lastFaceSeenAtMillis = System.currentTimeMillis()
    @Volatile private var faceCurrentlyDetected = true
    @Volatile private var coverTriggered = false

    override fun onCreate() {
        super.onCreate()
        settingsRepository = SettingsRepository(this)
        overlayController = CoverOverlayController(applicationContext)
        cameraExecutor = Executors.newSingleThreadExecutor()
        devicePolicyManager = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        adminComponent = ComponentName(this, FaceGuardDeviceAdminReceiver::class.java)

        createNotificationChannel()
        PresenceStatusBus.update { it.copy(runState = ServiceRunState.STARTING) }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)

        if (ActivityCompat.checkSelfPermission(this, android.Manifest.permission.CAMERA) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            PresenceStatusBus.update { it.copy(runState = ServiceRunState.CAMERA_ERROR) }
            stopSelf()
            return START_NOT_STICKY
        }

        startForeground(NOTIFICATION_ID, buildNotification(faceDetected = true))
        lastFaceSeenAtMillis = System.currentTimeMillis()
        faceCurrentlyDetected = true
        coverTriggered = false
        PresenceStatusBus.update {
            it.copy(runState = ServiceRunState.RUNNING, faceDetected = true, absentSinceMillis = null, coverActive = false)
        }

        observeSettings()
        startCamera()
        startAbsenceWatcher()

        return START_STICKY
    }

    private fun observeSettings() {
        lifecycleScope.launch {
            settingsRepository.settings.collect { settings ->
                currentSettings = settings
                if (!settings.monitoringEnabled) {
                    stopSelf()
                }
            }
        }
    }

    private fun startCamera() {
        val providerFuture = ProcessCameraProvider.getInstance(this)
        providerFuture.addListener({
            val provider = providerFuture.get()
            cameraProvider = provider

            val imageAnalysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()

            val faceAnalyzer = FaceDetectionAnalyzer(
                onResult = ::onFaceDetectionResult,
                onError = { PresenceStatusBus.update { s -> s.copy(runState = ServiceRunState.CAMERA_ERROR) } }
            )
            analyzer = faceAnalyzer
            imageAnalysis.setAnalyzer(cameraExecutor, faceAnalyzer)

            runCatching {
                provider.unbindAll()
                provider.bindToLifecycle(
                    this,
                    CameraSelector.DEFAULT_FRONT_CAMERA,
                    imageAnalysis
                )
            }.onFailure {
                PresenceStatusBus.update { s -> s.copy(runState = ServiceRunState.CAMERA_ERROR) }
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun onFaceDetectionResult(faceDetected: Boolean) {
        faceCurrentlyDetected = faceDetected
        if (faceDetected) {
            lastFaceSeenAtMillis = System.currentTimeMillis()
            if (coverTriggered) {
                coverTriggered = false
                if (overlayController.isShowing) overlayController.hide()
            }
            PresenceStatusBus.update {
                it.copy(faceDetected = true, absentSinceMillis = null, coverActive = overlayController.isShowing)
            }
            updateNotification(faceDetected = true)
        } else {
            PresenceStatusBus.update { it.copy(faceDetected = false, absentSinceMillis = lastFaceSeenAtMillis) }
        }
    }

    /** Polls once a second rather than reacting per-frame, since the threshold is seconds-scale. */
    private fun startAbsenceWatcher() {
        lifecycleScope.launch {
            while (true) {
                delay(1_000)
                if (!faceCurrentlyDetected && !coverTriggered) {
                    val elapsedMs = System.currentTimeMillis() - lastFaceSeenAtMillis
                    val thresholdMs = currentSettings.absenceThresholdSeconds * 1_000L
                    if (elapsedMs >= thresholdMs) {
                        triggerCover()
                    } else {
                        updateNotification(faceDetected = false)
                    }
                }
            }
        }
    }

    private fun triggerCover() {
        coverTriggered = true
        when (currentSettings.coverMode) {
            CoverMode.LOCK_SCREEN -> {
                if (devicePolicyManager.isAdminActive(adminComponent)) {
                    runCatching { devicePolicyManager.lockNow() }
                }
            }
            CoverMode.BLACK_SCREEN, CoverMode.CUSTOM_IMAGE -> {
                if (Settings.canDrawOverlays(this)) {
                    overlayController.show(currentSettings.coverMode, currentSettings.customImageUri)
                }
            }
        }
        PresenceStatusBus.update { it.copy(coverActive = overlayController.isShowing || currentSettings.coverMode == CoverMode.LOCK_SCREEN) }
        updateNotification(faceDetected = false)
    }

    private fun createNotificationChannel() {
        val manager = getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = getString(R.string.notification_channel_description)
        }
        manager.createNotificationChannel(channel)
    }

    private fun updateNotification(faceDetected: Boolean) {
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, buildNotification(faceDetected))
    }

    private fun buildNotification(faceDetected: Boolean) = NotificationCompat.Builder(this, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_notification)
        .setContentTitle(getString(R.string.notification_title))
        .setContentText(
            getString(if (faceDetected) R.string.notification_text_present else R.string.notification_text_absent)
        )
        .setOngoing(true)
        .setContentIntent(
            PendingIntent.getActivity(
                this,
                0,
                Intent(this, MainActivity::class.java),
                PendingIntent.FLAG_IMMUTABLE
            )
        )
        .build()

    override fun onDestroy() {
        cameraProvider?.unbindAll()
        analyzer?.close()
        overlayController.hide()
        cameraExecutor.shutdown()
        PresenceStatusBus.reset()
        super.onDestroy()
    }

    companion object {
        private const val CHANNEL_ID = "presence_monitor"
        private const val NOTIFICATION_ID = 1001

        fun start(context: Context) {
            val intent = Intent(context, PresenceMonitorService::class.java)
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, PresenceMonitorService::class.java))
        }
    }
}
