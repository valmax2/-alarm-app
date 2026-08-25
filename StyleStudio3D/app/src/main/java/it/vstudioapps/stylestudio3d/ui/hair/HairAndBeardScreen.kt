package it.vstudioapps.stylestudio3d.ui.hair

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material3.Button
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import it.vstudioapps.stylestudio3d.domain.model.ProfiloStile
import it.vstudioapps.stylestudio3d.domain.model.StyleCatalogEntry
import it.vstudioapps.stylestudio3d.domain.model.StyleCategory
import it.vstudioapps.stylestudio3d.export.ExternalChatExportHelper
import it.vstudioapps.stylestudio3d.ui.AppContainer
import it.vstudioapps.stylestudio3d.ui.components.CreateStyleDialog
import it.vstudioapps.stylestudio3d.ui.components.LoadingOverlay
import it.vstudioapps.stylestudio3d.ui.components.StyleCatalogGrid
import it.vstudioapps.stylestudio3d.ui.session.OperazioneUiState
import it.vstudioapps.stylestudio3d.ui.session.StyleSessionViewModel
import it.vstudioapps.stylestudio3d.util.ImageIo
import kotlinx.coroutines.launch
import java.io.File

/**
 * Capelli e Barba/Baffi in un'unica schermata a tab. Se il profilo scelto e' "Donna" la barba
 * non compare proprio: niente tab, niente voce nel catalogo — non solo un suggerimento.
 */
@Composable
fun HairAndBeardScreen(appContainer: AppContainer, sessionViewModel: StyleSessionViewModel, onIndietro: () -> Unit) {
    val preferenze by appContainer.preferenzeUtente.preferenze.collectAsState(initial = null)
    val mostraBarba = preferenze?.profiloStile != ProfiloStile.DONNA

    var tabIndex by remember { mutableIntStateOf(0) }
    val categoria = if (mostraBarba && tabIndex == 1) StyleCategory.BARBA else StyleCategory.CAPELLI
    val tutteLeVoci by appContainer.catalogoStili.stili.collectAsState()
    val voci = tutteLeVoci.filter { it.category == categoria }
    val statoSessione by sessionViewModel.stato.collectAsState()
    val selezionatoId = if (categoria == StyleCategory.CAPELLI) statoSessione.hairEntryId else statoSessione.beardEntryId

    var mostraDialogCrea by remember { mutableStateOf(false) }
    var fotoScelta by remember { mutableStateOf<android.net.Uri?>(null) }
    val operazione by sessionViewModel.operazione.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var voceInImportazione by remember { mutableStateOf<StyleCatalogEntry?>(null) }

    val selettoreFoto = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            fotoScelta = uri
            selezionatoId?.let { id -> sessionViewModel.applicaStileAFoto(categoria, id, uri) }
        }
    }
    val selettoreAnteprimaReale = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        val voce = voceInImportazione
        if (uri != null && voce != null) {
            scope.launch {
                val cartella = File(context.filesDir, "style_previews")
                val file = ImageIo.copiaUriInStorageInterno(context, uri, cartella, "jpg")
                if (file != null) appContainer.catalogoStili.impostaAnteprimaImportata(voce.id, file.absolutePath)
            }
        }
        voceInImportazione = null
    }
    val selettoreRisultatoEsterno = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) sessionViewModel.importaRisultatoEsterno(uri)
    }

    LaunchedEffect(operazione) {
        val stato = operazione
        if (stato is OperazioneUiState.NonRiuscita) snackbarHostState.showSnackbar(stato.messaggioUtente)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (categoria == StyleCategory.CAPELLI) "Capelli" else "Barba & Baffi") },
                navigationIcon = { IconButton(onClick = onIndietro) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Indietro") } },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        floatingActionButton = {
            FloatingActionButton(onClick = { mostraDialogCrea = true }) { Icon(Icons.Filled.Add, contentDescription = "Crea nuovo stile") }
        },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            Column {
                if (mostraBarba) {
                    TabRow(selectedTabIndex = tabIndex) {
                        Tab(selected = tabIndex == 0, onClick = { tabIndex = 0 }, text = { Text("Capelli") })
                        Tab(selected = tabIndex == 1, onClick = { tabIndex = 1 }, text = { Text("Barba & Baffi") })
                    }
                }

                Button(
                    onClick = { selettoreFoto.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                    modifier = Modifier.padding(16.dp),
                    enabled = selezionatoId != null,
                ) {
                    Icon(Icons.Filled.PhotoLibrary, contentDescription = null)
                    Text(text = if (fotoScelta == null) "  Carica una tua foto e applica" else "  Cambia foto e riapplica", modifier = Modifier.padding(start = 4.dp))
                }

                // Senza abbonamento IA collegato: prepara comunque foto + prompt per una chat esterna
                // (es. ChatGPT), poi reimporta qui il risultato ottenuto manualmente.
                Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                    OutlinedButton(
                        onClick = {
                            val id = selezionatoId ?: return@OutlinedButton
                            scope.launch {
                                val risultato = sessionViewModel.preparaEsportazioneStile(id, fotoScelta)
                                if (risultato != null) {
                                    context.startActivity(ExternalChatExportHelper.condividiStile(context, risultato.first, risultato.second))
                                } else {
                                    snackbarHostState.showSnackbar("Carica prima una tua foto.")
                                }
                            }
                        },
                        enabled = selezionatoId != null,
                        modifier = Modifier.weight(1f),
                    ) { Text("Chat esterna ↗", maxLines = 1) }

                    OutlinedButton(
                        onClick = { selettoreRisultatoEsterno.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                        modifier = Modifier.weight(1f).padding(start = 8.dp),
                    ) { Text("Importa risultato ↓", maxLines = 1) }
                }

                StyleCatalogGrid(
                    voci = voci,
                    selezionatoId = selezionatoId,
                    onSeleziona = { voce ->
                        if (categoria == StyleCategory.CAPELLI) sessionViewModel.selezionaCapelli(voce.id) else sessionViewModel.selezionaBarba(voce.id)
                        val foto = fotoScelta
                        if (foto != null) sessionViewModel.applicaStileAFoto(categoria, voce.id, foto)
                    },
                    modifier = Modifier.padding(horizontal = 12.dp),
                    onRichiediImportazioneAnteprima = { voce ->
                        voceInImportazione = voce
                        selettoreAnteprimaReale.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                    },
                    onElimina = { voce -> scope.launch { appContainer.catalogoStili.eliminaStilePersonalizzato(voce.id) } },
                )
            }

            if (operazione is OperazioneUiState.InCorso) {
                LoadingOverlay(messaggio = "Applico lo stile alla tua foto...")
            }
        }
    }

    if (mostraDialogCrea) {
        CreateStyleDialog(
            categoria = categoria,
            onDismiss = { mostraDialogCrea = false },
            onCrea = { nome, attributi ->
                scope.launch { appContainer.catalogoStili.creaStilePersonalizzato(categoria, nome, attributi) }
                mostraDialogCrea = false
            },
        )
    }
}
