package it.vstudioapps.stylestudio3d.drive

import android.content.Context
import androidx.activity.result.ActivityResult
import androidx.activity.result.IntentSenderRequest
import it.vstudioapps.stylestudio3d.data.GenerationHistoryRepository
import it.vstudioapps.stylestudio3d.data.WardrobeRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.File

/**
 * Orchestratore della sincronizzazione: carica su Drive le foto del guardaroba e gli scatti
 * generati. Il token di accesso resta solo in memoria per la sessione corrente (limite
 * consapevole del prototipo, vedi README) — a ogni riavvio dell'app va rifatta l'autorizzazione.
 */
class GoogleDriveSyncService(
    private val context: Context,
    private val wardrobeRepository: WardrobeRepository,
    private val historyRepository: GenerationHistoryRepository,
) {
    private val authManager = GoogleDriveAuthorizationManager(context)
    private var accessToken: String? = null

    private val _stato = MutableStateFlow<DriveSyncState>(DriveSyncState.Disconnesso)
    val stato: StateFlow<DriveSyncState> = _stato.asStateFlow()

    suspend fun connetti(avviaRisoluzione: (IntentSenderRequest) -> Unit) {
        _stato.value = DriveSyncState.Autorizzazione
        authManager.autorizza(avviaRisoluzione).fold(
            onSuccess = { token -> accessToken = token; _stato.value = DriveSyncState.Connesso(null) },
            onFailure = { errore ->
                // In attesa del consenso utente: niente stato di errore, il launcher e' gia' partito.
                if (errore !== AutorizzazioneInSospesoException) {
                    _stato.value = DriveSyncState.Errore(messaggioErrore(errore))
                }
            },
        )
    }

    fun completaAutorizzazione(activityResult: ActivityResult) {
        authManager.completaDaRisultato(activityResult).fold(
            onSuccess = { token -> accessToken = token; _stato.value = DriveSyncState.Connesso(null) },
            onFailure = { errore -> _stato.value = DriveSyncState.Errore(messaggioErrore(errore)) },
        )
    }

    fun disconnetti() {
        accessToken = null
        _stato.value = DriveSyncState.Disconnesso
    }

    suspend fun sincronizzaOra() {
        val token = accessToken ?: run { _stato.value = DriveSyncState.Errore("Collega prima un account Google."); return }
        _stato.value = DriveSyncState.Sincronizzazione
        val client = DriveRestClient(token)

        val esito = client.idCartellaApp().mapCatching { idCartella ->
            val fotoGuardaroba = wardrobeRepository.capi.value.map { File(it.photoPath) to "image/jpeg" }
            val scatti = historyRepository.creazioni.value.map { File(it.imagePath) to "image/png" }
            (fotoGuardaroba + scatti).forEach { (file, mime) ->
                if (file.exists()) client.caricaFile(file, idCartella, mime).getOrThrow()
            }
        }
        _stato.value = esito.fold(
            onSuccess = { DriveSyncState.Connesso(System.currentTimeMillis()) },
            onFailure = { DriveSyncState.Errore(messaggioErrore(it)) },
        )
    }

    private fun messaggioErrore(errore: Throwable): String =
        errore.message ?: "Sincronizzazione con Google Drive non riuscita. Riprova piu' tardi."
}
