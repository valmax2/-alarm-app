package it.vstudioapps.stylestudio3d.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddAPhoto
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import it.vstudioapps.stylestudio3d.domain.model.StyleCatalogEntry
import it.vstudioapps.stylestudio3d.ui.render.StylePreviewThumb

/**
 * Griglia di stili (capelli/barba/trucco) con tocco lungo/hover per l'anteprima ingrandita.
 * Non e' un feed infinito: mostra sempre e solo le voci della categoria/sottofiltro corrente.
 * Ogni voce puo' ricevere un'anteprima fotorealistica importata (es. generata in locale con
 * ComfyUI): [onRichiediImportazioneAnteprima] chiede allo schermo chiamante di aprire il
 * selettore foto per quella voce. Le voci create dall'utente si possono anche eliminare.
 */
@Composable
fun StyleCatalogGrid(
    voci: List<StyleCatalogEntry>,
    selezionatoId: String?,
    onSeleziona: (StyleCatalogEntry) -> Unit,
    modifier: Modifier = Modifier,
    onRichiediImportazioneAnteprima: (StyleCatalogEntry) -> Unit = {},
    onElimina: (StyleCatalogEntry) -> Unit = {},
) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(3),
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(4.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        items(voci, key = { it.id }) { voce ->
            val selezionato = voce.id == selezionatoId
            HoldToPreview(anteprimaGrande = { StylePreviewThumb(voce, modifier = Modifier.clip(RoundedCornerShape(16.dp))) }) {
                Card(
                    onClick = { onSeleziona(voce) },
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    border = if (selezionato) BorderStroke(2.dp, MaterialTheme.colorScheme.secondary) else null,
                ) {
                    Column {
                        StylePreviewThumb(voce, modifier = Modifier.fillMaxWidth().aspectRatio(1f))
                        Text(
                            text = voce.name,
                            style = MaterialTheme.typography.labelMedium,
                            textAlign = TextAlign.Center,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 2.dp),
                        )
                        Row {
                            IconButton(onClick = { onRichiediImportazioneAnteprima(voce) }) {
                                Icon(Icons.Filled.AddAPhoto, contentDescription = "Importa anteprima reale per \"${voce.name}\"")
                            }
                            if (!voce.isBuiltIn) {
                                IconButton(onClick = { onElimina(voce) }) {
                                    Icon(Icons.Filled.Delete, contentDescription = "Elimina \"${voce.name}\"")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
