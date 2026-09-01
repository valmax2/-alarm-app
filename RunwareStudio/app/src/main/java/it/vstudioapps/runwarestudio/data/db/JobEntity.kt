package it.vstudioapps.runwarestudio.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * One row per completed generation, the local "archivio". Image paths are stored as
 * newline-joined lists of app-private file paths rather than a separate table — a job never
 * has more than a handful of images (numberResults is capped at 4) so the extra join/query
 * cost of a child table isn't worth the complexity. See ArchiveRepository for (de)serialization.
 */
@Entity(tableName = "jobs")
data class JobEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val promptIt: String,
    val promptEn: String,
    val modelId: String,
    val modelAir: String,
    val modelDisplayName: String,
    val negativePrompt: String,
    val steps: Int,
    val cfgScale: Float,
    val width: Int,
    val height: Int,
    val scheduler: String,
    val numberResults: Int,
    val seed: Long?,
    val checkNsfw: Boolean,
    val referenceStrength: Float,
    val useCharacterConsistency: Boolean,
    /** Newline-joined local file paths, in picker order. */
    val referenceImagePaths: String,
    /** Newline-joined local file paths, one per generated result. */
    val resultImagePaths: String,
    val createdAt: Long
)
