package it.vstudioapps.runwarestudio.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [JobEntity::class], version = 1, exportSchema = false)
abstract class RunwareDatabase : RoomDatabase() {
    abstract fun jobDao(): JobDao

    companion object {
        @Volatile private var instance: RunwareDatabase? = null

        fun get(context: Context): RunwareDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(
                context.applicationContext,
                RunwareDatabase::class.java,
                "runwarestudio_archive.db"
            ).build().also { instance = it }
        }
    }
}
