package it.vstudioapps.runwarestudio.model

/** Where one result image's bytes come from when ArchiveRepository.saveCompletedJob archives
 *  it — a plain Runware URL to download, or bytes already in hand (e.g. after a Segmind
 *  face-swap post-processing step). */
sealed interface ResultImageSource {
    data class Remote(val url: String) : ResultImageSource
    data class Local(val bytes: ByteArray) : ResultImageSource
}
