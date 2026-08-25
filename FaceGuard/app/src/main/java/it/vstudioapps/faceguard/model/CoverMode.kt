package it.vstudioapps.faceguard.model

/**
 * The three cover behaviours the user can choose between when their face goes undetected.
 */
enum class CoverMode {
    /** Shows a full-screen image the user picked, drawn over every other app. */
    CUSTOM_IMAGE,

    /** Blacks out the display, drawn over every other app. */
    BLACK_SCREEN,

    /** Immediately locks the device, requiring the system's secure unlock to resume. */
    LOCK_SCREEN;

    companion object {
        val default = BLACK_SCREEN
    }
}
