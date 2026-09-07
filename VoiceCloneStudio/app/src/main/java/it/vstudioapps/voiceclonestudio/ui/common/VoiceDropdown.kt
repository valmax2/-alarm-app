package it.vstudioapps.voiceclonestudio.ui.common

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenu
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import it.vstudioapps.voiceclonestudio.data.ClonedVoice

/** Menu a tendina per scegliere una delle voci clonate dell'utente. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VoiceDropdown(
    voices: List<ClonedVoice>,
    selected: ClonedVoice?,
    onSelected: (ClonedVoice) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it },
        modifier = modifier
    ) {
        OutlinedTextField(
            value = selected?.name ?: "Seleziona una voce",
            onValueChange = {},
            readOnly = true,
            label = { Text("Voce") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                .fillMaxWidth()
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            voices.forEach { voice ->
                DropdownMenuItem(
                    text = { Text(voice.name) },
                    onClick = {
                        onSelected(voice)
                        expanded = false
                    }
                )
            }
        }
    }
}
