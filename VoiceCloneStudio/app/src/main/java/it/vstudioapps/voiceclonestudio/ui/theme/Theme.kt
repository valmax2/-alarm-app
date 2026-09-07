package it.vstudioapps.voiceclonestudio.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = VioletAccentDark,
    onPrimary = Color.White,
    secondary = CoralRecordingDark,
    background = LightBackground,
    onBackground = LightOnBackground,
    surface = LightSurface,
    onSurface = LightOnBackground,
    surfaceVariant = LightSurfaceVariant,
    error = CoralRecordingDark
)

private val DarkColors = darkColorScheme(
    primary = VioletAccent,
    onPrimary = DarkBackground,
    secondary = CoralRecording,
    background = DarkBackground,
    onBackground = DarkOnBackground,
    surface = DarkSurface,
    onSurface = DarkOnBackground,
    surfaceVariant = DarkSurfaceVariant,
    error = CoralRecording
)

@Composable
fun VoiceCloneStudioTheme(content: @Composable () -> Unit) {
    val colors = if (isSystemInDarkTheme()) DarkColors else LightColors
    MaterialTheme(colorScheme = colors, content = content)
}
