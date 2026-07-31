package it.vstudioapps.fortknox.data

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import androidx.documentfile.provider.DocumentFile
import it.vstudioapps.fortknox.model.ImportResult
import it.vstudioapps.fortknox.model.VaultFolder
import it.vstudioapps.fortknox.model.VaultItem
import it.vstudioapps.fortknox.model.VaultSnapshot
import it.vstudioapps.fortknox.security.CryptoEngine
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.security.SecureRandom
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.CipherInputStream
import javax.crypto.CipherOutputStream
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

class VaultRepository(private val context: Context) {
    private val crypto = CryptoEngine()
    private val vaultDir = File(context.filesDir, "vault").apply { mkdirs() }
    private val indexFile = File(vaultDir, "index.vault")

    @Synchronized
    fun snapshot(): VaultSnapshot {
        if (!indexFile.exists()) {
            val now = System.currentTimeMillis()
            val initial = VaultSnapshot(
                folders = listOf(
                    VaultFolder("photos", "Immagini", now),
                    VaultFolder("documents", "Documenti", now),
                    VaultFolder("videos", "Video", now),
                    VaultFolder(HIDDEN_FOLDER_ID, "Cartella Nascosta", now, hidden = true)
                ),
                items = emptyList()
            )
            save(initial)
            return initial
        }
        return runCatching {
            val plain = ByteArrayOutputStream()
            FileInputStream(indexFile).use { crypto.decrypt(it, plain) }
            val parsed = parse(JSONObject(plain.toString(Charsets.UTF_8.name())))
            // Vaults created before the hidden-folder feature existed won't have one: add it
            // once, transparently, so existing testers get it without losing their data.
            if (parsed.folders.none { it.hidden }) {
                val migrated = parsed.copy(
                    folders = parsed.folders + VaultFolder(
                        HIDDEN_FOLDER_ID,
                        "Cartella Nascosta",
                        System.currentTimeMillis(),
                        hidden = true
                    )
                )
                save(migrated)
                migrated
            } else {
                parsed
            }
        }.getOrElse {
            throw IllegalStateException("Impossibile leggere l'indice cifrato", it)
        }
    }

    @Synchronized
    fun addFolder(name: String): VaultSnapshot {
        val clean = name.trim().take(40)
        require(clean.isNotBlank())
        val current = snapshot()
        val updated = current.copy(
            folders = current.folders + VaultFolder(
                UUID.randomUUID().toString(),
                clean,
                System.currentTimeMillis()
            )
        )
        save(updated)
        return updated
    }

    @Synchronized
    fun importUris(uris: List<Uri>, folderId: String): ImportResult {
        var current = snapshot()
        var imported = 0
        var originalsDeleted = 0
        val failures = mutableListOf<String>()

        uris.forEach { uri ->
            val meta = queryMetadata(uri)
            var target: File? = null
            runCatching {
                val id = UUID.randomUUID().toString()
                target = File(vaultDir, "$id.bin")
                context.contentResolver.openInputStream(uri).use { input ->
                    requireNotNull(input) { "File non leggibile" }
                    FileOutputStream(requireNotNull(target)).use { output -> crypto.encrypt(input, output) }
                }
                val item = VaultItem(
                    id = id,
                    folderId = folderId,
                    displayName = meta.first,
                    mimeType = context.contentResolver.getType(uri) ?: "application/octet-stream",
                    encryptedFileName = requireNotNull(target).name,
                    sizeBytes = meta.second,
                    createdAt = System.currentTimeMillis()
                )
                current = current.copy(items = current.items + item)
                save(current)
                imported++

                val deleted = runCatching {
                    DocumentFile.fromSingleUri(context, uri)?.delete() == true
                }.getOrDefault(false)
                if (deleted) originalsDeleted++
            }.onFailure {
                target?.delete()
                failures += "${meta.first}: ${it.message ?: "errore"}"
            }
        }
        return ImportResult(imported, originalsDeleted, failures)
    }

    @Synchronized
    fun deleteItem(item: VaultItem): VaultSnapshot {
        File(vaultDir, item.encryptedFileName).delete()
        val current = snapshot()
        val updated = current.copy(items = current.items.filterNot { it.id == item.id })
        save(updated)
        return updated
    }

    fun decryptBytes(item: VaultItem): ByteArray {
        val output = ByteArrayOutputStream()
        FileInputStream(File(vaultDir, item.encryptedFileName)).use { crypto.decrypt(it, output) }
        return output.toByteArray()
    }

    /** Decrypts every item into [destinationTree] (an OpenDocumentTree URI), one subfolder per
     * vault folder, so the user has a plain, app-independent backup. Returns how many exported. */
    fun exportAllTo(destinationTree: Uri): Int {
        val destinationRoot = requireNotNull(DocumentFile.fromTreeUri(context, destinationTree)) {
            "Cartella di destinazione non valida"
        }
        val current = snapshot()
        var exported = 0
        current.folders.forEach { folder ->
            val items = current.items.filter { it.folderId == folder.id }
            if (items.isEmpty()) return@forEach
            val folderName = folder.name.replace(Regex("[^A-Za-z0-9._ -]"), "_").take(60)
            val destinationFolder = destinationRoot.findFile(folderName)
                ?.takeIf { it.isDirectory }
                ?: destinationRoot.createDirectory(folderName)
                ?: destinationRoot
            items.forEach { item ->
                runCatching {
                    val safeName = item.displayName.replace(Regex("[^A-Za-z0-9._-]"), "_").take(80)
                    val target = destinationFolder.createFile(item.mimeType, safeName)
                        ?: return@runCatching
                    context.contentResolver.openOutputStream(target.uri)?.use { output ->
                        FileInputStream(File(vaultDir, item.encryptedFileName)).use { source ->
                            crypto.decrypt(source, output)
                        }
                    }
                    exported++
                }
            }
        }
        return exported
    }

    fun exportPlain(item: VaultItem): File {
        val shareDir = File(context.cacheDir, "share").apply {
            deleteRecursively()
            mkdirs()
        }
        val safeName = item.displayName.replace(Regex("[^A-Za-z0-9._-]"), "_").take(80)
        val target = File(shareDir, safeName)
        FileInputStream(File(vaultDir, item.encryptedFileName)).use { source ->
            FileOutputStream(target).use { output -> crypto.decrypt(source, output) }
        }
        return target
    }

    fun createProtectedPackage(item: VaultItem, password: CharArray): File {
        require(password.size >= 6) { "La password di condivisione deve avere almeno 6 caratteri" }
        val shareDir = File(context.cacheDir, "share").apply {
            deleteRecursively()
            mkdirs()
        }
        val safeName = item.displayName.replace(Regex("[^A-Za-z0-9._-]"), "_").take(80)
        val target = File(shareDir, "$safeName.vsafe")
        val salt = ByteArray(32).also(SecureRandom()::nextBytes)
        val iv = ByteArray(12).also(SecureRandom()::nextBytes)
        val spec = PBEKeySpec(password, salt, 250_000, 256)
        val keyBytes = try {
            SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
        } finally {
            spec.clearPassword()
            password.fill('\u0000')
        }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply {
            init(Cipher.ENCRYPT_MODE, SecretKeySpec(keyBytes, "AES"), GCMParameterSpec(128, iv))
            updateAAD(item.displayName.toByteArray(Charsets.UTF_8))
        }
        keyBytes.fill(0)

        FileOutputStream(target).use { output ->
            output.write("VSAFE1".toByteArray(Charsets.US_ASCII))
            output.write(salt)
            output.write(iv)
            val name = item.displayName.toByteArray(Charsets.UTF_8)
            output.write((name.size ushr 8) and 0xff)
            output.write(name.size and 0xff)
            output.write(name)
            CipherOutputStream(output, cipher).use { encrypted ->
                FileInputStream(File(vaultDir, item.encryptedFileName)).use { source ->
                    crypto.decrypt(source, encrypted)
                }
            }
        }
        return target
    }

    @Synchronized
    fun importProtectedPackage(uri: Uri, password: CharArray, folderId: String): VaultSnapshot {
        val source = requireNotNull(context.contentResolver.openInputStream(uri)) {
            "Pacchetto non leggibile"
        }
        var target: File? = null
        try {
            source.use { input ->
                val magic = ByteArray(6)
                input.readFully(magic)
                require(magic.toString(Charsets.US_ASCII) == "VSAFE1") {
                    "Formato .vsafe non valido"
                }
                val salt = ByteArray(32)
                val iv = ByteArray(12)
                input.readFully(salt)
                input.readFully(iv)
                val high = input.read()
                val low = input.read()
                val nameLength = (high shl 8) or low
                require(high >= 0 && low >= 0 && nameLength in 1..512) { "Nome file non valido" }
                val nameBytes = ByteArray(nameLength)
                input.readFully(nameBytes)
                val name = nameBytes.toString(Charsets.UTF_8)

                val spec = PBEKeySpec(password, salt, 250_000, 256)
                val keyBytes = try {
                    SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
                } finally {
                    spec.clearPassword()
                    password.fill('\u0000')
                }
                val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply {
                    init(Cipher.DECRYPT_MODE, SecretKeySpec(keyBytes, "AES"), GCMParameterSpec(128, iv))
                    updateAAD(nameBytes)
                }
                keyBytes.fill(0)

                val id = UUID.randomUUID().toString()
                target = File(vaultDir, "$id.bin")
                CipherInputStream(input, cipher).use { decrypted ->
                    FileOutputStream(requireNotNull(target)).use { output ->
                        crypto.encrypt(decrypted, output)
                    }
                }
                val mime = mimeFromName(name)
                val current = snapshot()
                val updated = current.copy(
                    items = current.items + VaultItem(
                        id = id,
                        folderId = folderId,
                        displayName = name,
                        mimeType = mime,
                        encryptedFileName = requireNotNull(target).name,
                        sizeBytes = 0L,
                        createdAt = System.currentTimeMillis()
                    )
                )
                save(updated)
                return updated
            }
        } catch (error: Exception) {
            target?.delete()
            throw IllegalArgumentException(
                "Password errata oppure pacchetto danneggiato",
                error
            )
        }
    }

    fun clearShareCache() {
        File(context.cacheDir, "share").deleteRecursively()
    }

    private fun queryMetadata(uri: Uri): Pair<String, Long> {
        var name = "file_${System.currentTimeMillis()}"
        var size = 0L
        context.contentResolver.query(
            uri,
            arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE),
            null,
            null,
            null
        )?.use { cursor ->
            if (cursor.moveToFirst()) {
                cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME).takeIf { it >= 0 }
                    ?.let { name = cursor.getString(it) ?: name }
                cursor.getColumnIndex(OpenableColumns.SIZE).takeIf { it >= 0 }
                    ?.let { size = if (cursor.isNull(it)) 0L else cursor.getLong(it) }
            }
        }
        return name to size
    }

    private fun mimeFromName(name: String): String = when (name.substringAfterLast('.', "").lowercase()) {
        "jpg", "jpeg" -> "image/jpeg"
        "png" -> "image/png"
        "webp" -> "image/webp"
        "gif" -> "image/gif"
        "pdf" -> "application/pdf"
        "mp4" -> "video/mp4"
        "txt" -> "text/plain"
        else -> "application/octet-stream"
    }

    private fun java.io.InputStream.readFully(buffer: ByteArray) {
        var offset = 0
        while (offset < buffer.size) {
            val count = read(buffer, offset, buffer.size - offset)
            require(count > 0) { "Pacchetto incompleto" }
            offset += count
        }
    }

    private fun save(snapshot: VaultSnapshot) {
        val temp = File(vaultDir, "index.tmp")
        ByteArrayInputStream(toJson(snapshot).toString().toByteArray(Charsets.UTF_8)).use { input ->
            FileOutputStream(temp).use { output -> crypto.encrypt(input, output) }
        }
        if (!temp.renameTo(indexFile)) {
            temp.copyTo(indexFile, overwrite = true)
            temp.delete()
        }
    }

    private fun toJson(snapshot: VaultSnapshot): JSONObject = JSONObject().apply {
        put("folders", JSONArray().apply {
            snapshot.folders.forEach { folder ->
                put(JSONObject().apply {
                    put("id", folder.id)
                    put("name", folder.name)
                    put("createdAt", folder.createdAt)
                    put("hidden", folder.hidden)
                })
            }
        })
        put("items", JSONArray().apply {
            snapshot.items.forEach { item ->
                put(JSONObject().apply {
                    put("id", item.id)
                    put("folderId", item.folderId)
                    put("displayName", item.displayName)
                    put("mimeType", item.mimeType)
                    put("encryptedFileName", item.encryptedFileName)
                    put("sizeBytes", item.sizeBytes)
                    put("createdAt", item.createdAt)
                })
            }
        })
    }

    private fun parse(json: JSONObject): VaultSnapshot {
        val folders = json.getJSONArray("folders").let { array ->
            List(array.length()) { index ->
                array.getJSONObject(index).let {
                    VaultFolder(
                        it.getString("id"),
                        it.getString("name"),
                        it.getLong("createdAt"),
                        it.optBoolean("hidden", false)
                    )
                }
            }
        }
        val items = json.getJSONArray("items").let { array ->
            List(array.length()) { index ->
                array.getJSONObject(index).let {
                    VaultItem(
                        it.getString("id"),
                        it.getString("folderId"),
                        it.getString("displayName"),
                        it.getString("mimeType"),
                        it.getString("encryptedFileName"),
                        it.getLong("sizeBytes"),
                        it.getLong("createdAt")
                    )
                }
            }
        }
        return VaultSnapshot(folders, items)
    }

    companion object {
        private const val HIDDEN_FOLDER_ID = "hidden_vault"
    }
}
