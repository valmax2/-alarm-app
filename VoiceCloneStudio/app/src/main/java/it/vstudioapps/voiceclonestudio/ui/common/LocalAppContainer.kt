package it.vstudioapps.voiceclonestudio.ui.common

import androidx.compose.runtime.staticCompositionLocalOf
import it.vstudioapps.voiceclonestudio.data.AppContainer

val LocalAppContainer = staticCompositionLocalOf<AppContainer> {
    error("AppContainer non fornito: avvolgi la UI con CompositionLocalProvider(LocalAppContainer provides ...)")
}
