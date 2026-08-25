package it.vstudioapps.stylestudio3d.drive

import android.content.Context
import android.content.Intent
import androidx.activity.result.ActivityResult
import androidx.activity.result.IntentSenderRequest
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.Scope
import kotlinx.coroutines.tasks.await

/**
 * Autorizzazione Google Drive tramite la Authorization API di Google Identity Services (il
 * percorso raccomandato oggi al posto del vecchio GoogleSignInClient). Richiede che il progetto
 * Google Cloud collegato all'app abbia lo schermo di consenso OAuth configurato e lo SHA-1 di
 * firma registrato — senza questo passaggio (fuori dallo scope di questo repository) le chiamate
 * qui sotto falliscono con un errore di configurazione, non e' un bug del codice.
 */
class GoogleDriveAuthorizationManager(private val context: Context) {

    private val scopeDriveFile = Scope("https://www.googleapis.com/auth/drive.file")

    /**
     * Avvia l'autorizzazione. Se Google puo' concederla silenziosamente ritorna subito il token;
     * altrimenti [avviaRisoluzione] riceve l'IntentSenderRequest da lanciare con
     * `rememberLauncherForActivityResult(ActivityResultContracts.StartIntentSenderForResult())`
     * (vedi ui/settings/SettingsScreen.kt) — il risultato va poi passato a [completaDaRisultato].
     */
    suspend fun autorizza(avviaRisoluzione: (IntentSenderRequest) -> Unit): Result<String> {
        val richiesta = AuthorizationRequest.builder().setRequestedScopes(listOf(scopeDriveFile)).build()
        return try {
            val risultato = Identity.getAuthorizationClient(context).authorize(richiesta).await()
            estraiToken(risultato, avviaRisoluzione)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun completaDaRisultato(activityResult: ActivityResult): Result<String> {
        val dati: Intent = activityResult.data ?: return Result.failure(IllegalStateException("Autorizzazione annullata."))
        return try {
            val risultato = Identity.getAuthorizationClient(context).getAuthorizationResultFromIntent(dati)
            val token = risultato.accessToken ?: return Result.failure(IllegalStateException("Nessun token restituito da Google."))
            Result.success(token)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun estraiToken(risultato: AuthorizationResult, avviaRisoluzione: (IntentSenderRequest) -> Unit): Result<String> {
        if (risultato.hasResolution()) {
            val pendingIntent = risultato.pendingIntent
                ?: return Result.failure(IllegalStateException("Google non ha fornito un modo per completare l'autorizzazione."))
            avviaRisoluzione(IntentSenderRequest.Builder(pendingIntent.intentSender).build())
            return Result.failure(AutorizzazioneInSospesoException)
        }
        val token = risultato.accessToken ?: return Result.failure(IllegalStateException("Nessun token restituito da Google."))
        return Result.success(token)
    }
}

/** Segnala che l'autorizzazione richiede l'interazione dell'utente (gestita da [GoogleDriveAuthorizationManager.completaDaRisultato]). */
data object AutorizzazioneInSospesoException : Exception("Autorizzazione in corso, in attesa del consenso dell'utente.")
