package it.vstudioapps.stylestudio3d.domain.color

import it.vstudioapps.stylestudio3d.domain.model.ColorProfileInput
import it.vstudioapps.stylestudio3d.domain.model.ColorSeason
import it.vstudioapps.stylestudio3d.domain.model.Cromia
import it.vstudioapps.stylestudio3d.domain.model.Undertone
import it.vstudioapps.stylestudio3d.domain.model.ValoreChiaroScuro
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ColorSeasonAnalyzerTest {

    @Test
    fun `sottotono caldo chiaro e tenue da Primavera`() {
        val esito = ColorSeasonAnalyzer.analyze(ColorProfileInput(Undertone.CALDO, ValoreChiaroScuro.CHIARO, Cromia.TENUE))
        assertEquals(ColorSeason.PRIMAVERA, esito)
    }

    @Test
    fun `sottotono caldo scuro e brillante da Autunno`() {
        val esito = ColorSeasonAnalyzer.analyze(ColorProfileInput(Undertone.CALDO, ValoreChiaroScuro.SCURO, Cromia.BRILLANTE))
        assertEquals(ColorSeason.AUTUNNO, esito)
    }

    @Test
    fun `sottotono freddo chiaro e tenue da Estate`() {
        val esito = ColorSeasonAnalyzer.analyze(ColorProfileInput(Undertone.FREDDO, ValoreChiaroScuro.CHIARO, Cromia.TENUE))
        assertEquals(ColorSeason.ESTATE, esito)
    }

    @Test
    fun `sottotono freddo scuro e brillante da Inverno`() {
        val esito = ColorSeasonAnalyzer.analyze(ColorProfileInput(Undertone.FREDDO, ValoreChiaroScuro.SCURO, Cromia.BRILLANTE))
        assertEquals(ColorSeason.INVERNO, esito)
    }

    @Test
    fun `distanza tra lo stesso colore e zero`() {
        assertEquals(0.0, ColorSeasonAnalyzer.distanza("#FF7F50", "#FF7F50"), 0.0001)
    }

    @Test
    fun `un colore della palette corrisponde alla propria stagione`() {
        val primoColore = ColorSeason.PRIMAVERA.paletteHex.first()
        assertTrue(ColorSeasonAnalyzer.corrisponde(primoColore, ColorSeason.PRIMAVERA))
    }

    @Test
    fun `nero puro non corrisponde alla palette chiara di Primavera`() {
        assertFalse(ColorSeasonAnalyzer.corrisponde("#000000", ColorSeason.PRIMAVERA, sogliaMax = 40.0))
    }

    @Test
    fun `esadecimale non valido non fa fallire il confronto`() {
        // Non deve lanciare eccezioni: ricade su nero e produce comunque una distanza finita.
        val distanza = ColorSeasonAnalyzer.distanza("non-un-colore", "#FFFFFF")
        assertTrue(distanza > 0)
    }
}
