package it.vstudioapps.faceguard.service

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Whether the monitoring service is running, and what it last saw. */
enum class ServiceRunState { STOPPED, STARTING, RUNNING, CAMERA_ERROR, NOT_ENROLLED }

data class PresenceUiState(
    val runState: ServiceRunState = ServiceRunState.STOPPED,
    /** True only when the camera sees a face that matches the enrolled owner's signature. */
    val ownerRecognized: Boolean = false,
    /** True when a face is visible but it doesn't match the owner — a different signal from "no one there". */
    val strangerDetected: Boolean = false,
    val absentSinceMillis: Long? = null,
    val coverActive: Boolean = false
)

/**
 * Process-wide status the [PresenceMonitorService] publishes and the UI collects.
 *
 * The service and the Activity always run in the same process, so a plain in-memory
 * [MutableStateFlow] is enough here — no need for a bound-service/AIDL round trip just to
 * mirror a handful of read-only fields into the UI.
 */
object PresenceStatusBus {
    private val _state = MutableStateFlow(PresenceUiState())
    val state = _state.asStateFlow()

    fun update(transform: (PresenceUiState) -> PresenceUiState) {
        _state.value = transform(_state.value)
    }

    fun reset() {
        _state.value = PresenceUiState()
    }
}
