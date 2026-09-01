package it.vstudioapps.runwarestudio.data.translate

import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine

/**
 * On-device Italian -> English translation via ML Kit: the Italian prompt never has to leave
 * the phone just to be translated — only the already-translated English text is what gets
 * sent to Runware. The small language model downloads once on first use (needs network) and
 * is then cached locally by ML Kit for every later translation, offline.
 */
class PromptTranslator {

    private val translator: Translator = Translation.getClient(
        TranslatorOptions.Builder()
            .setSourceLanguage(TranslateLanguage.ITALIAN)
            .setTargetLanguage(TranslateLanguage.ENGLISH)
            .build()
    )

    suspend fun ensureModelReady(allowMeteredNetwork: Boolean = true): Result<Unit> = runCatching {
        val conditions = DownloadConditions.Builder()
            .apply { if (!allowMeteredNetwork) requireWifi() }
            .build()
        suspendCancellableCoroutine { cont ->
            translator.downloadModelIfNeeded(conditions)
                .addOnSuccessListener { cont.resume(Unit) }
                .addOnFailureListener { cont.resumeWithException(it) }
        }
    }

    suspend fun translate(italianText: String): Result<String> {
        if (italianText.isBlank()) return Result.success("")
        return runCatching {
            ensureModelReady().getOrThrow()
            suspendCancellableCoroutine { cont ->
                translator.translate(italianText)
                    .addOnSuccessListener { cont.resume(it) }
                    .addOnFailureListener { cont.resumeWithException(it) }
            }
        }
    }

    /** Call from onCleared()/onDestroy of whatever owns this — releases the native translator. */
    fun close() {
        translator.close()
    }
}
