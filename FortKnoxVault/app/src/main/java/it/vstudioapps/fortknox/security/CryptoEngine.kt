package it.vstudioapps.fortknox.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.io.InputStream
import java.io.OutputStream
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.CipherInputStream
import javax.crypto.CipherOutputStream
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class CryptoEngine {
    private val keyAlias = "fort_knox_master_v1"
    private val transformation = "AES/GCM/NoPadding"

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(keyAlias, null) as? SecretKey)?.let { return it }

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        val spec = KeyGenParameterSpec.Builder(
            keyAlias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .setKeySize(256)
            .setUnlockedDeviceRequired(true)
            .build()
        generator.init(spec)
        return generator.generateKey()
    }

    fun encrypt(input: InputStream, output: OutputStream) {
        val cipher = Cipher.getInstance(transformation).apply {
            init(Cipher.ENCRYPT_MODE, key())
        }
        require(cipher.iv.size <= 255)
        output.write(cipher.iv.size)
        output.write(cipher.iv)
        CipherOutputStream(output, cipher).use { encrypted ->
            input.copyTo(encrypted, DEFAULT_BUFFER_SIZE)
        }
    }

    fun decrypt(input: InputStream, output: OutputStream) {
        val ivLength = input.read()
        require(ivLength in 12..32) { "Archivio cifrato non valido" }
        val iv = ByteArray(ivLength)
        require(input.read(iv) == ivLength) { "Archivio cifrato incompleto" }
        val cipher = Cipher.getInstance(transformation).apply {
            init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
        }
        CipherInputStream(input, cipher).use { decrypted ->
            decrypted.copyTo(output, DEFAULT_BUFFER_SIZE)
        }
    }
}
