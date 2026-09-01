package it.vstudioapps.runwarestudio.model

import it.vstudioapps.runwarestudio.data.ModelCatalog

enum class ThemeMode {
    LIGHT, DARK, SYSTEM;

    companion object {
        val default = SYSTEM
    }
}

/**
 * All persisted, non-secret preferences (see data/settings/SettingsRepository.kt). The
 * Runware API key itself is deliberately NOT here — it lives encrypted-at-rest in
 * SecureKeyStore, kept out of DataStore's plaintext preferences file.
 */
data class AppSettings(
    val themeMode: ThemeMode = ThemeMode.default,
    /** Gates the whole app behind the 18+ / consenting-adults-only screen on first launch. */
    val onboardingCompleted: Boolean = false,
    /** True once the user has explicitly accepted the adult-content terms in Settings. Only
     *  after this is true does Home's NSFW-filter switch become available at all — it does
     *  not by itself turn the filter off. */
    val adultTermsAccepted: Boolean = false,
    val lastSelectedModelId: String = ModelCatalog.default.id
)
