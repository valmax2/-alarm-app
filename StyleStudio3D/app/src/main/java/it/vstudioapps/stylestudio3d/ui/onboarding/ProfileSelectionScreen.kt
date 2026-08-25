package it.vstudioapps.stylestudio3d.ui.onboarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import it.vstudioapps.stylestudio3d.domain.model.ProfiloStile
import it.vstudioapps.stylestudio3d.ui.theme.BronzoCaldo
import it.vstudioapps.stylestudio3d.ui.theme.VioletGrafite

/**
 * Primo passo, prima ancora del tutorial: decide quali categorie di stile mostrare (con "Donna"
 * niente barba/baffi, ne' in Home ne' nel catalogo). Cambiabile in qualsiasi momento dalle
 * Impostazioni, quindi nessuna scelta qui e' definitiva.
 */
@Composable
fun ProfileSelectionScreen(onScelto: (ProfiloStile) -> Unit) {
    Scaffold { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                "Per iniziare",
                style = MaterialTheme.typography.headlineMedium,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                "Scegli come vuoi vedere il catalogo di stili: puoi cambiarlo quando vuoi dalle Impostazioni.",
                style = MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 32.dp),
            )
            ProfiloStile.entries.forEach { profilo ->
                VoceProfilo(profilo, onClick = { onScelto(profilo) })
                Spacer(modifier = Modifier.height(14.dp))
            }
        }
    }
}

@Composable
private fun VoceProfilo(profilo: ProfiloStile, onClick: () -> Unit) {
    val evidenziato = profilo != ProfiloStile.TUTTI
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().height(72.dp),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = if (evidenziato) VioletGrafite else MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(
                profilo.etichetta,
                style = MaterialTheme.typography.titleLarge,
                color = if (evidenziato) BronzoCaldo else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
