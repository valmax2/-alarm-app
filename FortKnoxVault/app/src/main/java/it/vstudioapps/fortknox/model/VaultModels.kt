package it.vstudioapps.fortknox.model

data class VaultFolder(
    val id: String,
    val name: String,
    val createdAt: Long,
    val hidden: Boolean = false
)

data class VaultItem(
    val id: String,
    val folderId: String,
    val displayName: String,
    val mimeType: String,
    val encryptedFileName: String,
    val sizeBytes: Long,
    val createdAt: Long
)

data class ImportResult(
    val imported: Int,
    val originalsDeleted: Int,
    val failures: List<String>
)

data class VaultSnapshot(
    val folders: List<VaultFolder>,
    val items: List<VaultItem>
)
