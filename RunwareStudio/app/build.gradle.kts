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
    id("org.jetbrains.kotlin.plugin.serialization")
    id("com.google.devtools.ksp")
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
    namespace = "it.vstudioapps.runwarestudio"
    compileSdk = 35

    defaultConfig {
        applicationId = "it.vstudioapps.runwarestudio"
        minSdk = 26
        targetSdk = 35

        // Bump both on every change that ships: versionCode always +1 (Play Console requires
        // a strictly increasing value on each upload, debug or release), versionName follows
        // semver (MAJOR.MINOR.PATCH) — PATCH for fixes, MINOR for new functionality, MAJOR
        // once the app is stable enough for a real 1.0.
        versionCode = 1
        versionName = "0.1.0"

        buildConfigField("String", "GIT_SHA", "\"${gitShortSha()}\"")
        // Runware's REST endpoint — the whole task-array protocol goes through this one URL.
        // Kept as a build config field (not hardcoded in the client) so a debug build can be
        // pointed at a staging endpoint later without touching source.
        buildConfigField("String", "RUNWARE_API_BASE_URL", "\"https://api.runware.ai/v1\"")

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
    implementation("androidx.navigation:navigation-compose:2.8.5")

    // Persisted user preferences (last-used model, default params, UI state).
    implementation("androidx.datastore:datastore-preferences:1.1.1")
    // Encrypted-at-rest storage for the user's own Runware API key — it never leaves the
    // device except as the Authorization header on requests the user's own key authorizes.
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // Local archive of every generation job (prompts, params, output file paths).
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    // Runware's REST API is a plain JSON-over-HTTPS array-of-tasks protocol — no SDK needed.
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // Renders both remote result URLs and local content:// archive/reference images.
    implementation("io.coil-kt:coil-compose:2.7.0")

    // On-device Italian -> English translation, so prompts never have to leave the phone
    // just to be translated (only the already-translated text is sent to Runware).
    implementation("com.google.mlkit:translate:17.0.3")

    // Lets the user attach 1+ existing photos of a character straight from the system
    // picker, without a storage permission.
    implementation("androidx.activity:activity-ktx:1.10.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation(platform("androidx.compose:compose-bom:2024.12.01"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
}
