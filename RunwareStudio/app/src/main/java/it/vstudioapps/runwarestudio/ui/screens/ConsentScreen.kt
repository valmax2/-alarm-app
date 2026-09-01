package it.vstudioapps.runwarestudio.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/**
 * Hard gate shown once before anything else in the app is reachable. Runware Studio can
 * generate unrestricted content depending on the chosen model, so this is a real checkpoint,
 * not a formality: both boxes must be explicitly ticked before "Continua" enables.
 */
@Composable
fun ConsentScreen(onAccept: () -> Unit) {
    var ageConfirmed by remember { mutableStateOf(false) }
    var consentConfirmed by remember { mutableStateOf(false) }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                Icons.Filled.Shield,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.height(48.dp)
            )
            Spacer(Modifier.height(16.dp))
            Text(
                "Prima di iniziare",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "Runware Studio genera immagini con modelli di intelligenza artificiale in " +
                    "base a ciò che scrivi, incluse alcune varianti pensate per contenuti " +
                    "espliciti tra adulti. Prima di continuare, conferma quanto segue.",
                style = MaterialTheme.typography.bodyMedium
            )
            Spacer(Modifier.height(24.dp))

            ConsentRow(
                checked = ageConfirmed,
                onCheckedChange = { ageConfirmed = it },
                text = "Confermo di avere almeno 18 anni."
            )
            Spacer(Modifier.height(12.dp))
            ConsentRow(
                checked = consentConfirmed,
                onCheckedChange = { consentConfirmed = it },
                text = "Userò questa app solo per generare contenuti che coinvolgono " +
                    "esclusivamente soggetti adulti e consenzienti. Non genererò né tenterò " +
                    "di generare contenuti che coinvolgono minori, in nessuna forma."
            )

            Spacer(Modifier.height(32.dp))
            Button(
                onClick = onAccept,
                enabled = ageConfirmed && consentConfirmed,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Continua")
            }
        }
    }
}

@Composable
private fun ConsentRow(checked: Boolean, onCheckedChange: (Boolean) -> Unit, text: String) {
    Row(verticalAlignment = Alignment.Top) {
        Checkbox(checked = checked, onCheckedChange = onCheckedChange)
        Spacer(Modifier.height(0.dp))
        Text(
            text,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(top = 12.dp)
        )
    }
}
