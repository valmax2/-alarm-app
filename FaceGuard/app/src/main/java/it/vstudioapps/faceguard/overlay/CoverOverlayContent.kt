package it.vstudioapps.faceguard.overlay

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BrokenImage
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import it.vstudioapps.faceguard.model.CoverMode
import it.vstudioapps.faceguard.util.loadImageBitmap

/** Full-screen content drawn by the overlay window while the user's face is undetected. */
@Composable
fun CoverOverlayContent(mode: CoverMode, customImageUri: String?) {
    Box(modifier = Modifier.fillMaxSize()) {
        when (mode) {
            CoverMode.BLACK_SCREEN, CoverMode.LOCK_SCREEN -> {
                Box(modifier = Modifier.fillMaxSize().background(Color.Black))
            }

            CoverMode.CUSTOM_IMAGE -> CustomImageCover(customImageUri)
        }
    }
}

@Composable
private fun CustomImageCover(uriString: String?) {
    val context = LocalContext.current
    var bitmap by remember(uriString) { mutableStateOf<ImageBitmap?>(null) }
    var loadFailed by remember(uriString) { mutableStateOf(false) }

    LaunchedEffect(uriString) {
        bitmap = null
        loadFailed = false
        val loaded = uriString?.let { loadImageBitmap(context, it) }
        if (loaded != null) bitmap = loaded else loadFailed = true
    }

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        val current = bitmap
        when {
            current != null -> Image(
                bitmap = current,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
            loadFailed -> Icon(
                imageVector = Icons.Filled.BrokenImage,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.4f),
                modifier = Modifier.align(Alignment.Center).alpha(0.6f)
            )
        }
    }
}
