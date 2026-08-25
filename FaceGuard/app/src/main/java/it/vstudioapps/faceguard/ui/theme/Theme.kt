package it.vstudioapps.faceguard.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import it.vstudioapps.faceguard.model.ThemeMode

private val LightColors = lightColorScheme(
    primary = CyanAccentDark,
    onPrimary = Color.White,
    secondary = AmberWarningDark,
    background = LightBackground,
    onBackground = LightOnBackground,
    surface = LightSurface,
    onSurface = LightOnBackground,
    surfaceVariant = LightSurfaceVariant,
    error = AmberWarningDark
)

private val DarkColors = darkColorScheme(
    primary = CyanAccent,
    onPrimary = DarkBackground,
    secondary = AmberWarning,
    background = DarkBackground,
    onBackground = DarkOnBackground,
    surface = DarkSurface,
    onSurface = DarkOnBackground,
    surfaceVariant = DarkSurfaceVariant,
    error = AmberWarning
)

/** Applies the user's [ThemeMode] choice, falling back to the system setting for [ThemeMode.SYSTEM]. */
@Composable
fun FaceGuardTheme(themeMode: ThemeMode, content: @Composable () -> Unit) {
    val useDark = when (themeMode) {
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
    }

    MaterialTheme(
        colorScheme = if (useDark) DarkColors else LightColors,
        content = content
    )
}
