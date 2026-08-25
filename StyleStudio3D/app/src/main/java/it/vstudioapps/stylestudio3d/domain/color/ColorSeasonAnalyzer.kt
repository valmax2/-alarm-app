package it.vstudioapps.stylestudio3d.domain.color

import it.vstudioapps.stylestudio3d.domain.model.ColorProfileInput
import it.vstudioapps.stylestudio3d.domain.model.ColorSeason
import it.vstudioapps.stylestudio3d.domain.model.Cromia
import it.vstudioapps.stylestudio3d.domain.model.Undertone
import it.vstudioapps.stylestudio3d.domain.model.ValoreChiaroScuro

/**
 * Classificazione in una delle quattro stagioni cromatiche classiche, a partire dalle tre
 * risposte del questionario. E' logica di dominio pura (nessuna dipendenza Android/rete):
 * niente IA esterna, niente foto obbligatoria — funziona sempre, anche offline.
 *
 * Il sottotono decide l'asse caldo/freddo; contrasto e luminosita' decidono se pende verso la
 * variante "chiara/brillante" o "scura/tenue" di quell'asse, seguendo lo schema classico:
 * Primavera = caldo chiaro, Autunno = caldo scuro, Estate = freddo chiaro, Inverno = freddo scuro.
 * Il sottotono neutro viene risolto guardando quale stagione e' piu' vicina su contrasto e valore.
 */
object ColorSeasonAnalyzer {

    fun analyze(input: ColorProfileInput): ColorSeason {
        val warmScore = when (input.undertone) {
            Undertone.CALDO -> 1
            Undertone.FREDDO -> -1
            Undertone.NEUTRO -> 0
        }
        val deepScore = when (input.valore) {
            ValoreChiaroScuro.CHIARO -> -1
            ValoreChiaroScuro.MEDIO -> 0
            ValoreChiaroScuro.SCURO -> 1
        } + when (input.cromia) {
            // Alto contrasto/colori decisi spinge verso le stagioni "profonde" (Autunno/Inverno);
            // colori morbidi spinge verso le stagioni "chiare" (Primavera/Estate).
            Cromia.BRILLANTE -> 1
            Cromia.TENUE -> -1
        }

        val warm = if (warmScore != 0) warmScore > 0 else deepScore <= 0 // neutro: pende calda se il resto e' "leggero"
        val deep = deepScore > 0

        return when {
            warm && !deep -> ColorSeason.PRIMAVERA
            warm && deep -> ColorSeason.AUTUNNO
            !warm && !deep -> ColorSeason.ESTATE
            else -> ColorSeason.INVERNO
        }
    }

    /** Distanza percettiva approssimata tra due colori "#RRGGBB", usata per abbinare il guardaroba alla palette. */
    fun distanza(colorHexA: String, colorHexB: String): Double {
        val (r1, g1, b1) = componentiRgb(colorHexA)
        val (r2, g2, b2) = componentiRgb(colorHexB)
        val dr = r1 - r2
        val dg = g1 - g2
        val db = b1 - b2
        return kotlin.math.sqrt((dr * dr + dg * dg + db * db).toDouble())
    }

    /** true se il colore e' abbastanza vicino ad almeno un colore della palette della stagione. */
    fun corrisponde(colorHex: String, stagione: ColorSeason, sogliaMax: Double = 90.0): Boolean =
        stagione.paletteHex.any { distanza(colorHex, it) <= sogliaMax }

    private fun componentiRgb(hex: String): Triple<Int, Int, Int> {
        val clean = hex.removePrefix("#").let { if (it.length == 8) it.substring(2) else it }
        return try {
            val value = clean.padStart(6, '0').toLong(16)
            Triple((value shr 16 and 0xFF).toInt(), (value shr 8 and 0xFF).toInt(), (value and 0xFF).toInt())
        } catch (e: NumberFormatException) {
            Triple(0, 0, 0)
        }
    }
}

/** Utility per l'estrazione del colore dominante da una foto (vedi util/ImageIo.kt per l'uso reale). */
fun rgbToHex(r: Int, g: Int, b: Int): String =
    "#%02X%02X%02X".format(r.coerceIn(0, 255), g.coerceIn(0, 255), b.coerceIn(0, 255))
