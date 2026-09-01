package it.vstudioapps.runwarestudio.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.SaveAlt
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import java.io.File

/**
 * Grid of one job's result images, each with its own Salva/Esporta/Condividi row — used on
 * both Home (right after a generation) and JobDetailScreen (reopening an archived job), both
 * of which render this inside their own vertically-scrolling Column.
 *
 * Deliberately a plain Column-of-Rows, not LazyVerticalGrid: a lazy grid measures itself with
 * an unbounded height when nested inside another vertical scroll, which Compose disallows and
 * crashes on (IllegalStateException: "Vertically scrollable component was measured with an
 * infinity maximum height"). numberResults is capped at 4 (see GenerationViewModel), so there's
 * no real list to virtualize anyway — a non-lazy layout sidesteps the whole problem.
 */
@Composable
fun ResultImageGrid(
    resultPaths: List<String>,
    onSave: (File) -> Unit,
    onExport: (File) -> Unit,
    onShare: (File) -> Unit,
    modifier: Modifier = Modifier
) {
    val columns = if (resultPaths.size > 1) 2 else 1
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        resultPaths.chunked(columns).forEach { rowPaths ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                rowPaths.forEach { path -> ResultImageCell(path, onSave, onExport, onShare, Modifier.weight(1f)) }
                // Pads out a shorter last row (e.g. 3 results in 2 columns) so the final cell
                // keeps the same width as the ones above it instead of stretching to fill.
                repeat(columns - rowPaths.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun ResultImageCell(
    path: String,
    onSave: (File) -> Unit,
    onExport: (File) -> Unit,
    onShare: (File) -> Unit,
    modifier: Modifier = Modifier
) {
    val file = File(path)
    Column(modifier = modifier) {
        Surface(shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth()) {
            AsyncImage(
                model = file,
                contentDescription = null,
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
                    .clip(RoundedCornerShape(16.dp))
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            IconButton(onClick = { onSave(file) }) {
                Icon(Icons.Filled.SaveAlt, contentDescription = "Salva in Galleria")
            }
            IconButton(onClick = { onExport(file) }) {
                Icon(Icons.Filled.Download, contentDescription = "Esporta")
            }
            IconButton(onClick = { onShare(file) }) {
                Icon(Icons.Filled.Share, contentDescription = "Condividi")
            }
        }
    }
}
