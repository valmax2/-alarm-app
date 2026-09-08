package it.vstudioapps.runwarestudio.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import it.vstudioapps.runwarestudio.RunwareStudioApplication
import it.vstudioapps.runwarestudio.model.ArchiveJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** Backs the Archive tab: the full job list plus per-job detail/delete. */
class ArchiveViewModel(application: Application) : AndroidViewModel(application) {

    private val repository get() = getApplication<RunwareStudioApplication>().archiveRepository

    val jobs: StateFlow<List<ArchiveJob>> = repository.jobs
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun jobFlow(id: Long): Flow<ArchiveJob?> = repository.observeJob(id)

    fun deleteJob(job: ArchiveJob) {
        viewModelScope.launch { repository.deleteJob(job) }
    }
}
