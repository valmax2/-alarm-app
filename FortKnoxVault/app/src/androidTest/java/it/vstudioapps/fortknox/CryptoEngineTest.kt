package it.vstudioapps.fortknox

import androidx.test.ext.junit.runners.AndroidJUnit4
import it.vstudioapps.fortknox.security.CryptoEngine
import org.junit.Assert.assertArrayEquals
import org.junit.Test
import org.junit.runner.RunWith
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream

@RunWith(AndroidJUnit4::class)
class CryptoEngineTest {
    @Test
    fun encryptThenDecrypt_returnsOriginalBytes() {
        val original = "documento riservato".toByteArray()
        val encrypted = ByteArrayOutputStream()
        CryptoEngine().encrypt(ByteArrayInputStream(original), encrypted)

        val decrypted = ByteArrayOutputStream()
        CryptoEngine().decrypt(ByteArrayInputStream(encrypted.toByteArray()), decrypted)

        assertArrayEquals(original, decrypted.toByteArray())
    }
}
