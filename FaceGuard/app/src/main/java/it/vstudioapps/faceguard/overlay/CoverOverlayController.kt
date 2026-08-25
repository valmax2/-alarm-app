package it.vstudioapps.faceguard.overlay

import android.content.Context
import android.graphics.PixelFormat
import android.provider.Settings
import android.view.WindowManager
import androidx.compose.ui.platform.ComposeView
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.lifecycle.setViewTreeViewModelStoreOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import it.vstudioapps.faceguard.model.CoverMode

/**
 * Owns the single full-screen [ComposeView] drawn over every other app via
 * [WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY] while the user's face is undetected.
 *
 * Requires the SYSTEM_ALERT_WINDOW special permission ([Settings.canDrawOverlays]); callers
 * must check that before calling [show].
 */
class CoverOverlayController(private val appContext: Context) {

    private val windowManager = appContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var overlayView: ComposeView? = null
    private var lifecycleOwner: OverlayLifecycleOwner? = null

    val isShowing: Boolean get() = overlayView != null

    fun show(mode: CoverMode, customImageUri: String?) {
        if (!Settings.canDrawOverlays(appContext)) return
        if (overlayView != null) return

        val owner = OverlayLifecycleOwner().also { it.onCreate() }
        lifecycleOwner = owner

        val view = ComposeView(appContext).apply {
            setViewTreeLifecycleOwner(owner)
            setViewTreeViewModelStoreOwner(owner)
            setViewTreeSavedStateRegistryOwner(owner)
            setContent { CoverOverlayContent(mode = mode, customImageUri = customImageUri) }
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_FULLSCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
            PixelFormat.OPAQUE
        )

        runCatching { windowManager.addView(view, params) }
            .onSuccess { overlayView = view }
            .onFailure {
                owner.onDestroy()
                lifecycleOwner = null
            }
    }

    fun hide() {
        val view = overlayView ?: return
        runCatching { windowManager.removeView(view) }
        overlayView = null
        lifecycleOwner?.onDestroy()
        lifecycleOwner = null
    }
}
