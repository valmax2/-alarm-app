package it.vstudioapps.faceguard.model

/** The app's own light/dark selection, independent of the device's system setting. */
enum class ThemeMode {
    LIGHT,
    DARK,
    SYSTEM;

    companion object {
        val default = SYSTEM
    }
}
