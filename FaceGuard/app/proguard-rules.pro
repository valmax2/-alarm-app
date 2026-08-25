-keepattributes *Annotation*
-dontwarn org.conscrypt.**

# ML Kit face detection loads its model classes reflectively.
-keep class com.google.mlkit.vision.face.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_face.** { *; }
