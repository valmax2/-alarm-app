package it.vstudioapps.faceguard.ui.components

import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp

/**
 * Shown once, on the next launch after an uncaught crash — see MainActivity's crash handler.
 * There's no attached debugger on a build a real user installed, so this is the only way they
 * (or the developer, if they paste it into a bug report) get to see what actually happened.
 */
@Composable
fun CrashReportDialog(report: String, onDismiss: () -> Unit) {
    val clipboardManager = LocalClipboardManager.current

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("FaceGuard si è chiuso inaspettatamente") },
        text = {
            Text(
                text = report,
                style = MaterialTheme.typography.bodySmall,
                color = LocalContentColor.current,
                modifier = Modifier.heightIn(max = 320.dp).verticalScroll(rememberScrollState())
            )
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Chiudi") }
        },
        dismissButton = {
            TextButton(onClick = { clipboardManager.setText(AnnotatedString(report)) }) {
                Text("Copia")
            }
        }
    )
}
