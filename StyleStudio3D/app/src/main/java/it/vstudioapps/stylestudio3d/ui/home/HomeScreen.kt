package it.vstudioapps.stylestudio3d.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Checkroom
import androidx.compose.material.icons.filled.ContentCut
import androidx.compose.material.icons.filled.DirectionsWalk
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import it.vstudioapps.stylestudio3d.domain.model.ProfiloStile
import it.vstudioapps.stylestudio3d.ui.AppContainer
import it.vstudioapps.stylestudio3d.ui.components.CategoryButton
import it.vstudioapps.stylestudio3d.ui.navigation.Destinations

private data class VoceHome(val etichetta: String, val icona: ImageVector, val rotta: String)

/**
 * Home: una griglia fissa di pulsanti categoria, tutta visibile senza scorrimento infinito —
 * ogni voce porta a una schermata dedicata, mai a un unico feed che mischia tutto.
 */
@Composable
fun HomeScreen(appContainer: AppContainer, onNavigate: (String) -> Unit) {
    val preferenze by appContainer.preferenzeUtente.preferenze.collectAsState(initial = null)
    val etichettaCapelli = if (preferenze?.profiloStile == ProfiloStile.DONNA) "Capelli" else "Capelli & Barba"

    val voci = listOf(
        VoceHome(etichettaCapelli, Icons.Filled.ContentCut, Destinations.CAPELLI_BARBA),
        VoceHome("Trucco", Icons.Filled.Face, Destinations.TRUCCO),
        VoceHome("Abbigliamento", Icons.Filled.Checkroom, Destinations.ABBIGLIAMENTO),
        VoceHome("Scarpe", Icons.Filled.DirectionsWalk, Destinations.SCARPE),
        VoceHome("Armocromia", Icons.Filled.Palette, Destinations.ARMOCROMIA),
        VoceHome("Figura intera", Icons.Filled.Person, Destinations.FIGURA_INTERA),
        VoceHome("Studio Fotografico", Icons.Filled.PhotoCamera, Destinations.STUDIO_INTRO),
        VoceHome("Impostazioni", Icons.Filled.Settings, Destinations.IMPOSTAZIONI),
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Style Studio 3D") },
                actions = {
                    IconButton(onClick = { onNavigate(Destinations.IMPOSTAZIONI) }) {
                        Icon(Icons.Filled.Settings, contentDescription = "Impostazioni")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    actionIconContentColor = MaterialTheme.colorScheme.onPrimary,
                ),
            )
        },
    ) { padding ->
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            items(voci) { voce ->
                CategoryButton(etichetta = voce.etichetta, icona = voce.icona, onClick = { onNavigate(voce.rotta) })
            }
        }
    }
}
