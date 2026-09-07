package it.vstudioapps.voiceclonestudio.audio

import android.media.MediaPlayer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.io.File

/** Riproduce un file audio locale (campione registrato o clip generato), esponendo lo stato per la UI Compose. */
class AudioPlayer {

    private var mediaPlayer: MediaPlayer? = null

    private val _playingPath = MutableStateFlow<String?>(null)
    /** Percorso del file attualmente in riproduzione, o null se nulla sta suonando. */
    val playingPath: StateFlow<String?> = _playingPath

    fun play(file: File, onCompleted: () -> Unit = {}) {
        stop()
        runCatching {
            MediaPlayer().apply {
                setDataSource(file.absolutePath)
                setOnCompletionListener {
                    _playingPath.value = null
                    release()
                    onCompleted()
                }
                setOnErrorListener { _, _, _ ->
                    _playingPath.value = null
                    true
                }
                prepare()
                start()
            }
        }.onSuccess { player ->
            mediaPlayer = player
            _playingPath.value = file.absolutePath
        }
        // Un file audio danneggiato o mancante lascia semplicemente lo stato "non in riproduzione"
        // invece di far crashare l'app: chi ha chiamato play() lo vede da playingPath.
    }

    fun stop() {
        mediaPlayer?.let {
            runCatching { it.stop() }
            it.release()
        }
        mediaPlayer = null
        _playingPath.value = null
    }

    fun isPlaying(file: File): Boolean = _playingPath.value == file.absolutePath

    fun release() = stop()
}
