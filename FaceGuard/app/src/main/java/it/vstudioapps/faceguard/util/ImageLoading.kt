package it.vstudioapps.faceguard.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Decodes a content:// or file:// URI into an [ImageBitmap], used both by the Settings
 * preview and by the full-screen "custom image" cover. Returns null on any failure (revoked
 * permission, deleted file, unsupported format) so callers can fall back gracefully.
 */
suspend fun loadImageBitmap(context: Context, uriString: String): ImageBitmap? =
    withContext(Dispatchers.IO) {
        runCatching {
            val uri = Uri.parse(uriString)
            val bitmap: Bitmap = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                ImageDecoder.decodeBitmap(ImageDecoder.createSource(context.contentResolver, uri)) { decoder, _, _ ->
                    decoder.isMutableRequired = false
                }
            } else {
                @Suppress("DEPRECATION")
                MediaStore.Images.Media.getBitmap(context.contentResolver, uri)
            }
            bitmap.asImageBitmap()
        }.getOrNull()
    }
