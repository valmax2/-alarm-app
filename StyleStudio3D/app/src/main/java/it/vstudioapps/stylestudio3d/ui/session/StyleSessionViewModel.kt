package it.vstudioapps.stylestudio3d.ui.session

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import it.vstudioapps.stylestudio3d.data.GenerationHistoryRepository
import it.vstudioapps.stylestudio3d.data.StyleCatalogRepository
import it.vstudioapps.stylestudio3d.data.WardrobeRepository
import it.vstudioapps.stylestudio3d.domain.ai.AiOutcome
import it.vstudioapps.stylestudio3d.domain.ai.AiServiceFactory
import it.vstudioapps.stylestudio3d.domain.model.ColorSeason
import it.vstudioapps.stylestudio3d.domain.model.GarmentCategory
import it.vstudioapps.stylestudio3d.domain.model.GenerationResult
import it.vstudioapps.stylestudio3d.domain.model.GenerationSource
import it.vstudioapps.stylestudio3d.domain.model.PhotoStudioSpec
import it.vstudioapps.stylestudio3d.domain.model.StyleCategory
import it.vstudioapps.stylestudio3d.ui.render.MannequinParams
import it.vstudioapps.stylestudio3d.ui.render.MannequinRenderer
import it.vstudioapps.stylestudio3d.ui.studio.StudioCompositor
import it.vstudioapps.stylestudio3d.util.ImageIo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID

/** Stato di un'operazione IA in corso (editing capelli/barba/trucco, prova virtuale, scatto finale). */
sealed interface OperazioneUiState {
    data object Inattiva : OperazioneUiState
    data object InCorso : OperazioneUiState
    data class Completata(val fonte: GenerationSource) : OperazioneUiState
    data class NonRiuscita(val messaggioUtente: String) : OperazioneUiState
}

class StyleSessionViewModel(
    private val appContext: Context,
    private val catalogoStili: StyleCatalogRepository,
    private val guardaroba: WardrobeRepository,
    private val cronologiaCreazioni: GenerationHistoryRepository,
    private val serviziAi: AiServiceFactory,
) : ViewModel() {

    private val _stato = MutableStateFlow(StyleSessionState())
    val stato: StateFlow<StyleSessionState> = _stato.asStateFlow()

    private val _operazione = MutableStateFlow<OperazioneUiState>(OperazioneUiState.Inattiva)
    val operazione: StateFlow<OperazioneUiState> = _operazione.asStateFlow()

    /** Parametri del manichino sempre aggiornati con le scelte correnti: usato da Figura Intera e Studio Fotografico. */
    val mannequinParams: StateFlow<MannequinParams> = combine(
        _stato, catalogoStili.stili, guardaroba.capi,
    ) { s, _, _ -> parametriManichino(s) }.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5000),
        parametriManichino(_stato.value),
    )

    fun selezionaCapelli(id: String?) = _stato.update { it.copy(hairEntryId = id) }
    fun selezionaBarba(id: String?) = _stato.update { it.copy(beardEntryId = id) }
    fun selezionaTrucco(id: String?) = _stato.update { it.copy(makeupEntryId = id) }

    fun selezionaCapo(categoria: GarmentCategory, id: String?) = _stato.update { attuale ->
        val nuovaMappa = attuale.outfitPerCategoria.toMutableMap()
        if (id == null) nuovaMappa.remove(categoria) else nuovaMappa[categoria] = id
        attuale.copy(outfitPerCategoria = nuovaMappa)
    }

    fun impostaColorSeason(stagione: ColorSeason) = _stato.update { it.copy(colorSeason = stagione) }
    fun impostaStudioSpec(spec: PhotoStudioSpec) = _stato.update { it.copy(studioSpec = spec) }

    /**
     * Applica lo stile scelto alla foto dell'utente. Se una foto e' gia' stata modificata in
     * precedenza nella sessione (es. hai gia' cambiato i capelli e ora cambi il trucco), l'editing
     * si incatena su quella invece che ripartire dalla foto originale, cosi' le modifiche si sommano.
     */
    fun applicaStileAFoto(categoria: StyleCategory, entryId: String, fotoUriIniziale: Uri?) {
        val voce = catalogoStili.stili.value.find { it.id == entryId && it.category == categoria } ?: return
        viewModelScope.launch {
            _operazione.value = OperazioneUiState.InCorso
            val basePath = _stato.value.fotoUtenteModificataPath
            val fotoBase = withContext(Dispatchers.IO) {
                when {
                    basePath != null -> ImageIo.decodificaBitmapDaFile(basePath)
                    fotoUriIniziale != null -> ImageIo.decodificaBitmapDaUri(appContext, fotoUriIniziale)
                    else -> null
                }
            }
            if (fotoBase == null) {
                _operazione.value = OperazioneUiState.NonRiuscita("Carica prima una tua foto per applicare lo stile.")
                return@launch
            }
            when (val esito = serviziAi.hairMakeupService().applicaStile(fotoBase, voce)) {
                is AiOutcome.Successo -> {
                    val file = withContext(Dispatchers.IO) { ImageIo.salvaBitmapInCache(appContext, esito.dato, "sessione") }
                    _stato.update { it.copy(fotoUtenteModificataPath = file.absolutePath, fonteFotoUtente = esito.fonte) }
                    _operazione.value = OperazioneUiState.Completata(esito.fonte)
                }
                else -> _operazione.value = OperazioneUiState.NonRiuscita(messaggioPer(esito))
            }
        }
    }

    fun provaCapo(capoId: String, fotoUriIniziale: Uri?) {
        val capo = guardaroba.capi.value.find { it.id == capoId } ?: return
        viewModelScope.launch {
            _operazione.value = OperazioneUiState.InCorso
            val basePath = _stato.value.fotoUtenteModificataPath
            val fotoBase = withContext(Dispatchers.IO) {
                when {
                    basePath != null -> ImageIo.decodificaBitmapDaFile(basePath)
                    fotoUriIniziale != null -> ImageIo.decodificaBitmapDaUri(appContext, fotoUriIniziale)
                    else -> null
                }
            }
            if (fotoBase == null) {
                _operazione.value = OperazioneUiState.NonRiuscita("Carica prima una tua foto per la prova virtuale.")
                return@launch
            }
            when (val esito = serviziAi.virtualTryOnService().provaCapo(fotoBase, capo)) {
                is AiOutcome.Successo -> {
                    val file = withContext(Dispatchers.IO) { ImageIo.salvaBitmapInCache(appContext, esito.dato, "sessione") }
                    _stato.update {
                        it.copy(
                            fotoUtenteModificataPath = file.absolutePath,
                            fonteFotoUtente = esito.fonte,
                            outfitPerCategoria = it.outfitPerCategoria + (capo.category to capo.id),
                        )
                    }
                    _operazione.value = OperazioneUiState.Completata(esito.fonte)
                }
                else -> _operazione.value = OperazioneUiState.NonRiuscita(messaggioPer(esito))
            }
        }
    }

    /**
     * Genera lo scatto finale in Studio Fotografico: usa la foto reale gia' modificata se
     * presente, altrimenti ricade sul manichino procedurale (sempre disponibile, senza foto).
     */
    fun generaScattoStudio() {
        viewModelScope.launch {
            _operazione.value = OperazioneUiState.InCorso
            val statoAttuale = _stato.value
            val (bitmapFinale, fonte) = withContext(Dispatchers.IO) {
                val fotoModificata = statoAttuale.fotoUtenteModificataPath?.let { ImageIo.decodificaBitmapDaFile(it) }
                if (fotoModificata != null) {
                    StudioCompositor.componi(fotoModificata, statoAttuale.studioSpec) to
                        (statoAttuale.fonteFotoUtente ?: GenerationSource.ANTEPRIMA_LOCALE)
                } else {
                    val bitmap = android.graphics.Bitmap.createBitmap(1080, 1440, android.graphics.Bitmap.Config.ARGB_8888)
                    MannequinRenderer.disegna(android.graphics.Canvas(bitmap), 1080, 1440, parametriManichino(statoAttuale))
                    bitmap to GenerationSource.ANTEPRIMA_LOCALE
                }
            }
            val file = withContext(Dispatchers.IO) { ImageIo.salvaBitmapInCache(appContext, bitmapFinale, "creazioni") }
            val risultato = GenerationResult(
                id = "scatto-${UUID.randomUUID()}",
                imagePath = file.absolutePath,
                source = fonte,
                studioSpec = statoAttuale.studioSpec,
                hairEntryId = statoAttuale.hairEntryId,
                beardEntryId = statoAttuale.beardEntryId,
                makeupEntryId = statoAttuale.makeupEntryId,
                outfitItemIds = statoAttuale.outfitPerCategoria.values.toList(),
                createdAtEpochMillis = System.currentTimeMillis(),
            )
            cronologiaCreazioni.aggiungi(risultato)
            _stato.update { it.copy(ultimoRisultato = risultato) }
            _operazione.value = OperazioneUiState.Completata(fonte)
        }
    }

    private fun parametriManichino(s: StyleSessionState): MannequinParams {
        val capelli = s.hairEntryId?.let { id -> catalogoStili.stili.value.find { it.id == id } }?.attributes
        val barba = s.beardEntryId?.let { id -> catalogoStili.stili.value.find { it.id == id } }?.attributes
        val trucco = s.makeupEntryId?.let { id -> catalogoStili.stili.value.find { it.id == id } }?.attributes
        val capi = guardaroba.capi.value
        fun coloreCapo(categoria: GarmentCategory) = s.outfitPerCategoria[categoria]?.let { id -> capi.find { it.id == id } }?.dominantColorHex
        return MannequinParams(
            capelli = capelli,
            barba = barba,
            trucco = trucco,
            coloreTop = coloreCapo(GarmentCategory.TOP),
            colorePantaloni = coloreCapo(GarmentCategory.PANTALONI),
            coloreAbito = coloreCapo(GarmentCategory.ABITO),
            coloreOuterwear = coloreCapo(GarmentCategory.OUTERWEAR),
            coloreScarpe = coloreCapo(GarmentCategory.SCARPE),
            inquadratura = s.studioSpec.framing,
            illuminazione = s.studioSpec.lighting,
            sfondo = s.studioSpec.background,
        )
    }

    private fun messaggioPer(esito: AiOutcome<*>): String = when (esito) {
        is AiOutcome.NonConfigurato -> "Nessun abbonamento IA collegato: vai in Impostazioni per collegarne uno, oppure continua con l'anteprima locale."
        is AiOutcome.ErroreRete -> "Connessione al provider IA non riuscita. Controlla la rete e riprova."
        is AiOutcome.ErroreProvider -> esito.messaggio
        is AiOutcome.Successo -> ""
    }

    class Factory(
        private val appContext: Context,
        private val catalogoStili: StyleCatalogRepository,
        private val guardaroba: WardrobeRepository,
        private val cronologiaCreazioni: GenerationHistoryRepository,
        private val serviziAi: AiServiceFactory,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            StyleSessionViewModel(appContext, catalogoStili, guardaroba, cronologiaCreazioni, serviziAi) as T
    }
}
