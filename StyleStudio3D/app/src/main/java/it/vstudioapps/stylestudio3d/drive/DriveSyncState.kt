package it.vstudioapps.stylestudio3d.drive

sealed interface DriveSyncState {
    data object Disconnesso : DriveSyncState
    data object Autorizzazione : DriveSyncState
    data class Connesso(val ultimaSincronizzazioneEpochMillis: Long?) : DriveSyncState
    data object Sincronizzazione : DriveSyncState
    data class Errore(val messaggio: String) : DriveSyncState
}
