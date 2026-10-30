package com.naura.dashboard

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.webkit.JavascriptInterface
import android.widget.Toast
import androidx.browser.customtabs.CustomTabsIntent

/**
 * NauraNativeBridge - JavaScript Interface bridge for Naura OS Mobile Dashboard
 * Exposes device capabilities (connectivity, haptic, clipboard, external navigation)
 * to web dashboard JavaScript via `window.NauraNative`.
 */
class NauraNativeBridge(private val context: Context, private val onReloadRequested: () -> Unit) {

    @JavascriptInterface
    fun getAppVersion(): String {
        return "2.4.0"
    }

    @JavascriptInterface
    fun getPlatform(): String {
        return "android"
    }

    @JavascriptInterface
    fun isOnline(): Boolean {
        val connectivityManager =
            context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
                ?: return false
        val activeNetwork = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(activeNetwork) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    @JavascriptInterface
    fun showToast(message: String) {
        if (message.isBlank()) return
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }

    @JavascriptInterface
    fun vibrate(durationMs: Long = 40L) {
        val clampedDuration = durationMs.coerceIn(10L, 500L)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager =
                    context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator?.vibrate(
                    VibrationEffect.createOneShot(clampedDuration, VibrationEffect.DEFAULT_AMPLITUDE)
                )
            } else {
                @Suppress("DEPRECATION")
                val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                vibrator?.vibrate(
                    VibrationEffect.createOneShot(clampedDuration, VibrationEffect.DEFAULT_AMPLITUDE)
                )
            }
        } catch (_: Exception) {}
    }

    @JavascriptInterface
    fun copyToClipboard(text: String) {
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return
        val clip = ClipData.newPlainText("Naura OS", text)
        clipboard.setPrimaryClip(clip)
        Toast.makeText(context, "Teks disalin ke papan klip", Toast.LENGTH_SHORT).show()
    }

    @JavascriptInterface
    fun openExternal(url: String) {
        try {
            val parsedUri = Uri.parse(url)
            val customTabsIntent = CustomTabsIntent.Builder().build()
            customTabsIntent.launchUrl(context, parsedUri)
        } catch (_: Exception) {
            try {
                val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(browserIntent)
            } catch (_: Exception) {}
        }
    }

    @JavascriptInterface
    fun reload() {
        onReloadRequested()
    }
}
