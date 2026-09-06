package com.fitlog.app.notifications

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class PendingAction(
    val id: String,
    val workoutId: String,
    val type: String, // "REST_SKIP" | "REST_ADJUST"
    val payload: Int, // seconds delta; unused for REST_SKIP
    val at: Long
)

// Durable queue for Skip/+15s taps applied while the app's WebView may not
// be alive to receive the fast-path event. Backed by one SharedPreferences
// string holding a JSON array — no new dependency, org.json is part of the
// Android SDK. Entries are drained and acked by the JS layer (Phase 8's
// nativeNotifications.js), never read back by anything native.
object PendingActionStore {
    private const val PREFS = "fitlog_pending_actions"
    private const val KEY = "queue"

    // A workout nobody ever reopens (app uninstalled mid-session, or just
    // never resumed) should not let this queue grow without bound — keeps
    // the most recent MAX_QUEUE_SIZE entries, drops the oldest first.
    private const val MAX_QUEUE_SIZE = 50

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun readArray(context: Context): JSONArray {
        val raw = prefs(context).getString(KEY, null) ?: return JSONArray()
        return try {
            JSONArray(raw)
        } catch (e: Exception) {
            JSONArray()
        }
    }

    @Synchronized
    fun enqueue(context: Context, action: PendingAction) {
        var arr = readArray(context)
        arr.put(
            JSONObject().apply {
                put("id", action.id)
                put("workoutId", action.workoutId)
                put("type", action.type)
                put("payload", action.payload)
                put("at", action.at)
            }
        )
        if (arr.length() > MAX_QUEUE_SIZE) {
            val trimmed = JSONArray()
            val dropCount = arr.length() - MAX_QUEUE_SIZE
            for (i in dropCount until arr.length()) trimmed.put(arr.getJSONObject(i))
            arr = trimmed
        }
        prefs(context).edit().putString(KEY, arr.toString()).apply()
    }

    @Synchronized
    fun getAll(context: Context): List<PendingAction> {
        val arr = readArray(context)
        return (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            PendingAction(
                id = o.getString("id"),
                workoutId = o.getString("workoutId"),
                type = o.getString("type"),
                payload = o.optInt("payload", 0),
                at = o.optLong("at", 0L)
            )
        }
    }

    @Synchronized
    fun ack(context: Context, id: String) {
        val arr = readArray(context)
        val kept = JSONArray()
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            if (o.optString("id") != id) kept.put(o)
        }
        prefs(context).edit().putString(KEY, kept.toString()).apply()
    }

    @Synchronized
    fun clear(context: Context) {
        prefs(context).edit().remove(KEY).apply()
    }
}
