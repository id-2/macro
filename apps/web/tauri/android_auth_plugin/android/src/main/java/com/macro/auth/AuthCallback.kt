package com.macro.auth

import java.net.URI
import java.net.URLDecoder
import java.util.UUID

/** Validate the per-attempt callback before accepting any session code. */
internal object AuthCallback {
    /**
     * The app's custom schemes. `rox` is current; `macro` predates the rename
     * and is still accepted so a callback minted by an older web bundle works.
     */
    private val expectedSchemes = setOf("rox", "macro")

    fun isExpectedUrl(value: String): Boolean = try {
        val uri = URI(value)
        val nonce = uri.path.removePrefix("/")
        uri.scheme in expectedSchemes && uri.rawAuthority == "android-auth" &&
            uri.rawQuery == null && uri.rawFragment == null &&
            UUID.fromString(nonce).toString() == nonce
    } catch (_: Exception) {
        false
    }

    fun matches(expected: String, received: String): Boolean = try {
        val target = URI(expected)
        val callback = URI(received)
        isExpectedUrl(expected) && callback.scheme == target.scheme &&
            callback.rawAuthority == target.rawAuthority && callback.rawPath == target.rawPath &&
            callback.rawFragment == null
    } catch (_: Exception) {
        false
    }

    fun parameters(received: String): Map<String, String> {
        val pairs = URI(received).rawQuery?.split("&") ?: return emptyMap()
        val result = mutableMapOf<String, String>()
        for (pair in pairs) {
            val parts = pair.split("=", limit = 2)
            val key = URLDecoder.decode(parts[0], "UTF-8")
            require(!result.containsKey(key)) { "Duplicate callback parameter" }
            result[key] = URLDecoder.decode(parts.getOrElse(1) { "" }, "UTF-8")
        }
        return result
    }
}
