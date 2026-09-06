package com.fitlog.app.notifications

import android.content.Context
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationManagerCompat

object NotificationChannels {
    const val WORKOUT_CHANNEL_ID = "fitlog_workout_v1"

    // Created by src/lib/nativeNotifications.js's ensureChannels() (Phase 7)
    // on every native launch, before a workout can start. Reused here for
    // the exact rest-done alert — never recreated natively, since channel
    // settings are immutable after first creation.
    const val REST_CHANNEL_ID = "fitlog_rest_v1"

    fun ensureWorkoutChannel(context: Context) {
        val channel = NotificationChannelCompat.Builder(WORKOUT_CHANNEL_ID, NotificationManagerCompat.IMPORTANCE_LOW)
            .setName("Workout in progress")
            .setShowBadge(false)
            .build()
        NotificationManagerCompat.from(context).createNotificationChannel(channel)
    }
}
