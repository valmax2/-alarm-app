package it.vstudioapps.faceguard.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.PersonOff
import androidx.compose.material.icons.filled.PictureInPicture
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import it.vstudioapps.faceguard.model.AppSettings
import it.vstudioapps.faceguard.model.CoverMode
import it.vstudioapps.faceguard.service.PresenceUiState
import it.vstudioapps.faceguard.service.ServiceRunState
import it.vstudioapps.faceguard.ui.PermissionsState
import it.vstudioapps.faceguard.ui.components.PermissionCard

@Composable
fun MonitorScreen(
    settings: AppSettings,
    permissions: PermissionsState,
    presenceState: PresenceUiState,
    buildInfo: String,
    onRequestCameraPermission: () -> Unit,
    onRequestNotificationsPermission: () -> Unit,
    onRequestOverlayPermission: () -> Unit,
    onRequestDeviceAdmin: () -> Unit,
    onRevokeDeviceAdmin: () -> Unit,
    onToggleMonitoring: (Boolean) -> Unit,
    onStartEnrollment: () -> Unit,
    onClearEnrollment: () -> Unit
) {
    val needsOverlay = settings.coverMode != CoverMode.LOCK_SCREEN
    val needsDeviceAdmin = settings.coverMode == CoverMode.LOCK_SCREEN
    val ownerEnrolled = settings.ownerFaceSignature != null
    val canStart = ownerEnrolled && permissions.canStartMonitoring && (!needsOverlay || permissions.overlayGranted)

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { StatusCard(settings = settings, presenceState = presenceState) }

        item {
            Button(
                onClick = { onToggleMonitoring(settings.monitoringEnabled.not()) },
                enabled = settings.monitoringEnabled || canStart,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(if (settings.monitoringEnabled) "Ferma monitoraggio" else "Avvia monitoraggio")
            }
        }

        item {
            Text(
                text = "Chi riconoscere",
                style = MaterialTheme.typography.titleMedium
            )
        }

        item {
            PermissionCard(
                title = "Volto registrato",
                description = if (ownerEnrolled) {
                    "Solo il volto registrato tiene lo schermo sbloccato."
                } else {
                    "Registra il tuo volto: obbligatorio prima di avviare il monitoraggio."
                },
                granted = ownerEnrolled,
                actionLabel = "Registra",
                onAction = onStartEnrollment
            )
        }

        if (ownerEnrolled) {
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onStartEnrollment) { Text("Registra di nuovo") }
                    TextButton(onClick = onClearEnrollment) { Text("Cancella") }
                }
            }
        }

        item {
            Text(
                text = "Permessi",
                style = MaterialTheme.typography.titleMedium
            )
        }

        item {
            PermissionCard(
                title = "Fotocamera",
                description = "Necessaria per rilevare il tuo volto.",
                granted = permissions.cameraGranted,
                actionLabel = "Concedi",
                onAction = onRequestCameraPermission
            )
        }

        item {
            PermissionCard(
                title = "Notifiche",
                description = "Mostra lo stato del monitoraggio mentre è attivo.",
                granted = permissions.notificationsGranted,
                actionLabel = "Concedi",
                onAction = onRequestNotificationsPermission
            )
        }

        if (needsOverlay) {
            item {
                PermissionCard(
                    title = "Disegna sopra le altre app",
                    description = "Necessaria per mostrare la copertura sopra qualunque app aperta.",
                    granted = permissions.overlayGranted,
                    actionLabel = "Concedi",
                    onAction = onRequestOverlayPermission
                )
            }
        }

        if (needsDeviceAdmin) {
            item {
                PermissionCard(
                    title = "Amministratore dispositivo",
                    description = "Necessaria per bloccare subito lo schermo in modalità \"Blocco schermo\".",
                    granted = permissions.deviceAdminActive,
                    actionLabel = "Concedi",
                    onAction = onRequestDeviceAdmin
                )
            }
            if (permissions.deviceAdminActive) {
                item {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        TextButton(onClick = onRevokeDeviceAdmin) { Text("Revoca amministratore dispositivo") }
                    }
                }
            }
        }

        item {
            Text(
                text = buildInfo,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
private fun StatusCard(settings: AppSettings, presenceState: PresenceUiState) {
    val (label, detail) = statusText(settings, presenceState)

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (presenceState.coverActive) {
                MaterialTheme.colorScheme.errorContainer
            } else {
                MaterialTheme.colorScheme.primaryContainer
            }
        )
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                imageVector = statusIcon(presenceState),
                contentDescription = null,
                modifier = Modifier.size(48.dp)
            )
            Text(text = label, style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Center)
            Text(text = detail, style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center)
        }
    }
}

private fun statusIcon(state: PresenceUiState) = when {
    state.coverActive -> Icons.Filled.Shield
    state.runState == ServiceRunState.RUNNING && state.ownerRecognized -> Icons.Filled.CameraAlt
    state.runState == ServiceRunState.RUNNING && state.strangerDetected -> Icons.Filled.PersonOff
    state.runState == ServiceRunState.RUNNING -> Icons.Filled.Face
    else -> Icons.Filled.PictureInPicture
}

private fun statusText(settings: AppSettings, state: PresenceUiState): Pair<String, String> = when {
    state.runState == ServiceRunState.NOT_ENROLLED ->
        "Nessun volto registrato" to "Registra il tuo volto qui sotto prima di avviare il monitoraggio."
    !settings.monitoringEnabled || state.runState == ServiceRunState.STOPPED ->
        "Monitoraggio spento" to "Avvia il monitoraggio per iniziare a proteggere lo schermo."
    state.runState == ServiceRunState.CAMERA_ERROR ->
        "Errore fotocamera" to "Controlla il permesso Fotocamera e riprova ad avviare il monitoraggio."
    state.runState == ServiceRunState.STARTING ->
        "Avvio in corso…" to "Sto aprendo la fotocamera frontale."
    state.coverActive ->
        "Copertura attiva" to when (settings.coverMode) {
            CoverMode.LOCK_SCREEN -> "Il dispositivo è stato bloccato."
            else -> "Non riconosco più il tuo volto."
        }
    state.ownerRecognized ->
        "Riconosciuto" to "Tutto ok, sei davanti allo schermo."
    state.strangerDetected ->
        "Volto non riconosciuto" to "C'è qualcuno davanti alla telecamera, ma non sei tu."
    else ->
        "Nessun volto rilevato" to "In attesa prima di attivare la copertura…"
}
