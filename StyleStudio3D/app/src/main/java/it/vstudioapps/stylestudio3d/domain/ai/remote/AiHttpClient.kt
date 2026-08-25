package it.vstudioapps.stylestudio3d.domain.ai.remote

import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/**
 * Client HTTP condiviso per le chiamate all'abbonamento AI dell'utente. Timeout generosi ma
 * finiti: le API di generazione immagini possono richiedere decine di secondi, ma la richiesta
 * non deve restare appesa all'infinito se il provider non risponde.
 */
object AiHttpClient {
    val instance: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .readTimeout(90, TimeUnit.SECONDS)
            .build()
    }
}
