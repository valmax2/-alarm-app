-keepattributes *Annotation*
-dontwarn org.conscrypt.**

# kotlinx.serialization generates synthetic serializer classes reflectively looked up by name.
-keepattributes InnerClasses
-keep,includedescriptorclasses class it.vstudioapps.runwarestudio.**$$serializer { *; }
-keepclassmembers class it.vstudioapps.runwarestudio.** {
    *** Companion;
}
-keepclasseswithmembers class it.vstudioapps.runwarestudio.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# ML Kit translation downloads and loads its models reflectively.
-keep class com.google.mlkit.nl.translate.** { *; }
-keep class com.google.android.gms.internal.mlkit_translate.** { *; }

# Room entities/DAOs are referenced by generated code via reflection-adjacent annotation
# processing; keep the schema classes intact.
-keep class it.vstudioapps.runwarestudio.data.db.** { *; }
