package it.vstudioapps.faceguard.camera

import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions

/**
 * CameraX analyzer that reports whether at least one face is visible in each frame.
 *
 * Detection only needs a fast yes/no signal, so it runs ML Kit in [FaceDetectorOptions]'s
 * `PERFORMANCE_MODE_FAST` with landmarks/classification/tracking disabled — the model is
 * lighter and each frame finishes well inside camera frame time.
 */
class FaceDetectionAnalyzer(
    private val onResult: (faceDetected: Boolean) -> Unit,
    private val onError: (Throwable) -> Unit
) : ImageAnalysis.Analyzer {

    private val detector = FaceDetection.getClient(
        FaceDetectorOptions.Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
            .build()
    )

    @androidx.camera.core.ExperimentalGetImage
    override fun analyze(imageProxy: ImageProxy) {
        val mediaImage = imageProxy.image
        if (mediaImage == null) {
            imageProxy.close()
            return
        }

        val input = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
        detector.process(input)
            .addOnSuccessListener { faces -> onResult(faces.isNotEmpty()) }
            .addOnFailureListener { error -> onError(error) }
            .addOnCompleteListener { imageProxy.close() }
    }

    fun close() {
        detector.close()
    }
}
