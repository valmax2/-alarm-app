package it.vstudioapps.faceguard.camera

import android.graphics.PointF
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceLandmark
import it.vstudioapps.faceguard.model.FaceSignature
import kotlin.math.sqrt

/**
 * Builds a [FaceSignature] from an ML Kit [Face] detection, using only its landmark positions
 * (no separate recognition model — see [FaceSignature]'s doc for why).
 *
 * Requires the detector to run with `FaceDetectorOptions.LANDMARK_MODE_ALL`. Returns null when
 * the six landmarks this needs aren't all found — typically because the face is turned too far
 * from the camera to see both eyes, nose and mouth clearly.
 */
object FaceSignatureExtractor {

    fun extract(face: Face): FaceSignature? {
        val leftEye = face.landmark(FaceLandmark.LEFT_EYE) ?: return null
        val rightEye = face.landmark(FaceLandmark.RIGHT_EYE) ?: return null
        val nose = face.landmark(FaceLandmark.NOSE_BASE) ?: return null
        val mouthLeft = face.landmark(FaceLandmark.MOUTH_LEFT) ?: return null
        val mouthRight = face.landmark(FaceLandmark.MOUTH_RIGHT) ?: return null
        val mouthBottom = face.landmark(FaceLandmark.MOUTH_BOTTOM) ?: return null

        // Inter-eye distance is the unit every other distance is expressed in, so the
        // signature doesn't depend on how close the face is to the camera.
        val eyeDistance = distance(leftEye, rightEye)
        if (eyeDistance < 1f) return null

        val ratios = listOf(
            distance(leftEye, nose),
            distance(rightEye, nose),
            distance(leftEye, mouthLeft),
            distance(rightEye, mouthRight),
            distance(nose, mouthBottom),
            distance(mouthLeft, mouthRight),
            distance(leftEye, mouthBottom),
            distance(rightEye, mouthBottom),
            distance(nose, mouthLeft),
            distance(nose, mouthRight)
        ).map { it / eyeDistance }

        return FaceSignature(ratios)
    }

    private fun Face.landmark(type: Int): PointF? = getLandmark(type)?.position

    private fun distance(a: PointF, b: PointF): Float {
        val dx = a.x - b.x
        val dy = a.y - b.y
        return sqrt(dx * dx + dy * dy)
    }
}
