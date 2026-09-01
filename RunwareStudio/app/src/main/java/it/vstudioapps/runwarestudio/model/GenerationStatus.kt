package it.vstudioapps.runwarestudio.model

/** Drives the progress copy/spinner on HomeScreen through one generate run. */
sealed interface GenerationStatus {
    data object Idle : GenerationStatus
    data object Translating : GenerationStatus
    data object UploadingReferences : GenerationStatus
    data object Generating : GenerationStatus
    data object SwappingFaces : GenerationStatus
    data class Success(val jobId: Long) : GenerationStatus
    data class Error(val message: String) : GenerationStatus
}
