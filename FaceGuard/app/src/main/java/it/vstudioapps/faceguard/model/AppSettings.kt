package it.vstudioapps.faceguard.model

/** Snapshot of every user-configurable preference, persisted via [SettingsRepository]. */
data class AppSettings(
    val themeMode: ThemeMode = ThemeMode.default,
    val coverMode: CoverMode = CoverMode.default,
    val absenceThresholdSeconds: Int = DEFAULT_THRESHOLD_SECONDS,
    val customImageUri: String? = null,
    val monitoringEnabled: Boolean = false,
    /** Geometric signature of the device owner's face (see [FaceSignature]); null = not enrolled. */
    val ownerFaceSignature: FaceSignature? = null,
    /**
     * Cached mirror of BillingRepository's entitlement check, refreshed whenever the Activity
     * observes it change. Read by [it.vstudioapps.faceguard.service.PresenceMonitorService] to
     * enforce the Pro gate at the moment a cover mode actually engages — not just at selection
     * time in Settings — so a lapsed entitlement (e.g. a refund) can't leave a Pro-only cover
     * mode still active.
     */
    val isPro: Boolean = false
) {
    companion object {
        const val DEFAULT_THRESHOLD_SECONDS = 10

        // 0 is allowed on purpose: some users want the cover to engage the instant their face
        // is gone, with no grace period at all.
        const val MIN_THRESHOLD_SECONDS = 0
        const val MAX_THRESHOLD_SECONDS = 60

        /** Keeps a user-entered threshold within the range the Settings slider allows. */
        fun clampThresholdSeconds(seconds: Int): Int =
            seconds.coerceIn(MIN_THRESHOLD_SECONDS, MAX_THRESHOLD_SECONDS)
    }
}
