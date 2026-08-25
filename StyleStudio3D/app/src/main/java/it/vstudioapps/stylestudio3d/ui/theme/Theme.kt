package it.vstudioapps.stylestudio3d.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val ColorSchemeChiaro = lightColorScheme(
    primary = VioletGrafite,
    onPrimary = CremaSfondo,
    secondary = BronzoCaldo,
    onSecondary = GrigioTesto,
    background = CremaSfondo,
    onBackground = GrigioTesto,
    surface = Color(0xFFFFFFFF),
    onSurface = GrigioTesto,
    error = ErroreRosso,
)

private val ColorSchemeScuro = darkColorScheme(
    primary = BronzoCaldo,
    onPrimary = VioletGrafite,
    secondary = BronzoCaldoScuro,
    onSecondary = CremaSfondo,
    background = VioletGrafite,
    onBackground = CremaSfondo,
    surface = VioletGrafiteChiaro,
    onSurface = CremaSfondo,
    error = ErroreRosso,
)

@Composable
fun StyleStudio3DTheme(usaTemaScuro: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (usaTemaScuro) ColorSchemeScuro else ColorSchemeChiaro,
        typography = MaterialTheme.typography,
        content = content,
    )
}
