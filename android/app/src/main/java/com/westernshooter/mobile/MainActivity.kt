package com.westernshooter.mobile

import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.WebSettings
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        hideSystemUI()
        configureWebView()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemUI()
        }
    }

    /**
     * Enables Immersive Fullscreen Mode.
     * Hides the status bar and navigation bar so the game occupies the entire screen.
     * On Android 11+ (API 30) uses the modern WindowInsetsController API.
     * On older versions falls back to the legacy systemUiVisibility flags.
     */
    private fun hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let { controller ->
                controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                controller.systemBarsBehavior =
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_FULLSCREEN
            )
        }
    }

    /**
     * Configures the Capacitor WebView for optimal HTML5 Canvas game performance.
     *
     * Settings applied:
     *  - JavaScript enabled (required for the game engine)
     *  - DOM Storage & Local Storage (for score persistence)
     *  - Hardware acceleration hint (rendering performance)
     *  - Zoom and text-selection disabled (prevent accidental interference during gameplay)
     *  - Safe browsing disabled (avoid interruptions loading local assets)
     *  - Mixed content allowed for local file loading
     */
    private fun configureWebView() {
        val webView = bridge?.webView ?: return
        val settings: WebSettings = webView.settings

        // JavaScript — required by the game engine
        settings.javaScriptEnabled = true

        // DOM Storage / Local Storage — used to persist high scores
        settings.domStorageEnabled = true
        settings.databaseEnabled = true

        // Disable zoom controls so accidental pinch-to-zoom doesn't break gameplay
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false

        // Disable text selection popups that would interfere with touch events
        webView.isLongClickable = false
        webView.setOnLongClickListener { true }

        // Hardware acceleration is inherited from the Activity/Application flag in the
        // AndroidManifest (android:hardwareAccelerated="true"), but we can reinforce it
        // at the WebView layer by ensuring the layer type is set correctly.
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)

        // Allow loading local assets without mixed-content warnings
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }

        // Improve rendering quality for the canvas-based game
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
    }
}
