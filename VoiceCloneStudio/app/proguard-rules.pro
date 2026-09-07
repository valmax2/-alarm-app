-keepattributes *Annotation*
-dontwarn org.conscrypt.**

# kotlinx.serialization generates serializer classes reflectively looked up by name.
-keepattributes InnerClasses
-if @kotlinx.serialization.Serializable class **
-keepclassmembers class <1> {
    static <1>$Companion Companion;
}
-if @kotlinx.serialization.Serializable class ** {
    static **$* *;
}
-keepclassmembers class <1>$<3> {
    kotlinx.serialization.KSerializer serializer(...);
}
-keepclassmembers class it.vstudioapps.voiceclonestudio.data.** {
    *** Companion;
}
-keepclasseswithmembers class it.vstudioapps.voiceclonestudio.data.** {
    kotlinx.serialization.KSerializer serializer(...);
}
