package it.vstudioapps.faceguard.ui.screens

import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import it.vstudioapps.faceguard.camera.FaceDetectionAnalyzer
import it.vstudioapps.faceguard.model.FaceSignature
import kotlinx.coroutines.delay
import java.util.concurrent.Executors

private const val SAMPLES_NEEDED = 12

/**
 * Live front-camera preview that captures [SAMPLES_NEEDED] consecutive valid face-landmark
 * readings and averages them into the owner's reference [FaceSignature].
 *
 * Owns the camera for as long as it's shown, so the monitoring service must not be running at
 * the same time — the caller is responsible for stopping it first.
 */
@Composable
fun EnrollmentScreen(onComplete: (FaceSignature) -> Unit, onCancel: () -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val previewView = remember { PreviewView(context) }

    var samples by remember { mutableStateOf(listOf<FaceSignature>()) }
    var faceVisible by remember { mutableStateOf(false) }
    var done by remember { mutableStateOf(false) }

    DisposableEffect(Unit) {
        val cameraExecutor = Executors.newSingleThreadExecutor()
        var analyzer: FaceDetectionAnalyzer? = null
        val providerFuture = ProcessCameraProvider.getInstance(context)

        providerFuture.addListener({
            val provider = providerFuture.get()
            val preview = Preview.Builder().build().also { it.surfaceProvider = previewView.surfaceProvider }
            val imageAnalysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()

            val faceAnalyzer = FaceDetectionAnalyzer(
                onResult = { faceDetected, signature ->
                    faceVisible = faceDetected
                    if (signature != null && samples.size < SAMPLES_NEEDED) {
                        samples = samples + signature
                    }
                },
                onError = { }
            )
            analyzer = faceAnalyzer
            imageAnalysis.setAnalyzer(cameraExecutor, faceAnalyzer)

            runCatching {
                provider.unbindAll()
                provider.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_FRONT_CAMERA, preview, imageAnalysis)
            }
        }, ContextCompat.getMainExecutor(context))

        onDispose {
            runCatching { providerFuture.get().unbindAll() }
            analyzer?.close()
            cameraExecutor.shutdown()
        }
    }

    LaunchedEffect(samples.size) {
        if (samples.size >= SAMPLES_NEEDED && !done) {
            done = true
            val averaged = FaceSignature.average(samples)
            delay(700) // let the user see the "completata" confirmation before leaving
            if (averaged != null) onComplete(averaged) else onCancel()
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        AndroidView(factory = { previewView }, modifier = Modifier.fillMaxSize())

        IconButton(
            onClick = onCancel,
            modifier = Modifier.align(Alignment.TopStart).padding(16.dp)
        ) {
            Icon(imageVector = Icons.Filled.Close, contentDescription = null, tint = Color.White)
        }

        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(Color.Black.copy(alpha = 0.55f))
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            val statusText = when {
                done -> "Registrazione completata"
                faceVisible -> "Perfetto, tieni fermo… ${samples.size}/$SAMPLES_NEEDED"
                else -> "Cerco il tuo volto…"
            }
            Text(
                text = statusText,
                color = Color.White,
                style = MaterialTheme.typography.titleMedium,
                textAlign = TextAlign.Center
            )
            Text(
                text = "Inquadra il viso al centro, con una buona illuminazione.",
                color = Color.White.copy(alpha = 0.75f),
                style = MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.Center
            )
            CircularProgressIndicator(
                progress = { samples.size / SAMPLES_NEEDED.toFloat() },
                modifier = Modifier.size(40.dp),
                color = if (done) MaterialTheme.colorScheme.primary else Color.White
            )
        }
    }
}
