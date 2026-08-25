package it.vstudioapps.stylestudio3d.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import it.vstudioapps.stylestudio3d.domain.model.StyleAttributes
import it.vstudioapps.stylestudio3d.domain.model.StyleCategory
import it.vstudioapps.stylestudio3d.domain.model.StyleLength
import it.vstudioapps.stylestudio3d.domain.model.StyleTexture
import it.vstudioapps.stylestudio3d.domain.model.StyleVolume
import it.vstudioapps.stylestudio3d.domain.model.TargetAudience

private val coloriPreset = listOf(
    "#2B1B12", "#5C3A22", "#8C6A3F", "#B8905A", "#D9B679", "#000000",
    "#B01030", "#8A5A3B", "#5A4A8C", "#1F6FB2", "#6B8E23",
)

/**
 * Form per aggiungere una nuova voce al catalogo: il nome e' testo libero, in qualunque lingua —
 * non c'e' un elenco chiuso da cui scegliere. Alla conferma la voce viene creata subito con la
 * sua anteprima procedurale (vedi [it.vstudioapps.stylestudio3d.ui.render.StylePreviewRenderer]).
 */
@Composable
fun CreateStyleDialog(categoria: StyleCategory, onDismiss: () -> Unit, onCrea: (nome: String, attributi: StyleAttributes) -> Unit) {
    var nome by remember { mutableStateOf("") }
    var lunghezza by remember { mutableStateOf(StyleLength.MEDIO) }
    var volume by remember { mutableStateOf(StyleVolume.NATURALE) }
    var texture by remember { mutableStateOf(StyleTexture.LISCIO) }
    var audience by remember { mutableStateOf(TargetAudience.UNISEX) }
    var colore by remember { mutableStateOf(coloriPreset.first()) }
    var intensita by remember { mutableStateOf(0.5f) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Crea nuovo stile di ${categoria.etichetta.lowercase()}") },
        text = {
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                OutlinedTextField(
                    value = nome,
                    onValueChange = { nome = it },
                    label = { Text("Nome (in qualsiasi lingua)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )

                SezioneChip("Lunghezza", StyleLength.entries, lunghezza, { it.etichetta }) { lunghezza = it }
                SezioneChip("Volume", StyleVolume.entries, volume, { it.etichetta }) { volume = it }
                if (categoria == StyleCategory.CAPELLI) {
                    SezioneChip("Texture", StyleTexture.entries, texture, { it.etichetta }) { texture = it }
                }
                SezioneChip("Pensato per", TargetAudience.entries, audience, { it.etichetta }) { audience = it }

                Text("Colore", modifier = Modifier.padding(top = 12.dp, bottom = 6.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(coloriPreset) { hex ->
                        val selezionato = hex == colore
                        val colorePreview = runCatching { Color(android.graphics.Color.parseColor(hex)) }.getOrDefault(Color.Gray)
                        Box(
                            modifier = Modifier
                                .size(if (selezionato) 34.dp else 28.dp)
                                .clip(CircleShape)
                                .background(colorePreview)
                                .clickable { colore = hex },
                        )
                    }
                }

                Text("Intensita': ${(intensita * 100).toInt()}%", modifier = Modifier.padding(top = 12.dp))
                Slider(value = intensita, onValueChange = { intensita = it })
            }
        },
        confirmButton = {
            TextButton(
                enabled = nome.isNotBlank(),
                onClick = {
                    onCrea(
                        nome,
                        StyleAttributes(
                            length = lunghezza,
                            volume = volume,
                            texture = texture,
                            targetAudience = audience,
                            colorHex = colore,
                            intensity = intensita,
                        ),
                    )
                },
            ) { Text("Crea") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Annulla") } },
    )
}

@Composable
private fun <T> SezioneChip(titolo: String, opzioni: List<T>, selezionato: T, etichetta: (T) -> String, onSelect: (T) -> Unit) {
    Text(titolo, modifier = Modifier.padding(top = 12.dp, bottom = 6.dp))
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(opzioni) { opzione ->
            FilterChip(selected = opzione == selezionato, onClick = { onSelect(opzione) }, label = { Text(etichetta(opzione)) })
        }
    }
}
