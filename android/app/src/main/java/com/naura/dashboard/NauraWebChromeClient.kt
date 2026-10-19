package com.naura.dashboard

import android.net.Uri
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView

/**
 * NauraWebChromeClient - Manages UI progress notifications, file upload handling,
 * and console message logging for the Naura OS dashboard wrapper.
 */
class NauraWebChromeClient(
    private val onProgressUpdate: (Int) -> Unit,
    private val onOpenFileChooser: (ValueCallback<Array<Uri>>?, WebChromeClient.FileChooserParams?) -> Boolean
) : WebChromeClient() {

    override fun onProgressChanged(view: WebView?, newProgress: Int) {
        super.onProgressChanged(view, newProgress)
        onProgressUpdate(newProgress)
    }

    override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
        if (consoleMessage != null) {
            val tag = "NauraWebView"
            val msg = "[${consoleMessage.messageLevel()}] ${consoleMessage.message()} -- From line ${consoleMessage.lineNumber()} of ${consoleMessage.sourceId()}"
            when (consoleMessage.messageLevel()) {
                ConsoleMessage.MessageLevel.ERROR -> Log.e(tag, msg)
                ConsoleMessage.MessageLevel.WARNING -> Log.w(tag, msg)
                else -> Log.d(tag, msg)
            }
        }
        return true
    }

    override fun onShowFileChooser(
        webView: WebView?,
        filePathCallback: ValueCallback<Array<Uri>>?,
        fileChooserParams: FileChooserParams?
    ): Boolean {
        return onOpenFileChooser(filePathCallback, fileChooserParams)
    }
}
