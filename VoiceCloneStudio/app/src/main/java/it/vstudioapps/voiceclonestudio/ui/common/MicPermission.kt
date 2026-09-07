package it.vstudioapps.voiceclonestudio.ui.common

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat

/**
 * Stato + richiesta del permesso RECORD_AUDIO, necessario solo per registrare in-app i
 * campioni vocali per la clonazione e l'audio sorgente per la conversione (non per la
 * dettatura del testo, che passa dall'app di sistema — vedi [MicDictationButton]).
 */
@Composable
fun rememberMicPermissionState(onGranted: () -> Unit): MicPermissionState {
    val context = LocalContext.current
    var granted by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED
        )
    }

    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        granted = isGranted
        if (isGranted) onGranted()
    }

    return remember(granted) {
        MicPermissionState(
            isGranted = granted,
            requestPermission = { launcher.launch(Manifest.permission.RECORD_AUDIO) }
        )
    }
}

class MicPermissionState(
    val isGranted: Boolean,
    val requestPermission: () -> Unit
) {
    /** Se il permesso c'è già esegue subito [action], altrimenti lo chiede prima. */
    fun withPermission(action: () -> Unit) {
        if (isGranted) action() else requestPermission()
    }
}
