package it.vstudioapps.stylestudio3d.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.core.content.FileProvider
import it.vstudioapps.stylestudio3d.domain.color.rgbToHex
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

/**
 * Operazioni comuni su immagini/file. Decodifica tramite `BitmapFactory` + `ContentResolver`
 * (invece di `ImageDecoder`, disponibile solo da API 28) per restare compatibile con il
 * minSdk 26 dell'app senza duplicare i percorsi di decodifica.
 */
object ImageIo {

    /** Copia il contenuto di un Uri (tipicamente dal Photo Picker) in un file privato dell'app. */
    fun copiaUriInStorageInterno(context: Context, uri: Uri, cartella: File, estensione: String = "jpg"): File? {
        cartella.mkdirs()
        val destinazione = File(cartella, "${UUID.randomUUID()}.$estensione")
        return try {
            context.contentResolver.openInputStream(uri)?.use { input ->
                FileOutputStream(destinazione).use { output -> input.copyTo(output) }
            }
            if (destinazione.exists() && destinazione.length() > 0) destinazione else null
        } catch (e: java.io.IOException) {
            null
        }
    }

    fun decodificaBitmapDaUri(context: Context, uri: Uri, latoMaxPx: Int = 1600): Bitmap? = try {
        context.contentResolver.openInputStream(uri)?.use { input -> BitmapFactory.decodeStream(input) }
            ?.let { ridimensionaSeNecessario(it, latoMaxPx) }
    } catch (e: java.io.IOException) {
        null
    }

    fun decodificaBitmapDaFile(percorso: String, latoMaxPx: Int = 1600): Bitmap? =
        BitmapFactory.decodeFile(percorso)?.let { ridimensionaSeNecessario(it, latoMaxPx) }

    private fun ridimensionaSeNecessario(bitmap: Bitmap, latoMaxPx: Int): Bitmap {
        val latoMax = maxOf(bitmap.width, bitmap.height)
        if (latoMax <= latoMaxPx) return bitmap
        val scala = latoMaxPx.toFloat() / latoMax
        val nuovaLarghezza = (bitmap.width * scala).toInt().coerceAtLeast(1)
        val nuovaAltezza = (bitmap.height * scala).toInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(bitmap, nuovaLarghezza, nuovaAltezza, true)
    }

    /** Media dei pixel di una versione molto ridotta della foto: colore dominante approssimato, usato per l'armocromia. */
    fun coloreDominante(bitmap: Bitmap): String {
        val campione = Bitmap.createScaledBitmap(bitmap, 12, 12, true)
        var r = 0L
        var g = 0L
        var b = 0L
        var conteggio = 0
        for (x in 0 until campione.width) {
            for (y in 0 until campione.height) {
                val pixel = campione.getPixel(x, y)
                r += (pixel shr 16) and 0xFF
                g += (pixel shr 8) and 0xFF
                b += pixel and 0xFF
                conteggio++
            }
        }
        if (campione !== bitmap) campione.recycle()
        if (conteggio == 0) return "#808080"
        return rgbToHex((r / conteggio).toInt(), (g / conteggio).toInt(), (b / conteggio).toInt())
    }

    fun salvaBitmapInCache(context: Context, bitmap: Bitmap, sottocartella: String): File {
        val cartella = File(context.cacheDir, sottocartella).apply { mkdirs() }
        val destinazione = File(cartella, "${UUID.randomUUID()}.png")
        FileOutputStream(destinazione).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        return destinazione
    }

    fun uriCondivisibile(context: Context, file: File): Uri =
        FileProvider.getUriForFile(context, "${context.packageName}.share", file)
}
