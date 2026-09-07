package it.vstudioapps.voiceclonestudio

import android.app.Application
import it.vstudioapps.voiceclonestudio.data.AppContainer

class VoiceCloneApplication : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
