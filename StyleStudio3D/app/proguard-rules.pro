-keepattributes *Annotation*
-dontwarn org.conscrypt.**

# kotlinx.serialization: mantiene i serializzatori generati per i modelli persistiti su file
# (catalogo stili, guardaroba, preferenze) cosi il minify di release non li rimuove/rinomina.
-keepclassmembers class it.vstudioapps.stylestudio3d.** {
    *** Companion;
}
-keepclasseswithmembers class it.vstudioapps.stylestudio3d.** {
    kotlinx.serialization.KSerializer serializer(...);
}
