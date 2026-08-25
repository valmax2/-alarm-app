package it.vstudioapps.stylestudio3d.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import it.vstudioapps.stylestudio3d.domain.model.GarmentCategory
import it.vstudioapps.stylestudio3d.ui.colorAnalysis.ColorAnalysisScreen
import it.vstudioapps.stylestudio3d.ui.figure.FullBodyViewerScreen
import it.vstudioapps.stylestudio3d.ui.hair.HairAndBeardScreen
import it.vstudioapps.stylestudio3d.ui.home.HomeScreen
import it.vstudioapps.stylestudio3d.ui.makeup.MakeupScreen
import it.vstudioapps.stylestudio3d.ui.navigation.Destinations
import it.vstudioapps.stylestudio3d.ui.onboarding.OnboardingScreen
import it.vstudioapps.stylestudio3d.ui.result.ResultScreen
import it.vstudioapps.stylestudio3d.ui.session.StyleSessionViewModel
import it.vstudioapps.stylestudio3d.ui.settings.SettingsScreen
import it.vstudioapps.stylestudio3d.ui.studio.PhotoStudioScreen
import it.vstudioapps.stylestudio3d.ui.wardrobe.WardrobeScreen
import kotlinx.coroutines.flow.distinctUntilChangedBy
import kotlinx.coroutines.launch

@Composable
fun StyleStudioApp(appContainer: AppContainer) {
    val navController = rememberNavController()
    val preferenze by appContainer.preferenzeUtente.preferenze
        .distinctUntilChangedBy { it.onboardingCompletato }
        .collectAsState(initial = null)

    val sessionViewModel: StyleSessionViewModel = viewModel(
        factory = remember {
            StyleSessionViewModel.Factory(
                appContext = appContainer.appContext,
                catalogoStili = appContainer.catalogoStili,
                guardaroba = appContainer.guardaroba,
                cronologiaCreazioni = appContainer.cronologiaCreazioni,
                serviziAi = appContainer.serviziAi,
            )
        },
    )

    // Aspetta di conoscere lo stato di onboarding prima di scegliere la rotta iniziale, per non
    // mostrare per un istante la Home a chi non ha ancora completato il tutorial.
    val statoNoto = preferenze ?: return
    val partenza = if (statoNoto.onboardingCompletato) Destinations.HOME else Destinations.ONBOARDING

    NavHost(navController = navController, startDestination = partenza) {
        composable(Destinations.ONBOARDING) {
            OnboardingScreen(
                guidaVocale = appContainer.guidaVocale,
                onCompletato = {
                    appContainer.scopeApp.launch { appContainer.preferenzeUtente.setOnboardingCompletato(true) }
                    navController.navigateSingolo(Destinations.HOME)
                },
            )
        }
        composable(Destinations.HOME) {
            HomeScreen(onNavigate = { rotta -> navController.navigate(rotta) })
        }
        composable(Destinations.CAPELLI_BARBA) {
            HairAndBeardScreen(appContainer, sessionViewModel, onIndietro = { navController.popBackStack() })
        }
        composable(Destinations.TRUCCO) {
            MakeupScreen(appContainer, sessionViewModel, onIndietro = { navController.popBackStack() })
        }
        composable(Destinations.ABBIGLIAMENTO) {
            WardrobeScreen(
                appContainer, sessionViewModel,
                categorie = listOf(GarmentCategory.TOP, GarmentCategory.PANTALONI, GarmentCategory.ABITO, GarmentCategory.OUTERWEAR),
                titolo = "Abbigliamento",
                onIndietro = { navController.popBackStack() },
            )
        }
        composable(Destinations.SCARPE) {
            WardrobeScreen(
                appContainer, sessionViewModel,
                categorie = listOf(GarmentCategory.SCARPE),
                titolo = "Scarpe",
                onIndietro = { navController.popBackStack() },
            )
        }
        composable(Destinations.ARMOCROMIA) {
            ColorAnalysisScreen(appContainer, sessionViewModel, onIndietro = { navController.popBackStack() })
        }
        composable(Destinations.FIGURA_INTERA) {
            FullBodyViewerScreen(
                sessionViewModel,
                onIndietro = { navController.popBackStack() },
                onProsegui = { navController.navigate(Destinations.STUDIO_FOTOGRAFICO) },
            )
        }
        composable(Destinations.STUDIO_FOTOGRAFICO) {
            PhotoStudioScreen(
                sessionViewModel,
                onIndietro = { navController.popBackStack() },
                onScattoGenerato = { navController.navigateSingolo(Destinations.RISULTATO) },
            )
        }
        composable(Destinations.RISULTATO) {
            ResultScreen(appContainer, sessionViewModel, onChiudi = { navController.popBackStack(Destinations.HOME, inclusive = false) })
        }
        composable(Destinations.IMPOSTAZIONI) {
            SettingsScreen(appContainer, onIndietro = { navController.popBackStack() }, onRivediTutorial = { navController.navigate(Destinations.ONBOARDING) })
        }
    }
}

private fun NavHostController.navigateSingolo(rotta: String) {
    navigate(rotta) { popUpTo(graph.startDestinationId) { inclusive = true } }
}
