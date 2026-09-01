package it.vstudioapps.runwarestudio.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
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

/** Grid of one job's result images, each with its own Salva/Esporta/Condividi row — used on
 *  both Home (right after a generation) and JobDetailScreen (reopening an archived job). */
@Composable
fun ResultImageGrid(
    resultPaths: List<String>,
    onSave: (File) -> Unit,
    onExport: (File) -> Unit,
    onShare: (File) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(if (resultPaths.size > 1) 2 else 1),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        modifier = modifier
    ) {
        items(resultPaths) { path ->
            val file = File(path)
            Column {
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
    }
}
