package it.vstudioapps.runwarestudio.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import it.vstudioapps.runwarestudio.model.ArchiveJob
import it.vstudioapps.runwarestudio.ui.screens.ArchiveScreen
import it.vstudioapps.runwarestudio.ui.screens.ConsentScreen
import it.vstudioapps.runwarestudio.ui.screens.HomeScreen
import it.vstudioapps.runwarestudio.ui.screens.JobDetailScreen
import it.vstudioapps.runwarestudio.ui.screens.SettingsScreen
import it.vstudioapps.runwarestudio.ui.viewmodel.ArchiveViewModel
import it.vstudioapps.runwarestudio.ui.viewmodel.GenerationViewModel
import it.vstudioapps.runwarestudio.ui.viewmodel.SettingsViewModel
import java.io.File

private object Routes {
    const val HOME = "home"
    const val ARCHIVE = "archive"
    const val SETTINGS = "settings"
    const val JOB_DETAIL = "job/{id}"
    const val JOB_ID_ARG = "id"
    fun jobDetail(id: Long) = "job/$id"
}

private data class BottomTab(val route: String, val label: String, val icon: ImageVector)

private val bottomTabs = listOf(
    BottomTab(Routes.HOME, "Genera", Icons.Filled.AutoAwesome),
    BottomTab(Routes.ARCHIVE, "Archivio", Icons.Filled.PhotoLibrary),
    BottomTab(Routes.SETTINGS, "Impostazioni", Icons.Filled.Settings)
)

/**
 * App root: a hard 18+/consent gate in front of everything else (see ConsentScreen), then a
 * three-tab NavHost (Genera / Archivio / Impostazioni) plus the job-detail screen pushed on
 * top from the archive. The three ViewModels are created once in MainActivity and threaded
 * through here so switching tabs never loses in-progress state (a draft prompt, an in-flight
 * generation) the way a per-destination ViewModel scope would.
 */
@Composable
fun RunwareStudioApp(
    generationViewModel: GenerationViewModel,
    archiveViewModel: ArchiveViewModel,
    settingsViewModel: SettingsViewModel,
    onPickReferenceImages: () -> Unit,
    onExportFile: (File, String) -> Unit,
    onSaveToGallery: (File, String) -> Unit,
    onShareFile: (File) -> Unit
) {
    val settings by settingsViewModel.settings.collectAsState()

    if (!settings.onboardingCompleted) {
        ConsentScreen(
            onAccept = {
                // Accepting the gate also grants the adult-content terms: Home's NSFW-filter
                // toggle then just works, instead of forcing a second confirmation.
                settingsViewModel.setOnboardingCompleted(true)
                settingsViewModel.setAdultTermsAccepted(true)
            }
        )
        return
    }

    val navController = rememberNavController()

    Scaffold(
        bottomBar = {
            val backStackEntry by navController.currentBackStackEntryAsState()
            val currentDestination = backStackEntry?.destination
            // The job-detail screen is pushed full-screen (no bottom bar) so results stay
            // uncluttered; it's reachable only from the Archivio tab's own list.
            val onDetailScreen = currentDestination?.route == Routes.JOB_DETAIL
            if (!onDetailScreen) {
                NavigationBar {
                    bottomTabs.forEach { tab ->
                        val selected = currentDestination?.hierarchy?.any { it.route == tab.route } == true
                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                navController.navigate(tab.route) {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(tab.icon, contentDescription = tab.label) },
                            label = { Text(tab.label) }
                        )
                    }
                }
            }
        }
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Routes.HOME,
            modifier = Modifier.padding(padding)
        ) {
            composable(Routes.HOME) {
                HomeScreen(
                    viewModel = generationViewModel,
                    adultTermsAccepted = settings.adultTermsAccepted,
                    onPickReferenceImages = onPickReferenceImages,
                    onExportFile = onExportFile,
                    onSaveToGallery = onSaveToGallery,
                    onShareFile = onShareFile,
                    onOpenSettings = {
                        navController.navigate(Routes.SETTINGS) { launchSingleTop = true }
                    }
                )
            }
            composable(Routes.ARCHIVE) {
                ArchiveScreen(
                    viewModel = archiveViewModel,
                    onOpenJob = { job: ArchiveJob -> navController.navigate(Routes.jobDetail(job.id)) }
                )
            }
            composable(Routes.SETTINGS) {
                SettingsScreen(viewModel = settingsViewModel)
            }
            composable(
                route = Routes.JOB_DETAIL,
                arguments = listOf(navArgument(Routes.JOB_ID_ARG) { type = NavType.LongType })
            ) { backStackEntry ->
                val jobId = backStackEntry.arguments?.getLong(Routes.JOB_ID_ARG) ?: -1L
                JobDetailScreen(
                    jobId = jobId,
                    archiveViewModel = archiveViewModel,
                    onBack = { navController.popBackStack() },
                    onExportFile = onExportFile,
                    onSaveToGallery = onSaveToGallery,
                    onShareFile = onShareFile,
                    onReuse = { job ->
                        generationViewModel.loadFromArchiveJob(job)
                        navController.navigate(Routes.HOME) {
                            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                            launchSingleTop = true
                        }
                    }
                )
            }
        }
    }
}
