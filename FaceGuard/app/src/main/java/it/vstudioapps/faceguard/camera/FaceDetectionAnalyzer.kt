package it.vstudioapps.faceguard.camera

import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import it.vstudioapps.faceguard.model.FaceSignature

/**
 * CameraX analyzer that reports whether a face is visible in each frame and, when landmarks
 * are clear enough, its geometric [FaceSignature] for owner matching.
 *
 * Landmark detection needs slightly more work per frame than plain detection, but is still
 * well inside camera frame time in `PERFORMANCE_MODE_FAST`.
 */
class FaceDetectionAnalyzer(
    private val onResult: (faceDetected: Boolean, signature: FaceSignature?) -> Unit,
    private val onError: (Throwable) -> Unit
) : ImageAnalysis.Analyzer {

    private val detector = FaceDetection.getClient(
        FaceDetectorOptions.Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
            .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL)
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
            .addOnSuccessListener { faces ->
                // Several faces can appear in frame; the largest one is almost always the
                // person actually looking at the screen, so that's the one worth matching.
                val mainFace = faces.maxByOrNull { it.boundingBox.width().toLong() * it.boundingBox.height() }
                if (mainFace == null) {
                    onResult(false, null)
                } else {
                    onResult(true, FaceSignatureExtractor.extract(mainFace))
                }
            }
            .addOnFailureListener { error -> onError(error) }
            .addOnCompleteListener { imageProxy.close() }
    }

    fun close() {
        detector.close()
    }
}
