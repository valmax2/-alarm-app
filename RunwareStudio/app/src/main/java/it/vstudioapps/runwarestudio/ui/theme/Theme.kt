package it.vstudioapps.runwarestudio.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import it.vstudioapps.runwarestudio.model.ThemeMode

private val LightColors = lightColorScheme(
    primary = AmberAccentDark,
    onPrimary = Color.White,
    secondary = VioletAccentDark,
    background = LightBackground,
    onBackground = LightOnBackground,
    surface = LightSurface,
    onSurface = LightOnBackground,
    surfaceVariant = LightSurfaceVariant,
    error = Color(0xFFB3261E)
)

private val DarkColors = darkColorScheme(
    primary = AmberAccent,
    onPrimary = DarkBackground,
    secondary = VioletAccent,
    background = DarkBackground,
    onBackground = DarkOnBackground,
    surface = DarkSurface,
    onSurface = DarkOnBackground,
    surfaceVariant = DarkSurfaceVariant,
    error = Color(0xFFFFB4AB)
)

/** Applies the user's [ThemeMode] choice, falling back to the system setting for [ThemeMode.SYSTEM]. */
@Composable
fun RunwareStudioTheme(themeMode: ThemeMode, content: @Composable () -> Unit) {
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
