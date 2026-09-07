package it.vstudioapps.voiceclonestudio.audio

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import java.io.File
import java.io.IOException

/**
 * Registra un campione audio (voce dell'utente) in formato M4A/AAC, accettato da ElevenLabs
 * sia per la clonazione della voce sia come sorgente per la conversione voce→voce.
 */
class AudioRecorder(private val context: Context) {

    private var recorder: MediaRecorder? = null
    private var outputFile: File? = null

    /** true se una registrazione è in corso. */
    val isRecording: Boolean get() = recorder != null

    /** Avvia la registrazione in un nuovo file dentro la cache dell'app. Ritorna il file di destinazione. */
    fun start(targetDir: File): File {
        stop() // sicurezza: non lasciare mai due registrazioni sovrapposte

        targetDir.mkdirs()
        val file = File(targetDir, "sample_${System.currentTimeMillis()}.m4a")

        @Suppress("DEPRECATION")
        val newRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(context)
        } else {
            MediaRecorder()
        }

        try {
            newRecorder.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioEncodingBitRate(128_000)
                setAudioSamplingRate(44_100)
                setOutputFile(file.absolutePath)
                prepare()
                start()
            }
        } catch (e: IOException) {
            newRecorder.release()
            throw e
        }

        recorder = newRecorder
        outputFile = file
        return file
    }

    /** Ferma la registrazione in corso. Ritorna il file registrato, o null se non stava registrando. */
    fun stop(): File? {
        val current = recorder ?: return null
        return try {
            current.stop()
            outputFile
        } catch (e: RuntimeException) {
            // stop() lancia se la registrazione è durissima cortissima (nessun dato scritto):
            // in quel caso il file va scartato, non trattato come un clip valido.
            outputFile?.delete()
            null
        } finally {
            current.release()
            recorder = null
            outputFile = null
        }
    }

    /** Annulla la registrazione in corso e cancella il file parziale. */
    fun cancel() {
        val current = recorder ?: return
        try {
            current.stop()
        } catch (e: RuntimeException) {
            // ignorato: stavamo comunque per buttare via il file
        } finally {
            current.release()
            recorder = null
            outputFile?.delete()
            outputFile = null
        }
    }
}
