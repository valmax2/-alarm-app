package it.vstudioapps.stylestudio3d.ui.wardrobe

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Checkroom
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import coil.compose.rememberAsyncImagePainter
import it.vstudioapps.stylestudio3d.domain.model.GarmentCategory
import it.vstudioapps.stylestudio3d.ui.AppContainer
import it.vstudioapps.stylestudio3d.ui.components.HoldToPreview
import it.vstudioapps.stylestudio3d.ui.components.LoadingOverlay
import it.vstudioapps.stylestudio3d.ui.session.OperazioneUiState
import it.vstudioapps.stylestudio3d.ui.session.StyleSessionViewModel
import kotlinx.coroutines.launch

/**
 * Guardaroba virtuale per una o piu' categorie di capi (Abbigliamento con le sue sottocategorie,
 * oppure Scarpe da sola). Ogni capo nasce da una foto reale caricata qui.
 */
@Composable
fun WardrobeScreen(
    appContainer: AppContainer,
    sessionViewModel: StyleSessionViewModel,
    categorie: List<GarmentCategory>,
    titolo: String,
    onIndietro: () -> Unit,
) {
    var tabIndex by remember { mutableIntStateOf(0) }
    val categoriaCorrente = categorie[tabIndex]
    val tuttiICapi by appContainer.guardaroba.capi.collectAsState()
    val capi = tuttiICapi.filter { it.category == categoriaCorrente }
    val statoSessione by sessionViewModel.stato.collectAsState()
    val operazione by sessionViewModel.operazione.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    var fotoDaAggiungere by remember { mutableStateOf<Uri?>(null) }
    var capoInProvaVirtuale by remember { mutableStateOf<String?>(null) }

    val selettoreNuovoCapo = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) fotoDaAggiungere = uri
    }
    val selettoreFotoProva = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        val capoId = capoInProvaVirtuale
        if (uri != null && capoId != null) sessionViewModel.provaCapo(capoId, uri)
        capoInProvaVirtuale = null
    }

    LaunchedEffect(operazione) {
        val stato = operazione
        if (stato is OperazioneUiState.NonRiuscita) snackbarHostState.showSnackbar(stato.messaggioUtente)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(titolo) },
                navigationIcon = { IconButton(onClick = onIndietro) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Indietro") } },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        floatingActionButton = {
            FloatingActionButton(onClick = { selettoreNuovoCapo.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }) {
                Icon(Icons.Filled.Add, contentDescription = "Aggiungi capo")
            }
        },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            Column {
                if (categorie.size > 1) {
                    TabRow(selectedTabIndex = tabIndex) {
                        categorie.forEachIndexed { indice, categoria ->
                            Tab(selected = tabIndex == indice, onClick = { tabIndex = indice }, text = { Text(categoria.etichetta) })
                        }
                    }
                }

                if (capi.isEmpty()) {
                    Column(modifier = Modifier.fillMaxSize().padding(32.dp)) {
                        Icon(Icons.Filled.Checkroom, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
                        Text(
                            "Nessun capo qui ancora. Tocca + per caricare una foto e aggiungerlo al guardaroba.",
                            style = MaterialTheme.typography.bodyLarge,
                        )
                    }
                } else {
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(3),
                        contentPadding = PaddingValues(12.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        items(capi, key = { it.id }) { capo ->
                            val selezionato = statoSessione.outfitPerCategoria[capo.category] == capo.id
                            HoldToPreview(anteprimaGrande = {
                                Image(
                                    painter = rememberAsyncImagePainter(capo.photoPath),
                                    contentDescription = capo.name,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.fillMaxSize(),
                                )
                            }) {
                                Card(
                                    onClick = { sessionViewModel.selezionaCapo(capo.category, if (selezionato) null else capo.id) },
                                    border = if (selezionato) BorderStroke(2.dp, MaterialTheme.colorScheme.secondary) else null,
                                ) {
                                    Column {
                                        Image(
                                            painter = rememberAsyncImagePainter(capo.photoPath),
                                            contentDescription = capo.name,
                                            contentScale = ContentScale.Crop,
                                            modifier = Modifier.fillMaxWidth().aspectRatio(1f).clip(CardDefaults.shape),
                                        )
                                        Text(capo.name, style = MaterialTheme.typography.labelMedium, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(4.dp))
                                        TextButton(onClick = { capoInProvaVirtuale = capo.id; selettoreFotoProva.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }) {
                                            Text("Prova virtuale")
                                        }
                                        IconButton(onClick = { scope.launch { appContainer.guardaroba.rimuoviCapo(capo.id) } }) {
                                            Icon(Icons.Filled.Delete, contentDescription = "Rimuovi capo")
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (operazione is OperazioneUiState.InCorso) {
                LoadingOverlay(messaggio = "Applico la prova virtuale...")
            }
        }
    }

    val fotoInAttesaDiNome = fotoDaAggiungere
    if (fotoInAttesaDiNome != null) {
        AggiungiCapoDialog(
            onDismiss = { fotoDaAggiungere = null },
            onConferma = { nome ->
                scope.launch { appContainer.guardaroba.aggiungiCapo(fotoInAttesaDiNome, categoriaCorrente, nome) }
                fotoDaAggiungere = null
            },
        )
    }
}

@Composable
private fun AggiungiCapoDialog(onDismiss: () -> Unit, onConferma: (String) -> Unit) {
    var nome by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Nome del capo") },
        text = {
            OutlinedTextField(value = nome, onValueChange = { nome = it }, label = { Text("Es. \"Camicia bianca\"") }, singleLine = true)
        },
        confirmButton = { TextButton(onClick = { onConferma(nome) }) { Text("Aggiungi") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Annulla") } },
    )
}
