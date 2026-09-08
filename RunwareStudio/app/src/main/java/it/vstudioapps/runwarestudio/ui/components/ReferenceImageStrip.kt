package it.vstudioapps.runwarestudio.ui.components

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddAPhoto
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage

/** Horizontal strip of picked "foto del personaggio" used to steer generation toward a
 *  consistent look/face, plus the "+" tile to add more (capped at 4 — see GenerationViewModel). */
@Composable
fun ReferenceImageStrip(
    images: List<Uri>,
    onAdd: () -> Unit,
    onRemove: (Uri) -> Unit
) {
    Column {
        Text(
            "Foto di riferimento del personaggio (opzionale)",
            style = MaterialTheme.typography.labelLarge
        )
        Text(
            "Aiutano il modello a mantenere lo stesso volto/aspetto tra più immagini.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(top = 8.dp)
        ) {
            items(images, key = { it.toString() }) { uri ->
                Box(modifier = Modifier.size(84.dp)) {
                    AsyncImage(
                        model = uri,
                        contentDescription = null,
                        modifier = Modifier
                            .size(84.dp)
                            .clip(RoundedCornerShape(12.dp))
                    )
                    Box(
                        modifier = Modifier
                            .size(22.dp)
                            .align(Alignment.TopEnd)
                            .clip(CircleShape)
                            .background(Color.Black.copy(alpha = 0.6f))
                            .clickable { onRemove(uri) },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Filled.Close,
                            contentDescription = "Rimuovi",
                            tint = Color.White,
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }
            }
            if (images.size < 4) {
                item {
                    Box(
                        modifier = Modifier
                            .size(84.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                            .clickable(onClick = onAdd),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Filled.AddAPhoto, contentDescription = "Aggiungi foto")
                    }
                }
            }
        }
    }
}
