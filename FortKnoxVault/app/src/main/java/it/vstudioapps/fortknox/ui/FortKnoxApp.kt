package it.vstudioapps.fortknox.ui

import android.content.Intent
import android.graphics.BitmapFactory
import android.text.format.Formatter
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Image as ImageIcon
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import it.vstudioapps.fortknox.data.VaultRepository
import it.vstudioapps.fortknox.model.VaultFolder
import it.vstudioapps.fortknox.model.VaultItem
import it.vstudioapps.fortknox.model.VaultSnapshot
import it.vstudioapps.fortknox.security.AuthStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.security.SecureRandom
import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

private val SteelBlack = Color(0xFF090B0D)
private val Steel = Color(0xFF1B2024)
private val SteelLight = Color(0xFF343B40)
private val Brass = Color(0xFFD0A83A)
private val Silver = Color(0xFFD8DEE2)
private val Danger = Color(0xFFE26D68)

private enum class Screen { LOCK, HOME, SETTINGS }

@Composable
fun FortKnoxApp(
    authStore: AuthStore,
    repository: VaultRepository,
    requestBiometric: ((Boolean, String?) -> Unit) -> Unit
) {
    MaterialTheme(
        colorScheme = androidx.compose.material3.darkColorScheme(
            primary = Brass,
            onPrimary = SteelBlack,
            secondary = Silver,
            background = SteelBlack,
            surface = Steel,
            surfaceVariant = SteelLight,
            error = Danger
        )
    ) {
        var configured by remember { mutableStateOf(authStore.isConfigured) }
        var unlocked by rememberSaveable { mutableStateOf(false) }
        var screen by rememberSaveable { mutableStateOf(Screen.LOCK) }
        val lifecycleOwner = LocalLifecycleOwner.current

        DisposableEffect(lifecycleOwner) {
            val observer = LifecycleEventObserver { _, event ->
                if (event == Lifecycle.Event.ON_STOP && unlocked) {
                    unlocked = false
                    screen = Screen.LOCK
                }
            }
            lifecycleOwner.lifecycle.addObserver(observer)
            onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
        }

        Surface(Modifier.fillMaxSize(), color = SteelBlack) {
            when {
                !configured -> SetupScreen {
                    authStore.configure(it.first.toCharArray(), it.second.toCharArray())
                    configured = true
                }
                !unlocked -> UnlockScreen(
                    authStore = authStore,
                    requestBiometric = requestBiometric,
                    onUnlocked = {
                        unlocked = true
                        screen = Screen.HOME
                    }
                )
                else -> AnimatedContent(targetState = screen, label = "vault_navigation") { target ->
                    when (target) {
                        Screen.HOME -> VaultHome(
                            repository = repository,
                            onSettings = { screen = Screen.SETTINGS },
                            onLock = {
                                unlocked = false
                                screen = Screen.LOCK
                            }
                        )
                        Screen.SETTINGS -> SettingsScreen(
                            authStore = authStore,
                            onBack = { screen = Screen.HOME },
                            onLock = {
                                unlocked = false
                                screen = Screen.LOCK
                            }
                        )
                        Screen.LOCK -> Unit
                    }
                }
            }
        }
    }
}

@Composable
private fun SetupScreen(onComplete: (Pair<String, String>) -> Unit) {
    var secret by rememberSaveable { mutableStateOf("") }
    var confirm by rememberSaveable { mutableStateOf("") }
    val recovery = remember {
        val alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        List(4) {
            (1..4).map { alphabet[SecureRandom().nextInt(alphabet.length)] }.joinToString("")
        }.joinToString("-")
    }
    var savedRecovery by rememberSaveable { mutableStateOf(false) }
    val valid = secret.length >= 6 && secret == confirm && savedRecovery

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(Steel, SteelBlack)))
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Spacer(Modifier.height(18.dp))
            Icon(Icons.Default.Lock, null, tint = Brass, modifier = Modifier.size(48.dp))
            Text(
                "Configura la cassaforte",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                "Crea una combinazione o password di almeno 6 caratteri. Non viene mai salvata in chiaro.",
                color = Silver.copy(alpha = .78f)
            )
        }
        item {
            OutlinedTextField(
                value = secret,
                onValueChange = { secret = it.take(64) },
                label = { Text("Codice principale") },
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
        }
        item {
            OutlinedTextField(
                value = confirm,
                onValueChange = { confirm = it.take(64) },
                label = { Text("Conferma codice") },
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Brass.copy(alpha = .12f))) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("CODICE DI RECUPERO OFFLINE", color = Brass, fontWeight = FontWeight.Bold)
                    Text(recovery, fontSize = 20.sp, letterSpacing = 1.4.sp)
                    Text(
                        "Copialo su carta e conservalo fuori dal telefono. Consente di cambiare il codice principale.",
                        color = Silver.copy(alpha = .78f)
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = savedRecovery, onCheckedChange = { savedRecovery = it })
                        Text("Ho conservato il codice in un posto sicuro")
                    }
                }
            }
        }
        item {
            Button(
                onClick = { onComplete(secret to recovery) },
                enabled = valid,
                modifier = Modifier.fillMaxWidth().height(54.dp)
            ) {
                Text("CREA CASSAFORTE", fontWeight = FontWeight.Bold)
            }
        }
        item {
            Text(
                "Attenzione: disinstallando l’app si perdono i file locali. Il backup cifrato verrà aggiunto nella versione Play Store.",
                color = Danger.copy(alpha = .9f),
                style = MaterialTheme.typography.bodySmall
            )
        }
    }
}

@Composable
private fun UnlockScreen(
    authStore: AuthStore,
    requestBiometric: ((Boolean, String?) -> Unit) -> Unit,
    onUnlocked: () -> Unit
) {
    var entered by rememberSaveable { mutableStateOf("") }
    var error by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedDigit by remember { mutableIntStateOf(0) }
    var recoveryMode by rememberSaveable { mutableStateOf(false) }
    var recoveryCode by rememberSaveable { mutableStateOf("") }
    var newCode by rememberSaveable { mutableStateOf("") }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.radialGradient(listOf(SteelLight, SteelBlack), radius = 1100f))
            .padding(20.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Spacer(Modifier.height(24.dp))
                Text("FORT KNOX", color = Silver, letterSpacing = 5.sp, fontWeight = FontWeight.Bold)
                Text("PRIVATE VAULT", color = Brass, fontSize = 12.sp, letterSpacing = 3.sp)
            }

            if (authStore.dialEnabled && !recoveryMode) {
                CombinationDial(
                    onDigitChanged = { selectedDigit = it },
                    modifier = Modifier.size(292.dp)
                )
            } else {
                Icon(Icons.Default.Lock, null, tint = Silver, modifier = Modifier.size(96.dp))
            }

            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (!recoveryMode) {
                    Text(
                        if (entered.isEmpty()) "Ruota la ghiera e conferma ogni numero"
                        else "•".repeat(entered.length),
                        color = Silver,
                        letterSpacing = 4.sp
                    )
                    if (authStore.dialEnabled) {
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            OutlinedButton(onClick = { if (entered.isNotEmpty()) entered = entered.dropLast(1) }) {
                                Text("ANNULLA")
                            }
                            Button(onClick = { if (entered.length < 64) entered += selectedDigit }) {
                                Text("CONFERMA $selectedDigit")
                            }
                        }
                    }
                    if (authStore.pinEnabled || authStore.passwordEnabled) {
                        OutlinedTextField(
                            value = entered,
                            onValueChange = { entered = it.take(64) },
                            label = { Text("PIN o password") },
                            visualTransformation = PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(
                                keyboardType = if (authStore.passwordEnabled) {
                                    KeyboardType.Password
                                } else {
                                    KeyboardType.NumberPassword
                                }
                            ),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                    Button(
                        onClick = {
                            if (authStore.lockoutRemainingSeconds > 0) {
                                error = "Troppi tentativi. Riprova tra ${authStore.lockoutRemainingSeconds} secondi"
                            } else if (authStore.verify(entered.toCharArray())) onUnlocked()
                            else {
                                entered = ""
                                error = if (authStore.lockoutRemainingSeconds > 0) {
                                    "Troppi tentativi. Attendi ${authStore.lockoutRemainingSeconds} secondi"
                                } else {
                                    "Combinazione non corretta"
                                }
                            }
                        },
                        enabled = entered.length >= 4,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("SBLOCCA")
                    }
                    if (authStore.biometricEnabled) {
                        OutlinedButton(
                            onClick = {
                                requestBiometric { success, message ->
                                    if (success) onUnlocked() else error = message
                                }
                            },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Default.Fingerprint, null)
                            Spacer(Modifier.width(8.dp))
                            Text("IMPRONTA O VOLTO")
                        }
                    }
                    TextButton(onClick = { recoveryMode = true; error = null }) {
                        Text("Ho dimenticato il codice")
                    }
                } else {
                    Text("Recupero offline", style = MaterialTheme.typography.titleLarge)
                    OutlinedTextField(
                        value = recoveryCode,
                        onValueChange = { recoveryCode = it.uppercase().take(19) },
                        label = { Text("Codice di recupero") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = newCode,
                        onValueChange = { newCode = it.take(64) },
                        label = { Text("Nuovo codice (minimo 6)") },
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Button(
                        onClick = {
                            if (newCode.length >= 6 && authStore.verifyRecovery(recoveryCode.toCharArray())) {
                                authStore.replaceSecretAfterRecovery(newCode.toCharArray())
                                recoveryMode = false
                                recoveryCode = ""
                                newCode = ""
                                error = "Codice aggiornato. Ora puoi entrare."
                            } else error = "Codice di recupero non valido"
                        },
                        enabled = recoveryCode.length >= 16 && newCode.length >= 6,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("CAMBIA CODICE")
                    }
                    TextButton(onClick = { recoveryMode = false; error = null }) {
                        Text("Torna alla cassaforte")
                    }
                }
                AnimatedVisibility(error != null) {
                    Text(error.orEmpty(), color = if (error?.startsWith("Codice aggiornato") == true) Brass else Danger)
                }
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}

@Composable
private fun CombinationDial(
    onDigitChanged: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    var rotation by remember { mutableStateOf(0f) }
    var lastAngle by remember { mutableStateOf<Float?>(null) }
    val animatedRotation by animateFloatAsState(rotation, label = "dial_rotation")
    val haptic = LocalHapticFeedback.current
    var previousDigit by remember { mutableIntStateOf(0) }

    fun digitFor(angle: Float): Int = ((-angle / 36f).roundToInt().mod(10))

    Box(
        modifier = modifier
            .clip(CircleShape)
            .background(Color(0xFF15191C))
            .border(7.dp, Brush.linearGradient(listOf(Silver, SteelLight, Silver)), CircleShape)
            .pointerInput(Unit) {
                detectDragGestures(
                    onDragStart = { offset ->
                        val center = Offset(size.width / 2f, size.height / 2f)
                        lastAngle = Math.toDegrees(
                            atan2(
                                (offset.y - center.y).toDouble(),
                                (offset.x - center.x).toDouble()
                            )
                        ).toFloat()
                    },
                    onDragEnd = {
                        rotation = (rotation / 36f).roundToInt() * 36f
                        lastAngle = null
                    }
                ) { change, _ ->
                    val center = Offset(size.width / 2f, size.height / 2f)
                    val angle = Math.toDegrees(
                        atan2(
                            (change.position.y - center.y).toDouble(),
                            (change.position.x - center.x).toDouble()
                        )
                    ).toFloat()
                    lastAngle?.let { previous ->
                        var delta = angle - previous
                        if (delta > 180f) delta -= 360f
                        if (delta < -180f) delta += 360f
                        rotation += delta
                        val digit = digitFor(rotation)
                        if (digit != previousDigit) {
                            previousDigit = digit
                            onDigitChanged(digit)
                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        }
                    }
                    lastAngle = angle
                    change.consume()
                }
            },
        contentAlignment = Alignment.Center
    ) {
        Canvas(Modifier.fillMaxSize().padding(13.dp)) {
            val radius = size.minDimension / 2f
            val center = this.center
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(Color(0xFFEBEEF0), Color(0xFF70777B), Color(0xFF202529)),
                    center = center,
                    radius = radius
                )
            )
            drawCircle(Color(0xFF101315), radius * .63f, style = Stroke(radius * .06f))
            drawCircle(Color(0xFF252B2F), radius * .50f)

            for (tick in 0 until 100) {
                val angle = ((tick * 3.6f + animatedRotation - 90f) / 180f * PI).toFloat()
                val outer = radius * .92f
                val inner = radius * if (tick % 10 == 0) .78f else .84f
                drawLine(
                    color = Color(0xFF121416),
                    start = Offset(center.x + cos(angle) * inner, center.y + sin(angle) * inner),
                    end = Offset(center.x + cos(angle) * outer, center.y + sin(angle) * outer),
                    strokeWidth = if (tick % 10 == 0) 5f else 2f,
                    cap = StrokeCap.Round
                )
            }

            val paint = android.graphics.Paint().apply {
                color = android.graphics.Color.rgb(20, 22, 23)
                textAlign = android.graphics.Paint.Align.CENTER
                textSize = radius * .16f
                typeface = android.graphics.Typeface.create(
                    android.graphics.Typeface.SANS_SERIF,
                    android.graphics.Typeface.BOLD
                )
            }
            for (number in 0..9) {
                val angle = ((number * 36f + animatedRotation - 90f) / 180f * PI).toFloat()
                val r = radius * .69f
                drawContext.canvas.nativeCanvas.drawText(
                    number.toString(),
                    center.x + cos(angle) * r,
                    center.y + sin(angle) * r + paint.textSize * .35f,
                    paint
                )
            }
            drawCircle(
                brush = Brush.radialGradient(
                    listOf(Color(0xFF555D62), Color(0xFF171B1E)),
                    center,
                    radius * .4f
                ),
                radius = radius * .38f
            )
            drawLine(
                Brass,
                Offset(center.x, center.y - radius * .34f),
                Offset(center.x, center.y - radius * .18f),
                8f
            )
        }
        Box(
            Modifier
                .align(Alignment.TopCenter)
                .padding(top = 2.dp)
                .size(width = 18.dp, height = 14.dp)
                .background(Danger, RoundedCornerShape(bottomStart = 8.dp, bottomEnd = 8.dp))
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun VaultHome(
    repository: VaultRepository,
    onSettings: () -> Unit,
    onLock: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }
    var snapshot by remember { mutableStateOf<VaultSnapshot?>(null) }
    var selectedFolder by remember { mutableStateOf<VaultFolder?>(null) }
    var newFolderDialog by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var selectedItem by remember { mutableStateOf<VaultItem?>(null) }
    var previewItem by remember { mutableStateOf<VaultItem?>(null) }
    var sharePassword by remember { mutableStateOf("") }
    var protectedPackageUri by remember { mutableStateOf<android.net.Uri?>(null) }
    var protectedPackagePassword by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        snapshot = withContext(Dispatchers.IO) { repository.snapshot() }
    }

    val picker = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenMultipleDocuments()
    ) { uris ->
        val folder = selectedFolder ?: return@rememberLauncherForActivityResult
        if (uris.isNotEmpty()) {
            scope.launch {
                busy = true
                val result = withContext(Dispatchers.IO) {
                    repository.importUris(uris, folder.id)
                }
                snapshot = withContext(Dispatchers.IO) { repository.snapshot() }
                busy = false
                val removal = if (result.originalsDeleted == result.imported) {
                    "Originali rimossi."
                } else {
                    "Rimossi ${result.originalsDeleted}/${result.imported} originali: elimina manualmente quelli protetti dal provider."
                }
                snackbar.showSnackbar("Importati ${result.imported}. $removal")
            }
        }
    }

    val protectedPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        protectedPackageUri = uri
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        containerColor = SteelBlack,
        topBar = {
            TopAppBar(
                title = {
                    Text(selectedFolder?.name ?: "La mia cassaforte", fontWeight = FontWeight.Bold)
                },
                navigationIcon = {
                    if (selectedFolder != null) {
                        IconButton(onClick = { selectedFolder = null }) {
                            Icon(Icons.Default.ArrowBack, "Indietro")
                        }
                    }
                },
                actions = {
                    if (selectedFolder != null) {
                        IconButton(onClick = { protectedPicker.launch(arrayOf("application/octet-stream", "*/*")) }) {
                            Icon(Icons.Default.LockOpen, "Importa pacchetto protetto")
                        }
                    }
                    IconButton(onClick = onLock) { Icon(Icons.Default.Lock, "Blocca") }
                    IconButton(onClick = onSettings) { Icon(Icons.Default.Settings, "Impostazioni") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Steel)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    if (selectedFolder == null) newFolderDialog = true else picker.launch(arrayOf("*/*"))
                },
                containerColor = Brass
            ) {
                Icon(if (selectedFolder == null) Icons.Default.Add else Icons.Default.UploadFile, null)
            }
        }
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                snapshot == null || busy -> CircularProgressIndicator(Modifier.align(Alignment.Center))
                selectedFolder == null -> FolderGrid(
                    snapshot = snapshot!!,
                    onSelect = { selectedFolder = it }
                )
                else -> ItemList(
                    items = snapshot!!.items.filter { it.folderId == selectedFolder!!.id },
                    onPreview = { previewItem = it },
                    onShare = { selectedItem = it },
                    onDelete = { item ->
                        scope.launch {
                            snapshot = withContext(Dispatchers.IO) { repository.deleteItem(item) }
                            snackbar.showSnackbar("File eliminato definitivamente")
                        }
                    }
                )
            }
        }
    }

    if (newFolderDialog) {
        TextEntryDialog(
            title = "Nuova cartella",
            label = "Nome cartella",
            confirm = "CREA",
            minLength = 1,
            onDismiss = { newFolderDialog = false },
            onConfirm = { name ->
                scope.launch {
                    snapshot = withContext(Dispatchers.IO) { repository.addFolder(name) }
                    newFolderDialog = false
                }
            }
        )
    }

    selectedItem?.let { item ->
        AlertDialog(
            onDismissRequest = {
                selectedItem = null
                sharePassword = ""
            },
            title = { Text("Condivisione protetta") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "Verrà creato un pacchetto .vsafe cifrato. Comunica la password separatamente al destinatario."
                    )
                    OutlinedTextField(
                        value = sharePassword,
                        onValueChange = { sharePassword = it.take(64) },
                        label = { Text("Password (minimo 6 caratteri)") },
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true
                    )
                }
            },
            confirmButton = {
                Button(
                    enabled = sharePassword.length >= 6,
                    onClick = {
                        scope.launch {
                            val file = withContext(Dispatchers.IO) {
                                repository.createProtectedPackage(item, sharePassword.toCharArray())
                            }
                            val uri = FileProvider.getUriForFile(
                                context,
                                "${context.packageName}.share",
                                file
                            )
                            context.startActivity(
                                Intent.createChooser(
                                    Intent(Intent.ACTION_SEND).apply {
                                        type = "application/octet-stream"
                                        putExtra(Intent.EXTRA_STREAM, uri)
                                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                    },
                                    "Condividi pacchetto cifrato"
                                )
                            )
                            selectedItem = null
                            sharePassword = ""
                        }
                    }
                ) { Text("CONDIVIDI") }
            },
            dismissButton = {
                TextButton(onClick = { selectedItem = null; sharePassword = "" }) {
                    Text("ANNULLA")
                }
            }
        )
    }

    protectedPackageUri?.let { uri ->
        AlertDialog(
            onDismissRequest = {
                protectedPackageUri = null
                protectedPackagePassword = ""
            },
            title = { Text("Apri pacchetto protetto") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Inserisci la password ricevuta dal mittente.")
                    OutlinedTextField(
                        value = protectedPackagePassword,
                        onValueChange = { protectedPackagePassword = it.take(64) },
                        label = { Text("Password del pacchetto") },
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true
                    )
                }
            },
            confirmButton = {
                Button(
                    enabled = protectedPackagePassword.length >= 6,
                    onClick = {
                        val folder = selectedFolder ?: return@Button
                        scope.launch {
                            busy = true
                            runCatching {
                                withContext(Dispatchers.IO) {
                                    repository.importProtectedPackage(
                                        uri,
                                        protectedPackagePassword.toCharArray(),
                                        folder.id
                                    )
                                }
                            }.onSuccess {
                                snapshot = it
                                protectedPackageUri = null
                                protectedPackagePassword = ""
                                snackbar.showSnackbar("Pacchetto decifrato e importato")
                            }.onFailure {
                                snackbar.showSnackbar(it.message ?: "Importazione non riuscita")
                            }
                            busy = false
                        }
                    }
                ) { Text("IMPORTA") }
            },
            dismissButton = {
                TextButton(onClick = {
                    protectedPackageUri = null
                    protectedPackagePassword = ""
                }) { Text("ANNULLA") }
            }
        )
    }

    previewItem?.let { item ->
        PreviewDialog(
            item = item,
            loadBytes = { repository.decryptBytes(item) },
            onDismiss = { previewItem = null }
        )
    }
}

@Composable
private fun FolderGrid(snapshot: VaultSnapshot, onSelect: (VaultFolder) -> Unit) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Brass.copy(alpha = .10f))) {
                Row(
                    Modifier.fillMaxWidth().padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Lock, null, tint = Brass)
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text("Archivio protetto", fontWeight = FontWeight.Bold)
                        Text(
                            "${snapshot.items.size} file cifrati • AES-256-GCM",
                            color = Silver.copy(alpha = .7f)
                        )
                    }
                }
            }
        }
        items(snapshot.folders, key = { it.id }) { folder ->
            val count = snapshot.items.count { it.folderId == folder.id }
            Card(
                onClick = { onSelect(folder) },
                colors = CardDefaults.cardColors(containerColor = Steel)
            ) {
                Row(
                    Modifier.fillMaxWidth().padding(20.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Folder, null, tint = Brass, modifier = Modifier.size(36.dp))
                    Spacer(Modifier.width(16.dp))
                    Column(Modifier.weight(1f)) {
                        Text(folder.name, fontWeight = FontWeight.SemiBold)
                        Text("$count elementi", color = Silver.copy(alpha = .65f))
                    }
                    Icon(Icons.Default.MoreVert, null, tint = Silver.copy(alpha = .5f))
                }
            }
        }
        item {
            Text(
                "Tocca + per creare una cartella. Aprila e usa il pulsante di importazione.",
                color = Silver.copy(alpha = .6f),
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(16.dp)
            )
        }
    }
}

@Composable
private fun ItemList(
    items: List<VaultItem>,
    onPreview: (VaultItem) -> Unit,
    onShare: (VaultItem) -> Unit,
    onDelete: (VaultItem) -> Unit
) {
    if (items.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Default.UploadFile, null, tint = Brass, modifier = Modifier.size(56.dp))
                Spacer(Modifier.height(12.dp))
                Text("Cartella vuota", style = MaterialTheme.typography.titleLarge)
                Text("Usa + per importare file", color = Silver.copy(alpha = .6f))
            }
        }
        return
    }
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        items(items, key = { it.id }) { item ->
            Card(
                onClick = { onPreview(item) },
                colors = CardDefaults.cardColors(containerColor = Steel)
            ) {
                Row(
                    Modifier.fillMaxWidth().padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        if (item.mimeType.startsWith("image/")) Icons.Default.ImageIcon
                        else Icons.Default.Description,
                        null,
                        tint = Brass,
                        modifier = Modifier.size(34.dp)
                    )
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(item.displayName, maxLines = 1, fontWeight = FontWeight.Medium)
                        Text(
                            Formatter.formatShortFileSize(
                                androidx.compose.ui.platform.LocalContext.current,
                                item.sizeBytes
                            ),
                            color = Silver.copy(alpha = .6f),
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    IconButton(onClick = { onShare(item) }) {
                        Icon(Icons.Default.Share, "Condividi", tint = Silver)
                    }
                    IconButton(onClick = { onDelete(item) }) {
                        Icon(Icons.Default.Delete, "Elimina", tint = Danger)
                    }
                }
            }
        }
    }
}

@Composable
private fun PreviewDialog(
    item: VaultItem,
    loadBytes: suspend () -> ByteArray,
    onDismiss: () -> Unit
) {
    var bytes by remember { mutableStateOf<ByteArray?>(null) }
    var failed by remember { mutableStateOf(false) }
    LaunchedEffect(item.id) {
        runCatching { withContext(Dispatchers.IO) { loadBytes() } }
            .onSuccess { bytes = it }
            .onFailure { failed = true }
    }

    AlertDialog(
        onDismissRequest = {
            bytes?.fill(0)
            onDismiss()
        },
        title = { Text(item.displayName, maxLines = 2) },
        text = {
            Box(
                Modifier.fillMaxWidth().height(380.dp),
                contentAlignment = Alignment.Center
            ) {
                when {
                    failed -> Text("Impossibile decifrare l’anteprima", color = Danger)
                    bytes == null -> CircularProgressIndicator()
                    item.mimeType.startsWith("image/") -> {
                        val bitmap = remember(bytes) {
                            BitmapFactory.decodeByteArray(bytes, 0, bytes!!.size)
                        }
                        if (bitmap != null) {
                            Image(
                                bitmap.asImageBitmap(),
                                contentDescription = item.displayName,
                                modifier = Modifier.fillMaxSize()
                            )
                        } else Text("Formato immagine non supportato")
                    }
                    else -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.Description, null, tint = Brass, modifier = Modifier.size(72.dp))
                        Spacer(Modifier.height(14.dp))
                        Text(item.mimeType)
                        Text(
                            "Il prototipo mantiene il documento cifrato. L’anteprima PDF e Office interna sarà aggiunta nella fase Play Store.",
                            color = Silver.copy(alpha = .65f),
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                bytes?.fill(0)
                onDismiss()
            }) { Text("CHIUDI") }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SettingsScreen(
    authStore: AuthStore,
    onBack: () -> Unit,
    onLock: () -> Unit
) {
    var dial by remember { mutableStateOf(authStore.dialEnabled) }
    var pin by remember { mutableStateOf(authStore.pinEnabled) }
    var password by remember { mutableStateOf(authStore.passwordEnabled) }
    var biometric by remember { mutableStateOf(authStore.biometricEnabled) }

    Scaffold(
        containerColor = SteelBlack,
        topBar = {
            TopAppBar(
                title = { Text("Sicurezza") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "Indietro") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Steel)
            )
        }
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item { SectionTitle("METODI DI SBLOCCO") }
            item {
                SettingToggle("Ghiera con combinazione", "Interfaccia meccanica della cassaforte", dial) {
                    if (it || pin || password || biometric) {
                        dial = it
                        authStore.dialEnabled = it
                    }
                }
            }
            item {
                SettingToggle("PIN numerico", "Inserimento rapido del codice", pin) {
                    if (it || dial || password || biometric) {
                        pin = it
                        authStore.pinEnabled = it
                    }
                }
            }
            item {
                SettingToggle("Password", "Consente lettere, numeri e simboli", password) {
                    if (it || dial || pin || biometric) {
                        password = it
                        authStore.passwordEnabled = it
                    }
                }
            }
            item {
                SettingToggle("Impronta o volto", "Usa la biometria forte configurata in Android", biometric) {
                    if (it || dial || pin || password) {
                        biometric = it
                        authStore.biometricEnabled = it
                    }
                }
            }
            item {
                Text(
                    "Android sceglie automaticamente impronta o volto in base all’hardware sicuro disponibile.",
                    color = Silver.copy(alpha = .6f),
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(horizontal = 6.dp)
                )
            }
            item { SectionTitle("PRIVACY") }
            item { StatusCard("Screenshot e registrazione schermo", "Bloccati", true) }
            item { StatusCard("Backup Android non cifrato", "Disabilitato", true) }
            item { StatusCard("Blocco automatico", "Quando l’app va in background", true) }
            item { StatusCard("Recupero offline", "Attivo tramite codice personale", true) }
            item {
                StatusCard(
                    "Recupero tramite account",
                    "Richiede backend e verifica identità: fase Play Store",
                    false
                )
            }
            item {
                Spacer(Modifier.height(8.dp))
                OutlinedButton(onClick = onLock, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Default.Lock, null)
                    Spacer(Modifier.width(8.dp))
                    Text("BLOCCA ORA")
                }
            }
            item {
                Text(
                    "La biometria è un metodo di accesso; i file rimangono cifrati AES-256-GCM nello spazio interno privato.",
                    color = Silver.copy(alpha = .55f),
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(8.dp)
                )
            }
        }
    }
}

@Composable
private fun SettingToggle(
    title: String,
    subtitle: String,
    checked: Boolean,
    onChecked: (Boolean) -> Unit
) {
    Card(colors = CardDefaults.cardColors(containerColor = Steel)) {
        Row(
            Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text(title, fontWeight = FontWeight.Medium)
                Text(subtitle, color = Silver.copy(alpha = .6f), style = MaterialTheme.typography.bodySmall)
            }
            Switch(checked = checked, onCheckedChange = onChecked)
        }
    }
}

@Composable
private fun StatusCard(title: String, value: String, enabled: Boolean) {
    Card(colors = CardDefaults.cardColors(containerColor = Steel)) {
        Row(
            Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text(title, fontWeight = FontWeight.Medium)
                Text(value, color = Silver.copy(alpha = .6f), style = MaterialTheme.typography.bodySmall)
            }
            Box(
                Modifier
                    .size(12.dp)
                    .background(if (enabled) Brass else SteelLight, CircleShape)
            )
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text,
        color = Brass,
        fontSize = 12.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 1.4.sp,
        modifier = Modifier.padding(top = 10.dp, bottom = 2.dp)
    )
}

@Composable
private fun TextEntryDialog(
    title: String,
    label: String,
    confirm: String,
    minLength: Int,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var text by rememberSaveable { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            OutlinedTextField(
                value = text,
                onValueChange = { text = it.take(40) },
                label = { Text(label) },
                singleLine = true
            )
        },
        confirmButton = {
            Button(enabled = text.trim().length >= minLength, onClick = { onConfirm(text.trim()) }) {
                Text(confirm)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("ANNULLA") } }
    )
}
