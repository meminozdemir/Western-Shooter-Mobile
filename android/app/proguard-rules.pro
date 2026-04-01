# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Keep Capacitor classes
-keep class com.getcapacitor.** { *; }
-keep class com.westernshooter.mobile.** { *; }

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface class:
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
