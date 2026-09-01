package it.vstudioapps.runwarestudio.data.archive

import android.content.Context
import android.net.Uri
import it.vstudioapps.runwarestudio.data.api.ReferenceMode
import it.vstudioapps.runwarestudio.data.db.JobDao
import it.vstudioapps.runwarestudio.data.db.JobEntity
import it.vstudioapps.runwarestudio.data.db.RunwareDatabase
import it.vstudioapps.runwarestudio.model.ArchiveJob
import it.vstudioapps.runwarestudio.model.GenerationParams
import it.vstudioapps.runwarestudio.model.ModelPreset
import it.vstudioapps.runwarestudio.model.ResultImageSource
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext

/**
 * The "archivio": every successfully completed generation, self-contained on local storage
 * (both the reference photos and the result images are copied/downloaded onto the device, so
 * the archive keeps working even after the original picker uri or the Runware result URL —
 * which expires — are gone).
 */
class ArchiveRepository(private val context: Context) {

    private val dao: JobDao = RunwareDatabase.get(context).jobDao()
    private val storage = ImageStorage(context)

    val jobs: Flow<List<ArchiveJob>> = dao.observeAll().map { list -> list.map { it.toDomain() } }

    fun observeJob(id: Long): Flow<ArchiveJob?> = dao.observeById(id).map { it?.toDomain() }

    suspend fun getJob(id: Long): ArchiveJob? = dao.getById(id)?.toDomain()

    /** Downloads every result image and copies every reference photo into a fresh archive
     *  folder, then inserts the job row. Runs entirely on IO; if anything fails partway the
     *  partial folder is cleaned up and the exception propagates so the caller can show it. */
    suspend fun saveCompletedJob(
        promptIt: String,
        promptEn: String,
        model: ModelPreset,
        params: GenerationParams,
        referenceUris: List<Uri>,
        results: List<ResultImageSource>
    ): Long = withContext(Dispatchers.IO) {
        val jobKey = UUID.randomUUID().toString()
        try {
            val referencePaths = referenceUris.mapIndexed { index, uri ->
                storage.copyReferenceImage(uri, jobKey, index).absolutePath
            }
            val resultPaths = results.mapIndexed { index, source ->
                when (source) {
                    is ResultImageSource.Remote -> storage.downloadResult(source.url, jobKey, index)
                    is ResultImageSource.Local -> storage.saveBytes(source.bytes, jobKey, index)
                }.absolutePath
            }
            val entity = JobEntity(
                promptIt = promptIt,
                promptEn = promptEn,
                modelId = model.id,
                modelAir = model.air,
                modelDisplayName = model.displayName,
                negativePrompt = params.negativePrompt,
                steps = params.steps,
                cfgScale = params.cfgScale,
                width = params.width,
                height = params.height,
                scheduler = params.scheduler,
                numberResults = params.numberResults,
                seed = params.seed,
                checkNsfw = params.checkNsfw,
                referenceStrength = params.referenceStrength,
                useCharacterConsistency = model.referenceMode == ReferenceMode.ACE_PLUS_PLUS,
                referenceImagePaths = referencePaths.joinToString("\n"),
                resultImagePaths = resultPaths.joinToString("\n"),
                createdAt = System.currentTimeMillis()
            )
            dao.insert(entity)
        } catch (e: Exception) {
            storage.deleteJobFiles(jobKey)
            throw e
        }
    }

    suspend fun deleteJob(job: ArchiveJob) = withContext(Dispatchers.IO) {
        (job.resultImagePaths.firstOrNull() ?: job.referenceImagePaths.firstOrNull())
            ?.let { storage.deleteContainingFolder(it) }
        dao.delete(job.toEntity())
    }

    /** Wipes the whole archive — every row and every file under filesDir/archive. Used by
     *  Settings' "Svuota archivio". */
    suspend fun clearAll() = withContext(Dispatchers.IO) {
        dao.deleteAll()
        java.io.File(context.filesDir, "archive").deleteRecursively()
    }

    private fun JobEntity.toDomain() = ArchiveJob(
        id = id,
        promptIt = promptIt,
        promptEn = promptEn,
        modelId = modelId,
        modelAir = modelAir,
        modelDisplayName = modelDisplayName,
        params = GenerationParams(
            negativePrompt = negativePrompt,
            steps = steps,
            cfgScale = cfgScale,
            width = width,
            height = height,
            scheduler = scheduler,
            numberResults = numberResults,
            seed = seed,
            referenceStrength = referenceStrength,
            checkNsfw = checkNsfw
        ),
        referenceImagePaths = referenceImagePaths.splitPaths(),
        resultImagePaths = resultImagePaths.splitPaths(),
        createdAt = createdAt
    )

    private fun ArchiveJob.toEntity() = JobEntity(
        id = id,
        promptIt = promptIt,
        promptEn = promptEn,
        modelId = modelId,
        modelAir = modelAir,
        modelDisplayName = modelDisplayName,
        negativePrompt = params.negativePrompt,
        steps = params.steps,
        cfgScale = params.cfgScale,
        width = params.width,
        height = params.height,
        scheduler = params.scheduler,
        numberResults = params.numberResults,
        seed = params.seed,
        checkNsfw = params.checkNsfw,
        referenceStrength = params.referenceStrength,
        useCharacterConsistency = false,
        referenceImagePaths = referenceImagePaths.joinToString("\n"),
        resultImagePaths = resultImagePaths.joinToString("\n"),
        createdAt = createdAt
    )

    private fun String.splitPaths(): List<String> =
        split("\n").map { it.trim() }.filter { it.isNotEmpty() }

    fun imageStorage(): ImageStorage = storage
}
