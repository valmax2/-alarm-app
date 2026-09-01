package it.vstudioapps.runwarestudio

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import it.vstudioapps.runwarestudio.data.export.ExportUtils
import it.vstudioapps.runwarestudio.ui.RunwareStudioApp
import it.vstudioapps.runwarestudio.ui.theme.RunwareStudioTheme
import it.vstudioapps.runwarestudio.ui.viewmodel.ArchiveViewModel
import it.vstudioapps.runwarestudio.ui.viewmodel.GenerationViewModel
import it.vstudioapps.runwarestudio.ui.viewmodel.SettingsViewModel
import java.io.File
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private val generationViewModel by viewModels<GenerationViewModel>()
    private val archiveViewModel by viewModels<ArchiveViewModel>()
    private val settingsViewModel by viewModels<SettingsViewModel>()

    // Bridges the single-shot ActivityResult callbacks below back to the file they were
    // launched for — the launcher contract only hands back a Uri, not any context of its own.
    private var pendingExportFile: File? = null
    private var pendingGallerySave: Pair<File, String>? = null

    private val pickReferenceImages =
        registerForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(4)) { uris ->
            if (uris.isNotEmpty()) generationViewModel.addReferenceImages(uris)
        }

    private val createExportDocument =
        registerForActivityResult(ActivityResultContracts.CreateDocument("image/png")) { uri ->
            val file = pendingExportFile
            pendingExportFile = null
            if (uri != null && file != null) {
                lifecycleScope.launch {
                    runCatching { ExportUtils.writeFileTo(this@MainActivity, file, uri) }
                        .onSuccess {
                            Toast.makeText(this@MainActivity, "Esportato", Toast.LENGTH_SHORT).show()
                        }
                        .onFailure {
                            Toast.makeText(
                                this@MainActivity,
                                "Esportazione non riuscita: ${it.message}",
                                Toast.LENGTH_LONG
                            ).show()
                        }
                }
            }
        }

    private val requestWritePermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            val pending = pendingGallerySave
            pendingGallerySave = null
            if (granted && pending != null) {
                doSaveToGallery(pending.first, pending.second)
            } else if (!granted) {
                Toast.makeText(this, "Permesso negato: impossibile salvare nella Galleria", Toast.LENGTH_LONG).show()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val settings by settingsViewModel.settings.collectAsState()
            RunwareStudioTheme(themeMode = settings.themeMode) {
                RunwareStudioApp(
                    generationViewModel = generationViewModel,
                    archiveViewModel = archiveViewModel,
                    settingsViewModel = settingsViewModel,
                    onPickReferenceImages = {
                        pickReferenceImages.launch(
                            PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                        )
                    },
                    onExportFile = { file, suggestedName ->
                        pendingExportFile = file
                        createExportDocument.launch(suggestedName)
                    },
                    onSaveToGallery = ::requestGallerySave,
                    onShareFile = ::shareFile
                )
            }
        }
    }

    private fun requestGallerySave(file: File, displayName: String) {
        val needsRuntimePermission = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) !=
            PackageManager.PERMISSION_GRANTED
        if (needsRuntimePermission) {
            pendingGallerySave = file to displayName
            requestWritePermission.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE)
        } else {
            doSaveToGallery(file, displayName)
        }
    }

    private fun doSaveToGallery(file: File, displayName: String) {
        lifecycleScope.launch {
            runCatching { ExportUtils.saveToGallery(this@MainActivity, file, displayName) }
                .onSuccess {
                    Toast.makeText(this@MainActivity, "Salvato in Galleria", Toast.LENGTH_SHORT).show()
                }
                .onFailure {
                    Toast.makeText(
                        this@MainActivity,
                        "Salvataggio non riuscito: ${it.message}",
                        Toast.LENGTH_LONG
                    ).show()
                }
        }
    }

    private fun shareFile(file: File) {
        val uri = ExportUtils.contentUriFor(this, file)
        startActivity(Intent.createChooser(ExportUtils.shareIntent(uri), null))
    }
}
