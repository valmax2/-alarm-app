package it.vstudioapps.voiceclonestudio.ui.common

import android.app.Activity
import android.content.Intent
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import it.vstudioapps.voiceclonestudio.R
import java.util.Locale

/**
 * Pulsante "microfono" che apre il riconoscimento vocale di sistema in italiano e aggiunge il
 * testo dettato a [currentText]. Usa [RecognizerIntent.ACTION_RECOGNIZE_SPEECH] (l'app di
 * dettatura di Google), non [SpeechRecognizer] diretto: così non serve chiedere il permesso
 * RECORD_AUDIO alla nostra app — lo gestisce l'app di dettatura con il proprio.
 */
@Composable
fun MicDictationButton(
    currentText: String,
    onTextChanged: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val unavailableMessage = stringResource(R.string.dictation_unavailable)

    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val spoken = result.data
                ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
                ?.firstOrNull()
            if (!spoken.isNullOrBlank()) {
                val combined = if (currentText.isBlank()) spoken else "$currentText $spoken"
                onTextChanged(combined.trim())
            }
        }
    }

    IconButton(
        modifier = modifier,
        onClick = {
            if (!SpeechRecognizer.isRecognitionAvailable(context)) {
                Toast.makeText(context, unavailableMessage, Toast.LENGTH_LONG).show()
                return@IconButton
            }
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.ITALY.toString())
                putExtra(RecognizerIntent.EXTRA_PROMPT, context.getString(R.string.dictation_prompt))
            }
            runCatching { launcher.launch(intent) }
                .onFailure { Toast.makeText(context, unavailableMessage, Toast.LENGTH_LONG).show() }
        }
    ) {
        Icon(Icons.Filled.Mic, contentDescription = stringResource(R.string.dictation_content_description))
    }
}
