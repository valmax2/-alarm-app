package it.vstudioapps.voiceclonestudio.data

import android.content.Context
import it.vstudioapps.voiceclonestudio.audio.AudioPlayer
import it.vstudioapps.voiceclonestudio.audio.AudioRecorder

/**
 * Contenitore manuale delle dipendenze condivise dall'app (niente Hilt: coerente con le altre
 * app di questo repository). Un'unica istanza per processo, creata da [it.vstudioapps.voiceclonestudio.VoiceCloneApplication].
 */
class AppContainer(context: Context) {
    val apiKeyStore = ApiKeyStore(context)
    val settingsRepository = SettingsRepository(context)
    val historyRepository = HistoryRepository(context)
    val elevenLabsApi = ElevenLabsApi()
    // Un solo player condiviso: far partire un clip ferma automaticamente quello precedente,
    // così non si sovrappongono mai due audio in riproduzione nell'app.
    val audioPlayer = AudioPlayer()
    val audioRecorder = AudioRecorder(context)
}
