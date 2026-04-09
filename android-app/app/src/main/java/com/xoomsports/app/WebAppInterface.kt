package com.goalnowx.app

import android.webkit.JavascriptInterface

class WebAppInterface(private val activity: MainActivity) {

    @JavascriptInterface
    fun onPageReady() {
        // Web page signals it's ready - start SMS listener
        activity.startSmsRetriever()
    }

    @JavascriptInterface
    fun onPinRequested() {
        // PinRequest was called, OTP SMS is being sent
        // SMS Retriever is already listening
        activity.startSmsRetriever()
    }

    @JavascriptInterface
    fun enableSmsConsent() {
        // Edge-case fallback only: allow Android consent dialog for OTP read.
        activity.enableSmsConsentFallback()
    }

    @JavascriptInterface
    fun onSubscriptionComplete(contentUrl: String) {
        // Subscription done - load content page
        activity.runOnUiThread {
            activity.loadContentPage(contentUrl)
        }
    }

    @JavascriptInterface
    fun requestPhoneNumber() {
        // Web page requests phone number (WiFi scenario)
        activity.launchPhoneNumberHint()
    }

    @JavascriptInterface
    fun getAppHash(): String {
        return activity.getAppSignatureHash()
    }
}
