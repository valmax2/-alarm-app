package it.vstudioapps.faceguard

import it.vstudioapps.faceguard.model.FaceSignature
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FaceSignatureTest {

    @Test
    fun `distanceTo is zero for identical signatures`() {
        val signature = FaceSignature(listOf(1f, 2f, 3f))
        assertEquals(0f, signature.distanceTo(signature))
    }

    @Test
    fun `distanceTo matches the Euclidean distance formula`() {
        val a = FaceSignature(listOf(0f, 0f))
        val b = FaceSignature(listOf(3f, 4f))
        assertEquals(5f, a.distanceTo(b))
    }

    @Test
    fun `distanceTo returns null for mismatched dimensions`() {
        val a = FaceSignature(listOf(1f, 2f))
        val b = FaceSignature(listOf(1f, 2f, 3f))
        assertNull(a.distanceTo(b))
    }

    @Test
    fun `storage round-trip preserves the values`() {
        val original = FaceSignature(listOf(0.5f, 1.25f, -2f))
        val restored = FaceSignature.fromStorageString(original.toStorageString())
        assertNotNull(restored)
        assertEquals(original, restored)
    }

    @Test
    fun `fromStorageString rejects garbage input`() {
        assertNull(FaceSignature.fromStorageString(""))
        assertNull(FaceSignature.fromStorageString("not,numbers"))
    }

    @Test
    fun `average combines several samples into their per-dimension mean`() {
        val samples = listOf(
            FaceSignature(listOf(1f, 1f)),
            FaceSignature(listOf(2f, 2f)),
            FaceSignature(listOf(3f, 3f))
        )
        val averaged = FaceSignature.average(samples)
        assertNotNull(averaged)
        assertEquals(listOf(2f, 2f), averaged!!.values)
    }

    @Test
    fun `average returns null for an empty or dimension-mismatched list`() {
        assertNull(FaceSignature.average(emptyList()))
        assertNull(FaceSignature.average(listOf(FaceSignature(listOf(1f)), FaceSignature(listOf(1f, 2f)))))
    }

    @Test
    fun `a live signature close to the owner is considered a match`() {
        val owner = FaceSignature(listOf(1f, 1f, 1f, 1f))
        val closeMatch = FaceSignature(listOf(1.02f, 1.01f, 0.99f, 1.0f))
        val distance = owner.distanceTo(closeMatch)
        assertNotNull(distance)
        assertTrue(distance!! <= FaceSignature.MATCH_THRESHOLD)
    }
}
