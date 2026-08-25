package it.vstudioapps.faceguard.model

import kotlin.math.sqrt

/**
 * A lightweight geometric "fingerprint" of a face, used to tell the device's owner apart from
 * anyone else the camera sees.
 *
 * This is NOT a deep-learning face embedding (FaceNet/MobileFaceNet-style) — building that
 * would require a pretrained recognition model file this project doesn't ship. Instead it's a
 * vector of distance ratios between a handful of ML Kit facial landmarks (eyes, nose, mouth),
 * normalized by inter-eye distance so it doesn't depend on how far the face is from the
 * camera. It is a real, on-device, no-network signal — meaningfully better than "any face
 * counts" — but it is a weaker biometric than commercial face recognition: very similar faces
 * (e.g. siblings) or extreme angles/lighting can occasionally confuse it. See
 * [it.vstudioapps.faceguard.camera.FaceSignatureExtractor] for how the vector is built.
 */
data class FaceSignature(val values: List<Float>) {

    /** Euclidean distance to another signature; null if they have different dimensionality. */
    fun distanceTo(other: FaceSignature): Float? {
        if (values.size != other.values.size) return null
        var sumSquares = 0f
        for (i in values.indices) {
            val diff = values[i] - other.values[i]
            sumSquares += diff * diff
        }
        return sqrt(sumSquares)
    }

    fun toStorageString(): String = values.joinToString(",")

    companion object {
        /** Below this distance, a live signature is considered a match for the enrolled owner. */
        const val MATCH_THRESHOLD = 0.22f

        fun fromStorageString(raw: String): FaceSignature? {
            val parts = raw.split(",")
            val parsed = parts.mapNotNull { it.trim().toFloatOrNull() }
            return if (parsed.isEmpty() || parsed.size != parts.size) null else FaceSignature(parsed)
        }

        /** Averages several samples captured during enrollment into one steadier signature. */
        fun average(samples: List<FaceSignature>): FaceSignature? {
            val dimension = samples.firstOrNull()?.values?.size ?: return null
            if (samples.any { it.values.size != dimension }) return null
            val sums = FloatArray(dimension)
            for (sample in samples) {
                for (i in 0 until dimension) sums[i] += sample.values[i]
            }
            return FaceSignature(sums.map { it / samples.size })
        }
    }
}
