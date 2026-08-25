package it.vstudioapps.stylestudio3d.tts

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Locale

/**
 * Guida vocale del tutorial. Usa il motore TextToSpeech di sistema ma sceglie esplicitamente,
 * tra le voci italiane disponibili, quella di qualita' piu' alta ([Voice.getQuality]) e non
 * "solo su rete" mancante: le voci ad alta qualita' dei motori moderni (es. Google TTS) suonano
 * naturali, non robotiche come la voce compatta di riserva. Se il dispositivo non ha voci di
 * qualita', ricade sulla voce predefinita del motore installato: la narrazione resta comunque
 * disponibile, solo meno naturale — limite del dispositivo, non dell'app.
 */
class NarratedGuide(context: Context) {

    private val appContext = context.applicationContext
    private var tts: TextToSpeech? = null

    private val _pronto = MutableStateFlow(false)
    val pronto: StateFlow<Boolean> = _pronto.asStateFlow()

    private val _inRiproduzione = MutableStateFlow(false)
    val inRiproduzione: StateFlow<Boolean> = _inRiproduzione.asStateFlow()

    fun inizializza() {
        tts = TextToSpeech(appContext) { esito ->
            if (esito == TextToSpeech.SUCCESS) {
                scegliVoceNaturale()
                tts?.setSpeechRate(0.98f)
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) { _inRiproduzione.value = true }
                    override fun onDone(utteranceId: String?) { _inRiproduzione.value = false }
                    @Deprecated("richiesto dall'interfaccia di sistema")
                    override fun onError(utteranceId: String?) { _inRiproduzione.value = false }
                })
                _pronto.value = true
            }
        }
    }

    private fun scegliVoceNaturale() {
        val motore = tts ?: return
        motore.language = Locale.ITALIAN
        val voceMigliore = motore.voices
            ?.filter { it.locale.language == Locale.ITALIAN.language && !it.features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) }
            ?.maxByOrNull { it.quality }
        if (voceMigliore != null && voceMigliore.quality >= Voice.QUALITY_NORMAL) {
            motore.voice = voceMigliore
        }
    }

    fun parla(testo: String, idUtterance: String, accoda: Boolean = false) {
        tts?.speak(testo, if (accoda) TextToSpeech.QUEUE_ADD else TextToSpeech.QUEUE_FLUSH, null, idUtterance)
    }

    fun ferma() {
        tts?.stop()
        _inRiproduzione.value = false
    }

    fun rilascia() {
        tts?.shutdown()
        tts = null
        _pronto.value = false
    }
}
