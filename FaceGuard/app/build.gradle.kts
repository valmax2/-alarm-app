import java.io.ByteArrayOutputStream
import java.util.Properties

// Release signing material lives outside version control (see .gitignore) — CI and any fresh
// checkout simply won't have it, which is why every use of it below is conditional. See
// keystore.properties.example for what the developer's own local copy needs to contain.
val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties().apply {
    if (keystorePropertiesFile.exists()) load(keystorePropertiesFile.inputStream())
}

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

fun gitShortSha(): String = try {
    val out = ByteArrayOutputStream()
    exec {
        commandLine("git", "rev-parse", "--short", "HEAD")
        standardOutput = out
    }
    out.toString().trim()
} catch (e: Exception) {
    "unknown"
}

android {
    namespace = "it.vstudioapps.faceguard"
    compileSdk = 35

    defaultConfig {
        applicationId = "it.vstudioapps.faceguard"
        minSdk = 26
        targetSdk = 35

        // Bump both on every change that ships: versionCode always +1 (Play Console requires
        // a strictly increasing value on each upload, debug or release), versionName follows
        // semver (MAJOR.MINOR.PATCH) — PATCH for fixes, MINOR for new functionality, MAJOR
        // once the app is stable enough for a real 1.0.
        versionCode = 2
        versionName = "0.2.0"

        // Surfaced in Settings so testers can confirm exactly which build is installed,
        // since debug APKs carry no visible build number otherwise.
        buildConfigField("String", "GIT_SHA", "\"${gitShortSha()}\"")

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables.useSupportLibrary = true
    }

    signingConfigs {
        getByName("debug") {
            // Fixed keystore checked into the repo so every CI build shares the same
            // signature: CI runners otherwise generate a fresh debug key per run, which
            // makes Android refuse to install a new APK over the previous one.
            storeFile = file("../debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
        if (keystorePropertiesFile.exists()) {
            create("release") {
                storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("debug")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            // Only present on the machine that has keystore.properties (never CI, never a
            // fresh checkout) — without it, ./gradlew bundleRelease still compiles, it just
            // produces an unsigned bundle Play Console would reject.
            if (keystorePropertiesFile.exists()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.10.0")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    // LifecycleService gives the foreground service a LifecycleOwner, which CameraX
    // requires to bind its use cases even though the service has no UI.
    implementation("androidx.lifecycle:lifecycle-service:2.8.7")
    // setViewTreeLifecycleOwner/setViewTreeViewModelStoreOwner/setViewTreeSavedStateRegistryOwner,
    // used to host a ComposeView inside the cover overlay's bare WindowManager window (it has
    // no Activity/Fragment to supply those tree owners for free).
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.7")
    implementation("androidx.savedstate:savedstate-ktx:1.2.1")

    // Persisted user preferences (theme, cover mode, threshold, custom image).
    implementation("androidx.datastore:datastore-preferences:1.1.1")

    // Front camera capture + ML Kit on-device face detection for presence monitoring.
    implementation("androidx.camera:camera-core:1.4.1")
    implementation("androidx.camera:camera-camera2:1.4.1")
    implementation("androidx.camera:camera-lifecycle:1.4.1")
    // PreviewView, used only by the enrollment screen so the user can see themselves while
    // FaceGuard captures their reference face signature.
    implementation("androidx.camera:camera-view:1.4.1")
    implementation("com.google.mlkit:face-detection:16.1.7")

    // Confirms it's really the phone's owner (via system fingerprint/Face Unlock) before
    // letting them (re-)register the face profile used for continuous monitoring.
    implementation("androidx.biometric:biometric:1.1.0")
    // androidx.biometric:1.1.0 transitively pulls an old androidx.fragment release whose
    // FragmentActivity.checkForValidRequestCode() rejects the large request codes the modern
    // Activity Result API (rememberLauncherForActivityResult) generates, crashing with
    // "Can only use lower 16 bits for requestCode" the moment any picker is launched. Forcing
    // a current fragment version here wins Gradle's dependency resolution and fixes it.
    implementation("androidx.fragment:fragment-ktx:1.8.5")

    // One-time "FaceGuard Pro" unlock (custom-image + lock-screen cover modes). See
    // billing/BillingRepository.kt — needs a matching in-app product created in Play Console
    // before it can be tested end to end. Google periodically requires newer major Billing
    // Library versions for new Play Console submissions — check Play Console's current
    // requirement before release and bump this if needed.
    implementation("com.android.billingclient:billing-ktx:5.2.1")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation(platform("androidx.compose:compose-bom:2024.12.01"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
}
