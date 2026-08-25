package it.vstudioapps.stylestudio3d.ui.colorAnalysis

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import it.vstudioapps.stylestudio3d.domain.color.ColorSeasonAnalyzer
import it.vstudioapps.stylestudio3d.domain.model.ColorProfileInput
import it.vstudioapps.stylestudio3d.domain.model.Cromia
import it.vstudioapps.stylestudio3d.domain.model.Undertone
import it.vstudioapps.stylestudio3d.domain.model.ValoreChiaroScuro
import it.vstudioapps.stylestudio3d.ui.AppContainer
import it.vstudioapps.stylestudio3d.ui.session.StyleSessionViewModel

/** Armocromia: un breve questionario (nessuna foto obbligatoria) che classifica la stagione cromatica e la incrocia col guardaroba. */
@Composable
fun ColorAnalysisScreen(appContainer: AppContainer, sessionViewModel: StyleSessionViewModel, onIndietro: () -> Unit) {
    var undertone by remember { mutableStateOf<Undertone?>(null) }
    var valore by remember { mutableStateOf<ValoreChiaroScuro?>(null) }
    var cromia by remember { mutableStateOf<Cromia?>(null) }
    val statoSessione by sessionViewModel.stato.collectAsState()
    val capi by appContainer.guardaroba.capi.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Armocromia") },
                navigationIcon = { IconButton(onClick = onIndietro) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Indietro") } },
            )
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding).padding(20.dp).verticalScroll(rememberScrollState())) {
            Text("Rispondi a tre domande veloci per scoprire la tua stagione cromatica.", style = MaterialTheme.typography.bodyLarge)

            DomandaScelta("Il tuo sottotono", Undertone.entries, undertone) { undertone = it }
            DomandaScelta("Chiaro/scuro", ValoreChiaroScuro.entries, valore) { valore = it }
            DomandaScelta("Preferenza di contrasto", Cromia.entries, cromia) { cromia = it }

            Button(
                onClick = {
                    val u = undertone
                    val v = valore
                    val c = cromia
                    if (u != null && v != null && c != null) {
                        sessionViewModel.impostaColorSeason(ColorSeasonAnalyzer.analyze(ColorProfileInput(u, v, c)))
                    }
                },
                enabled = undertone != null && valore != null && cromia != null,
                modifier = Modifier.padding(top = 16.dp),
            ) { Text("Scopri la mia stagione") }

            val stagione = statoSessione.colorSeason
            if (stagione != null) {
                Card(modifier = Modifier.fillMaxWidth().padding(top = 20.dp)) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(stagione.etichetta, style = MaterialTheme.typography.titleLarge)
                        Text(stagione.descrizione, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp))
                        Text("Palette consigliata", style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(top = 12.dp))
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                            items(stagione.paletteHex) { hex ->
                                Box(
                                    modifier = Modifier.size(36.dp).clip(CircleShape)
                                        .background(runCatching { Color(android.graphics.Color.parseColor(hex)) }.getOrDefault(Color.Gray)),
                                )
                            }
                        }
                    }
                }

                val corrispondenti = capi.filter { ColorSeasonAnalyzer.corrisponde(it.dominantColorHex, stagione) }
                Text(
                    "Dal tuo guardaroba (${corrispondenti.size} di ${capi.size} capi si abbinano)",
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(top = 20.dp, bottom = 8.dp),
                )
                if (capi.isEmpty()) {
                    Text("Aggiungi capi al guardaroba per vedere qui gli abbinamenti.", style = MaterialTheme.typography.bodyMedium)
                } else {
                    Column {
                        corrispondenti.forEach { capo ->
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 4.dp)) {
                                Box(
                                    modifier = Modifier.size(20.dp).clip(CircleShape)
                                        .background(runCatching { Color(android.graphics.Color.parseColor(capo.dominantColorHex)) }.getOrDefault(Color.Gray)),
                                )
                                Text(capo.name, modifier = Modifier.padding(start = 8.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun <T> DomandaScelta(titolo: String, opzioni: List<T>, selezionato: T?, onSelect: (T) -> Unit) where T : Enum<T> {
    Text(titolo, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 16.dp, bottom = 8.dp))
    Column {
        opzioni.forEach { opzione ->
            val etichetta = when (opzione) {
                is Undertone -> opzione.etichetta
                is ValoreChiaroScuro -> opzione.etichetta
                is Cromia -> opzione.etichetta
                else -> opzione.name
            }
            FilterChip(
                selected = opzione == selezionato,
                onClick = { onSelect(opzione) },
                label = { Text(etichetta) },
                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
            )
        }
    }
}
