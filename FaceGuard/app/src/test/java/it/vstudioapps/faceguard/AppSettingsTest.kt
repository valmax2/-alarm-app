package it.vstudioapps.faceguard

import it.vstudioapps.faceguard.model.AppSettings
import org.junit.Assert.assertEquals
import org.junit.Test

class AppSettingsTest {

    @Test
    fun `clamp keeps values already inside the allowed range unchanged`() {
        assertEquals(10, AppSettings.clampThresholdSeconds(10))
        assertEquals(AppSettings.MIN_THRESHOLD_SECONDS, AppSettings.clampThresholdSeconds(AppSettings.MIN_THRESHOLD_SECONDS))
        assertEquals(AppSettings.MAX_THRESHOLD_SECONDS, AppSettings.clampThresholdSeconds(AppSettings.MAX_THRESHOLD_SECONDS))
    }

    @Test
    fun `clamp raises values below the minimum`() {
        assertEquals(AppSettings.MIN_THRESHOLD_SECONDS, AppSettings.clampThresholdSeconds(0))
        assertEquals(AppSettings.MIN_THRESHOLD_SECONDS, AppSettings.clampThresholdSeconds(-5))
    }

    @Test
    fun `clamp lowers values above the maximum`() {
        assertEquals(AppSettings.MAX_THRESHOLD_SECONDS, AppSettings.clampThresholdSeconds(1000))
    }
}
