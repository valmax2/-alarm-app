import java.io.ByteArrayOutputStream

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
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
    namespace = "it.vstudioapps.stylestudio3d"
    compileSdk = 35

    defaultConfig {
        applicationId = "it.vstudioapps.stylestudio3d"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0-prototype"

        // Surfaced in Impostazioni cosi i tester possono confermare quale build hanno
        // installato, dato che un APK di debug non porta altrimenti un numero di build visibile.
        buildConfigField("String", "GIT_SHA", "\"${gitShortSha()}\"")

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables.useSupportLibrary = true
    }

    signingConfigs {
        getByName("debug") {
            // Keystore fisso incluso nel repo cosi ogni build CI condivide la stessa firma:
            // altrimenti ogni runner genererebbe una debug key diversa e Android rifiuterebbe
            // di installare un nuovo APK sopra il precedente.
            storeFile = file("../debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
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

    // Preferenze utente semplici (onboarding completato, narrazione attiva, provider AI scelto).
    implementation("androidx.datastore:datastore-preferences:1.1.1")
    // Storage cifrato per API key dell'abbonamento AI e token Drive: mai in chiaro su disco.
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // Catalogo stili e guardaroba: serializzazione JSON per la persistenza locale su file.
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    // .await() su Task<T> di Google Play Services (usato dall'autorizzazione Google Drive).
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0")

    // Client HTTP generico per l'adapter "porta il tuo abbonamento AI" (BYO API key).
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Caricamento immagini (foto caricate dall'utente, anteprime importate) senza decoding manuale.
    implementation("io.coil-kt:coil-compose:2.7.0")

    // Authorization API di Google Identity Services: token OAuth con scope Drive per la sincronizzazione.
    implementation("com.google.android.gms:play-services-auth:21.3.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    androidTestImplementation(platform("androidx.compose:compose-bom:2024.12.01"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
}
