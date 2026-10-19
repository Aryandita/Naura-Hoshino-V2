package com.naura.dashboard

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.browser.customtabs.CustomTabsIntent
import androidx.webkit.WebViewAssetLoader

/**
 * NauraWebViewClient - Intercepts requests for local bundled assets via WebViewAssetLoader,
 * manages external link delegation via Chrome Custom Tabs, and routes network failures
 * to the branded offline fallback screen.
 */
class NauraWebViewClient(
    private val context: Context,
    private val assetLoader: WebViewAssetLoader,
    private val onLoadingStateChanged: (Boolean) -> Unit,
    private val onPageError: (WebView, String) -> Unit
) : WebViewClient() {

    override fun shouldInterceptRequest(
        view: WebView?,
        request: WebResourceRequest?
    ): WebResourceResponse? {
        val url = request?.url ?: return null
        return assetLoader.shouldInterceptRequest(url)
    }

    override fun shouldOverrideUrlLoading(
        view: WebView?,
        request: WebResourceRequest?
    ): Boolean {
        val uri = request?.url ?: return false
        val host = uri.host?.lowercase() ?: ""
        val scheme = uri.scheme?.lowercase() ?: ""

        if (scheme != "http" && scheme != "https") {
            try {
                val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
                return true
            } catch (_: Exception) {
                return false
            }
        }

        // Internal app assets & development targets stay in WebView
        if (host == "appassets.androidplatform.net" ||
            host == "localhost" ||
            host == "10.0.2.2" ||
            host == "127.0.0.1"
        ) {
            return false
        }

        // External targets (OAuth, donation gateways, community links) open in Custom Tabs
        return try {
            val customTabsIntent = CustomTabsIntent.Builder().build()
            customTabsIntent.launchUrl(context, uri)
            true
        } catch (_: Exception) {
            try {
                val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
                true
            } catch (_: Exception) {
                false
            }
        }
    }

    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
        super.onPageStarted(view, url, favicon)
        onLoadingStateChanged(true)
    }

    override fun onPageFinished(view: WebView?, url: String?) {
        super.onPageFinished(view, url)
        onLoadingStateChanged(false)
    }

    override fun onReceivedError(
        view: WebView?,
        request: WebResourceRequest?,
        error: WebResourceError?
    ) {
        super.onReceivedError(view, request, error)
        if (request?.isForMainFrame == true && view != null) {
            val failingUrl = request.url?.toString() ?: ""
            onPageError(view, failingUrl)
        }
    }
}
