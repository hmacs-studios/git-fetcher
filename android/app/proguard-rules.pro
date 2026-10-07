# Project specific ProGuard rules for Capacitor Android Release

# Preserve Capacitor core and plugins
-keep class com.getcapacitor.** { *; }
-keep class com.hmacs.medmacs.** { *; }
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# JavaScript Interface methods used in WebView bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# WebKit & WebView components
-keep class android.webkit.** { *; }

# Firebase & Play Services
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Meta / Facebook SDK
-keep class com.facebook.** { *; }

# Lottie Animations
-keep class com.airbnb.lottie.** { *; }

# Suppress missing optional class warnings for R8
-dontwarn com.google.firebase.ktx.Firebase
-dontwarn com.google.firebase.ktx.FirebaseKt
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**
-dontwarn com.facebook.**
-dontwarn com.airbnb.lottie.**
-dontwarn org.apache.commons.**
-dontwarn org.slf4j.**
-dontwarn javax.annotation.**
-dontwarn org.checkerframework.**

# Preserve line numbers for crashlytics/stack trace debugging
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

