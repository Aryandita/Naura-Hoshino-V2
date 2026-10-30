package com.naura.dashboard

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsetsController
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.ProgressBar
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.webkit.WebViewAssetLoader

/**
 * MainActivity - Native Android Activity hosting the Naura OS Mobile Dashboard.
 * Integrates hardware acceleration, offline fallback handling, Chrome Custom Tabs,
 * responsive edge-to-edge layout, and native JavaScript bridge.
 */
class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefreshLayout: SwipeRefreshLayout
    private lateinit var progressBar: ProgressBar

    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null

    private val filePickerLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == Activity.RESULT_OK) {
                val data = result.data
                val results: Array<Uri>? = when {
                    data?.dataString != null -> arrayOf(Uri.parse(data.dataString))
                    data?.clipData != null -> {
                        val clip = data.clipData!!
                        Array(clip.itemCount) { i -> clip.getItemAt(i).uri }
                    }
                    else -> null
                }
                fileUploadCallback?.onReceiveValue(results)
            } else {
                fileUploadCallback?.onReceiveValue(null)
            }
            fileUploadCallback = null
        }

    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .setDomain("appassets.androidplatform.net")
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/mobile/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    private val defaultLocalUrl = "https://appassets.androidplatform.net/assets/www/index.html"
    private val offlineUrl = "https://appassets.androidplatform.net/assets/www/offline.html"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        setupSystemBars()

        webView = findViewById(R.id.webView)
        swipeRefreshLayout = findViewById(R.id.swipeRefreshLayout)
        progressBar = findViewById(R.id.progressBar)

        configureWebView()
        setupSwipeRefresh()
        setupBackNavigation()

        loadDashboard()
    }

    private fun setupSystemBars() {
        val window = window
        window.statusBarColor = Color.parseColor("#0B0F19")
        window.navigationBarColor = Color.parseColor("#0B0F19")

        val windowInsetsController = WindowCompat.getInsetsController(window, window.decorView)
        // Dark theme: use light icons
        windowInsetsController.isAppearanceLightStatusBars = false
        windowInsetsController.isAppearanceLightNavigationBars = false
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false

        // Viewport and responsive layout
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false

        // High-performance caching & offline support
        settings.cacheMode = if (isNetworkAvailable()) {
            WebSettings.LOAD_DEFAULT
        } else {
            WebSettings.LOAD_CACHE_ELSE_NETWORK
        }

        // Mixed content security policy
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE

        // Custom User-Agent tag
        val defaultUserAgent = settings.userAgentString
        settings.userAgentString = "$defaultUserAgent NauraOS-Android/2.4.0"

        // JavaScript Interface Bridge
        webView.addJavascriptInterface(
            NauraNativeBridge(this) {
                runOnUiThread { reloadDashboard() }
            },
            "NauraNative"
        )

        // Web Clients
        webView.webViewClient = NauraWebViewClient(
            context = this,
            assetLoader = assetLoader,
            onLoadingStateChanged = { isLoading ->
                swipeRefreshLayout.isRefreshing = isLoading
                progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
            },
            onPageError = { _, _ ->
                runOnUiThread {
                    webView.loadUrl(offlineUrl)
                }
            }
        )

        webView.webChromeClient = NauraWebChromeClient(
            onProgressUpdate = { progress ->
                progressBar.progress = progress
                if (progress >= 100) {
                    progressBar.visibility = View.GONE
                } else if (progressBar.visibility == View.GONE) {
                    progressBar.visibility = View.VISIBLE
                }
            },
            onOpenFileChooser = { callback, params ->
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = callback
                try {
                    val intent = params?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                        type = "*/*"
                        addCategory(Intent.CATEGORY_OPENABLE)
                    }
                    filePickerLauncher.launch(intent)
                    true
                } catch (_: Exception) {
                    fileUploadCallback = null
                    false
                }
            }
        )
    }

    private fun setupSwipeRefresh() {
        swipeRefreshLayout.setColorSchemeColors(
            Color.parseColor("#FFB6C1"),
            Color.parseColor("#00FFFF"),
            Color.parseColor("#F472B6")
        )
        swipeRefreshLayout.setProgressBackgroundColorSchemeColor(Color.parseColor("#121826"))

        swipeRefreshLayout.setOnRefreshListener {
            reloadDashboard()
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    private fun isNetworkAvailable(): Boolean {
        val connectivityManager =
            getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
        val activeNetwork = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(activeNetwork) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun loadDashboard() {
        val targetUrl = intent?.getStringExtra("TARGET_URL") ?: defaultLocalUrl
        webView.loadUrl(targetUrl)
    }

    private fun reloadDashboard() {
        if (!isNetworkAvailable() && (webView.url == null || webView.url!!.contains("offline.html"))) {
            webView.loadUrl(offlineUrl)
            swipeRefreshLayout.isRefreshing = false
        } else {
            webView.reload()
        }
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
