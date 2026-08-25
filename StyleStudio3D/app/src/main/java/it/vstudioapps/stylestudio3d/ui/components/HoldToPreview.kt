package it.vstudioapps.stylestudio3d.ui.components

import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.hoverable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsHoveredAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties

/**
 * Tocco lungo (mobile) o passaggio del mouse (uso su PC/emulatore con puntatore) mostrano
 * un'anteprima ingrandita del contenuto sopra l'elemento, senza aprire una nuova schermata.
 * Usato per capelli, barba, trucco e per i capi del guardaroba.
 */
@Composable
fun HoldToPreview(
    anteprimaGrande: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    contenuto: @Composable () -> Unit,
) {
    var premuto by remember { mutableStateOf(false) }
    val interactionSource = remember { MutableInteractionSource() }
    val inHover by interactionSource.collectIsHoveredAsState()

    Box(
        modifier = modifier
            .hoverable(interactionSource)
            .pointerInput(Unit) {
                detectTapGestures(onPress = {
                    premuto = true
                    try {
                        awaitRelease()
                    } finally {
                        premuto = false
                    }
                })
            },
    ) {
        contenuto()
        if (premuto || inHover) {
            Popup(
                alignment = Alignment.TopCenter,
                offset = IntOffset(0, -280),
                properties = PopupProperties(focusable = false),
            ) {
                Surface(shadowElevation = 12.dp, shape = RoundedCornerShape(20.dp)) {
                    Box(modifier = Modifier.size(200.dp).padding(6.dp)) { anteprimaGrande() }
                }
            }
        }
    }
}
