package com.fitlog.app.notifications

import android.content.Intent
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

// Bridge between the JS effect layer (src/lib/nativeNotifications.js) and
// WorkoutService (Phase 8's foreground service, 08-01). Deliberately thin —
// every method just forwards to the service via an Intent; no notification
// content or timing logic lives here. See 08-CONTEXT.md D-07 and
// 08-02-PLAN.md Task 1.
@CapacitorPlugin(name = "WorkoutNotification")
class WorkoutNotificationPlugin : Plugin() {

    override fun load() {
        // Plugs this instance's emitAction into WorkoutService's extension
        // point — the service (08-01) has no reference to this class; the
        // dependency points only this direction. A bridge reload simply
        // re-runs load(), overwriting the listener with the fresh instance.
        WorkoutService.actionListener = { id, workoutId, type, payload ->
            emitAction(id, workoutId, type, payload)
        }
    }

    @PluginMethod
    fun start(call: PluginCall) {
        val workoutId = call.getString("workoutId")
        if (workoutId == null) {
            call.reject("workoutId required")
            return
        }
        val startedAt = call.getLong("startedAt") ?: System.currentTimeMillis()
        val intent = Intent(context, WorkoutService::class.java).apply {
            action = WorkoutService.ACTION_START
            putExtra(WorkoutService.EXTRA_WORKOUT_ID, workoutId)
            putExtra(WorkoutService.EXTRA_STARTED_AT, startedAt)
        }
        ContextCompat.startForegroundService(context, intent)
        call.resolve()
    }

    @PluginMethod
    fun update(call: PluginCall) {
        val data = call.data
        val intent = Intent(context, WorkoutService::class.java).apply {
            action = WorkoutService.ACTION_UPDATE
            if (data.has("workoutId")) putExtra(WorkoutService.EXTRA_WORKOUT_ID, call.getString("workoutId"))
            if (data.has("exerciseName")) putExtra(WorkoutService.EXTRA_EXERCISE_NAME, call.getString("exerciseName"))
            if (data.has("setsDone")) putExtra(WorkoutService.EXTRA_SETS_DONE, call.getInt("setsDone") ?: 0)
            if (data.has("setsTotal")) putExtra(WorkoutService.EXTRA_SETS_TOTAL, call.getInt("setsTotal") ?: 0)
            if (data.has("restUntilMs")) putExtra(WorkoutService.EXTRA_REST_UNTIL_MS, call.getLong("restUntilMs") ?: 0L)
            if (data.has("restTotalSec")) putExtra(WorkoutService.EXTRA_REST_TOTAL_SEC, call.getInt("restTotalSec") ?: 0)
            if (data.has("notifyRestDone")) putExtra(WorkoutService.EXTRA_NOTIFY_REST_DONE, call.getBoolean("notifyRestDone") ?: true)
        }
        context.startService(intent)
        call.resolve()
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        context.startService(Intent(context, WorkoutService::class.java).setAction(WorkoutService.ACTION_STOP))
        call.resolve()
    }

    @PluginMethod
    fun getPending(call: PluginCall) {
        val arr = JSArray()
        PendingActionStore.getAll(context).forEach { a ->
            val o = JSObject()
            o.put("id", a.id)
            o.put("workoutId", a.workoutId)
            o.put("type", a.type)
            o.put("payload", a.payload)
            o.put("at", a.at)
            arr.put(o)
        }
        val ret = JSObject()
        ret.put("actions", arr)
        call.resolve(ret)
    }

    @PluginMethod
    fun ack(call: PluginCall) {
        val id = call.getString("id")
        if (id == null) {
            call.reject("id required")
            return
        }
        PendingActionStore.ack(context, id)
        call.resolve()
    }

    @PluginMethod
    fun openNotificationSettings(call: PluginCall) {
        val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
            putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        activity.startActivity(intent)
        call.resolve()
    }

    // Reached only via the load()-installed listener above — never called
    // directly by JS.
    private fun emitAction(id: String, workoutId: String, type: String, payload: Int) {
        val data = JSObject()
        data.put("id", id)
        data.put("workoutId", workoutId)
        data.put("type", type)
        data.put("payload", payload)
        notifyListeners("workoutAction", data)
    }
}
