package com.goalnowx.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status

class SmsBroadcastReceiver : BroadcastReceiver() {

    var onOtpReceived: ((String) -> Unit)? = null
    var onConsentRequired: ((Intent) -> Unit)? = null

    override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action != SmsRetriever.SMS_RETRIEVED_ACTION) return

        val extras = intent.extras ?: return
        val status = extras.get(SmsRetriever.EXTRA_STATUS) as? Status ?: return

        when (status.statusCode) {
            CommonStatusCodes.SUCCESS -> {
                // Try SMS Retriever first (silent - message contains app hash)
                val message = extras.getString(SmsRetriever.EXTRA_SMS_MESSAGE)
                if (message != null) {
                    val otp = extractOtp(message)
                    if (otp != null) {
                        onOtpReceived?.invoke(otp)
                        return
                    }
                }

                // Try SMS User Consent (shows consent dialog)
                @Suppress("DEPRECATION")
                val consentIntent = extras.getParcelable<Intent>(SmsRetriever.EXTRA_CONSENT_INTENT)
                if (consentIntent != null) {
                    onConsentRequired?.invoke(consentIntent)
                }
            }
            CommonStatusCodes.TIMEOUT -> {
                // Timed out - fallback handled by web page
            }
        }
    }

    private fun extractOtp(message: String): String? {
        val pattern = Regex("\\b(\\d{4})\\b")
        return pattern.find(message)?.groupValues?.get(1)
    }
}
