package it.vstudioapps.voiceclonestudio.ui.common

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import it.vstudioapps.voiceclonestudio.data.GeneratedClip
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val dateFormat = SimpleDateFormat("d MMM, HH:mm", Locale.ITALIAN)

@Composable
fun ClipHistoryList(
    clips: List<GeneratedClip>,
    isPlaying: (GeneratedClip) -> Boolean,
    onTogglePlay: (GeneratedClip) -> Unit,
    onShare: (GeneratedClip) -> Unit,
    onDelete: (GeneratedClip) -> Unit,
    modifier: Modifier = Modifier
) {
    if (clips.isEmpty()) return

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Cronologia", style = MaterialTheme.typography.titleMedium)
        clips.forEach { clip ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            clip.sourceLabel.take(80),
                            style = MaterialTheme.typography.bodyMedium,
                            maxLines = 2
                        )
                        Text(
                            "${clip.voiceName} · ${dateFormat.format(Date(clip.createdAtEpochMillis))}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    IconButton(onClick = { onTogglePlay(clip) }) {
                        Icon(
                            if (isPlaying(clip)) Icons.Filled.Stop else Icons.Filled.PlayArrow,
                            contentDescription = if (isPlaying(clip)) "Ferma" else "Riproduci"
                        )
                    }
                    IconButton(onClick = { onShare(clip) }) {
                        Icon(Icons.Filled.Share, contentDescription = "Condividi")
                    }
                    IconButton(onClick = { onDelete(clip) }) {
                        Icon(Icons.Filled.Delete, contentDescription = "Elimina", tint = MaterialTheme.colorScheme.error)
                    }
                }
            }
        }
    }
}
