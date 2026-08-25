package it.vstudioapps.faceguard.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import it.vstudioapps.faceguard.BuildConfig
import it.vstudioapps.faceguard.R
import it.vstudioapps.faceguard.model.AppSettings
import it.vstudioapps.faceguard.model.CoverMode
import it.vstudioapps.faceguard.model.ThemeMode
import it.vstudioapps.faceguard.service.PresenceUiState
import it.vstudioapps.faceguard.ui.screens.MonitorScreen
import it.vstudioapps.faceguard.ui.screens.SettingsScreen
import it.vstudioapps.faceguard.ui.theme.FaceGuardTheme

/** Root composable: applies the chosen theme and switches between the Monitor and Settings tabs. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FaceGuardApp(
    settings: AppSettings,
    permissions: PermissionsState,
    presenceState: PresenceUiState,
    onRequestCameraPermission: () -> Unit,
    onRequestNotificationsPermission: () -> Unit,
    onRequestOverlayPermission: () -> Unit,
    onRequestDeviceAdmin: () -> Unit,
    onRevokeDeviceAdmin: () -> Unit,
    onPickCustomImage: () -> Unit,
    onThemeModeChange: (ThemeMode) -> Unit,
    onCoverModeChange: (CoverMode) -> Unit,
    onThresholdChange: (Int) -> Unit,
    onToggleMonitoring: (Boolean) -> Unit
) {
    FaceGuardTheme(themeMode = settings.themeMode) {
        Surface(modifier = Modifier.fillMaxSize()) {
            var selectedTab by remember { mutableIntStateOf(0) }
            val tabTitles = listOf("Monitor", "Impostazioni")

            Scaffold(
                topBar = {
                    TopAppBar(title = { Text(stringResource(R.string.app_name)) })
                }
            ) { padding ->
                Column(modifier = Modifier.padding(padding).fillMaxSize()) {
                    TabRow(selectedTabIndex = selectedTab) {
                        tabTitles.forEachIndexed { index, title ->
                            Tab(
                                selected = selectedTab == index,
                                onClick = { selectedTab = index },
                                text = { Text(title) }
                            )
                        }
                    }

                    when (selectedTab) {
                        0 -> MonitorScreen(
                            settings = settings,
                            permissions = permissions,
                            presenceState = presenceState,
                            buildInfo = "Build ${BuildConfig.GIT_SHA}",
                            onRequestCameraPermission = onRequestCameraPermission,
                            onRequestNotificationsPermission = onRequestNotificationsPermission,
                            onRequestOverlayPermission = onRequestOverlayPermission,
                            onRequestDeviceAdmin = onRequestDeviceAdmin,
                            onRevokeDeviceAdmin = onRevokeDeviceAdmin,
                            onToggleMonitoring = onToggleMonitoring
                        )
                        else -> SettingsScreen(
                            settings = settings,
                            onThemeModeChange = onThemeModeChange,
                            onCoverModeChange = onCoverModeChange,
                            onThresholdChange = onThresholdChange,
                            onPickCustomImage = onPickCustomImage
                        )
                    }
                }
            }
        }
    }
}
