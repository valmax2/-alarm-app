package it.vstudioapps.stylestudio3d

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import it.vstudioapps.stylestudio3d.ui.AppContainer
import it.vstudioapps.stylestudio3d.ui.StyleStudioApp
import it.vstudioapps.stylestudio3d.ui.theme.StyleStudio3DTheme

class MainActivity : ComponentActivity() {

    private lateinit var appContainer: AppContainer

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        appContainer = AppContainer(this)
        appContainer.inizializza()

        setContent {
            StyleStudio3DTheme {
                StyleStudioApp(appContainer)
            }
        }
    }

    override fun onDestroy() {
        appContainer.guidaVocale.rilascia()
        super.onDestroy()
    }
}
