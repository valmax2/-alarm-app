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
import it.vstudioapps.faceguard.model.FaceSignature
import it.vstudioapps.faceguard.overlay.CoverOverlayController
import it.vstudioapps.faceguard.security.FaceGuardDeviceAdminReceiver
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Foreground service that keeps the front camera running, matches every visible face against
 * the enrolled owner's [FaceSignature], and — once the owner has been missing for the
 * configured threshold — activates whichever cover mode is currently selected.
 *
 * A face that doesn't match the owner counts the same as no face at all: it does not reset the
 * absence timer. This is a geometric-landmark signature, not a deep-learning face embedding —
 * see [FaceSignature]'s doc for what that means for accuracy. A single missed frame never
 * starts that timer on its own — see [MISS_CONFIRMATION_COUNT] — since one stray frame is
 * expected noise, not evidence the owner actually left.
 *
 * The cover is re-armed the moment the owner is recognized again: [CoverMode.BLACK_SCREEN] and
 * [CoverMode.CUSTOM_IMAGE] are removed immediately, while [CoverMode.LOCK_SCREEN] simply waits
 * for the next absence, since the device is already locked by the system at that point.
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
    @Volatile private var lastOwnerSeenAtMillis = System.currentTimeMillis()
    @Volatile private var ownerCurrentlyRecognized = true
    @Volatile private var coverTriggered = false
    @Volatile private var consecutiveMisses = 0

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

        startForeground(NOTIFICATION_ID, buildNotification(ownerRecognized = true, strangerDetected = false))
        lastOwnerSeenAtMillis = System.currentTimeMillis()
        ownerCurrentlyRecognized = true
        coverTriggered = false
        consecutiveMisses = 0
        PresenceStatusBus.update {
            it.copy(
                runState = ServiceRunState.RUNNING,
                ownerRecognized = true,
                strangerDetected = false,
                absentSinceMillis = null,
                coverActive = false
            )
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
                when {
                    !settings.monitoringEnabled -> stopSelf()
                    settings.ownerFaceSignature == null -> {
                        PresenceStatusBus.update { it.copy(runState = ServiceRunState.NOT_ENROLLED) }
                        stopSelf()
                    }
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

    private fun onFaceDetectionResult(faceDetected: Boolean, signature: FaceSignature?) {
        val owner = currentSettings.ownerFaceSignature
        val ownerRecognized = faceDetected && signature != null && owner != null &&
            (signature.distanceTo(owner) ?: Float.MAX_VALUE) <= FaceSignature.MATCH_THRESHOLD

        if (ownerRecognized) {
            consecutiveMisses = 0
            lastOwnerSeenAtMillis = System.currentTimeMillis()
            ownerCurrentlyRecognized = true
            if (coverTriggered) {
                coverTriggered = false
                if (overlayController.isShowing) overlayController.hide()
            }
            PresenceStatusBus.update {
                it.copy(
                    ownerRecognized = true,
                    strangerDetected = false,
                    absentSinceMillis = null,
                    coverActive = overlayController.isShowing
                )
            }
            updateNotification(ownerRecognized = true, strangerDetected = false)
            return
        }

        // A single missed frame is normal — motion blur, a brief odd angle, a hand passing by —
        // and shouldn't by itself start the absence clock, especially with a very low threshold
        // where even one stray frame would otherwise flash the cover on. Only a run of several
        // consecutive misses in a row counts as the owner actually being gone.
        consecutiveMisses++
        if (consecutiveMisses < MISS_CONFIRMATION_COUNT) return

        // A face that isn't the owner counts as absence too — it never resets the timer.
        ownerCurrentlyRecognized = false
        PresenceStatusBus.update {
            it.copy(ownerRecognized = false, strangerDetected = faceDetected, absentSinceMillis = lastOwnerSeenAtMillis)
        }
    }

    /**
     * Polls frequently (rather than reacting per-frame) so a threshold of just a second or two
     * — down to 0, for an instant reaction — still behaves predictably.
     */
    private fun startAbsenceWatcher() {
        lifecycleScope.launch {
            while (true) {
                delay(WATCHER_INTERVAL_MS)
                if (!ownerCurrentlyRecognized && !coverTriggered) {
                    val elapsedMs = System.currentTimeMillis() - lastOwnerSeenAtMillis
                    val thresholdMs = currentSettings.absenceThresholdSeconds * 1_000L
                    if (elapsedMs >= thresholdMs) {
                        triggerCover()
                    } else {
                        updateNotification(ownerRecognized = false, strangerDetected = false)
                    }
                }
            }
        }
    }

    private fun triggerCover() {
        coverTriggered = true

        // Custom image and lock screen are Pro-only. Settings UI already keeps a non-Pro user
        // from selecting them, but entitlement can lapse after selection (e.g. a refund) — so
        // it's re-checked here too, at the moment the mode actually engages, not just at
        // selection time. A lapsed entitlement falls back to the free black-screen cover rather
        // than silently keeping the screen uncovered.
        val effectiveMode = if (!currentSettings.isPro && currentSettings.coverMode != CoverMode.BLACK_SCREEN) {
            CoverMode.BLACK_SCREEN
        } else {
            currentSettings.coverMode
        }

        when (effectiveMode) {
            CoverMode.LOCK_SCREEN -> {
                if (devicePolicyManager.isAdminActive(adminComponent)) {
                    runCatching { devicePolicyManager.lockNow() }
                }
            }
            CoverMode.BLACK_SCREEN, CoverMode.CUSTOM_IMAGE -> {
                if (Settings.canDrawOverlays(this)) {
                    overlayController.show(effectiveMode, currentSettings.customImageUri)
                }
            }
        }
        PresenceStatusBus.update { it.copy(coverActive = overlayController.isShowing || effectiveMode == CoverMode.LOCK_SCREEN) }
        updateNotification(ownerRecognized = false, strangerDetected = false)
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

    private fun updateNotification(ownerRecognized: Boolean, strangerDetected: Boolean) {
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, buildNotification(ownerRecognized, strangerDetected))
    }

    private fun buildNotification(ownerRecognized: Boolean, strangerDetected: Boolean) = NotificationCompat.Builder(this, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_notification)
        .setContentTitle(getString(R.string.notification_title))
        .setContentText(
            getString(
                when {
                    ownerRecognized -> R.string.notification_text_present
                    strangerDetected -> R.string.notification_text_stranger
                    else -> R.string.notification_text_absent
                }
            )
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
        private const val WATCHER_INTERVAL_MS = 300L

        // How many analyzed frames in a row must fail to match the owner before treating them
        // as actually gone. Filters out single-frame noise (motion blur, a brief bad angle)
        // without adding a fixed delay — it rides however fast the camera actually delivers
        // frames, unlike a flat "wait N ms" would.
        private const val MISS_CONFIRMATION_COUNT = 3

        fun start(context: Context) {
            val intent = Intent(context, PresenceMonitorService::class.java)
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, PresenceMonitorService::class.java))
        }
    }
}
