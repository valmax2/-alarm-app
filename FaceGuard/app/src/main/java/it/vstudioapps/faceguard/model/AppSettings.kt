package it.vstudioapps.faceguard.model

/** Snapshot of every user-configurable preference, persisted via [SettingsRepository]. */
data class AppSettings(
    val themeMode: ThemeMode = ThemeMode.default,
    val coverMode: CoverMode = CoverMode.default,
    val absenceThresholdSeconds: Int = DEFAULT_THRESHOLD_SECONDS,
    val customImageUri: String? = null,
    val monitoringEnabled: Boolean = false
) {
    companion object {
        const val DEFAULT_THRESHOLD_SECONDS = 10
        const val MIN_THRESHOLD_SECONDS = 3
        const val MAX_THRESHOLD_SECONDS = 60

        /** Keeps a user-entered threshold within the range the Settings slider allows. */
        fun clampThresholdSeconds(seconds: Int): Int =
            seconds.coerceIn(MIN_THRESHOLD_SECONDS, MAX_THRESHOLD_SECONDS)
    }
}
