package it.vstudioapps.runwarestudio.model

/** Domain view of one archived generation — see data/db/JobEntity.kt for the stored shape and
 *  data/archive/ArchiveRepository.kt for the mapping between the two. */
data class ArchiveJob(
    val id: Long,
    val promptIt: String,
    val promptEn: String,
    val modelId: String,
    val modelAir: String,
    val modelDisplayName: String,
    val params: GenerationParams,
    /** Local, app-private file paths — always readable even if the original picked content
     *  uri or the Runware result URL has since expired. */
    val referenceImagePaths: List<String>,
    val resultImagePaths: List<String>,
    val createdAt: Long
)
