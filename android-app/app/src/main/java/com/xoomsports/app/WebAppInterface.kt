package com.goalnowx.app

import android.webkit.JavascriptInterface

class WebAppInterface(private val activity: MainActivity) {

    @JavascriptInterface
    fun onPageReady() {
        // Web page signals it's ready - start SMS listener
        activity.startSmsRetriever()
        activity.enableSmsConsentFallback()
    }

    @JavascriptInterface
    fun onPinRequested() {
        // PinRequest path started after trusted tap.
        // Re-arm both listeners immediately so fast OTP deliveries are not missed.
        activity.restartSmsRetrieverNow()
        activity.enableSmsConsentFallback()
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
