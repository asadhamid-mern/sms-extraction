package com.xoomsports.app

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Base64
import java.security.MessageDigest
import java.util.Arrays

/**
 * Generates the 11-character app signature hash required by SMS Retriever API.
 * This hash must be appended to the SMS message by the aggregator.
 */
object AppSignatureHelper {

    fun getAppSignatures(context: Context): List<String> {
        val signatures = mutableListOf<String>()
        try {
            val packageName = context.packageName
            val signingInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val info = context.packageManager.getPackageInfo(
                    packageName, PackageManager.GET_SIGNING_CERTIFICATES
                )
                info.signingInfo?.apkContentsSigners
            } else {
                @Suppress("DEPRECATION")
                val info = context.packageManager.getPackageInfo(
                    packageName, PackageManager.GET_SIGNATURES
                )
                @Suppress("DEPRECATION")
                info.signatures
            }

            signingInfo?.forEach { signature ->
                val hash = hash(packageName, signature.toCharsString())
                if (hash != null) {
                    signatures.add(hash)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return signatures
    }

    private fun hash(packageName: String, signature: String): String? {
        val appInfo = "$packageName $signature"
        return try {
            val messageDigest = MessageDigest.getInstance("SHA-256")
            messageDigest.update(appInfo.toByteArray())
            var hashSignature = messageDigest.digest()
            hashSignature = Arrays.copyOfRange(hashSignature, 0, 9)
            var base64Hash = Base64.encodeToString(hashSignature, Base64.NO_PADDING or Base64.NO_WRAP)
            base64Hash = base64Hash.substring(0, 11)
            base64Hash
        } catch (e: Exception) {
            null
        }
    }
}
