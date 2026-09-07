package it.vstudioapps.voiceclonestudio

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.CompositionLocalProvider
import it.vstudioapps.voiceclonestudio.ui.AppRoot
import it.vstudioapps.voiceclonestudio.ui.common.LocalAppContainer
import it.vstudioapps.voiceclonestudio.ui.theme.VoiceCloneStudioTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val container = (application as VoiceCloneApplication).container

        setContent {
            CompositionLocalProvider(LocalAppContainer provides container) {
                VoiceCloneStudioTheme {
                    AppRoot()
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        (application as VoiceCloneApplication).container.audioPlayer.release()
    }
}
