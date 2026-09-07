package com.fitlog.app.notifications

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import com.fitlog.app.MainActivity
import com.fitlog.app.R
import java.util.UUID

// The foreground service behind the ongoing workout notification and the
// wake-lock-accurate rest alert (NOTIF-09, NOTIF-10). See
// .planning/phases/08-ongoing-notification/08-CONTEXT.md and
// 08-01-PLAN.md for the full design — in short: a foreground service
// doesn't keep the CPU awake on its own (Handler.postDelayed stalls during
// Doze), so rest is timed by a PARTIAL_WAKE_LOCK held only for the one
// interval it's needed, never AlarmManager (which would need the
// user-facing SCHEDULE_EXACT_ALARM toggle on Android 14+).
class WorkoutService : Service() {

    companion object {
        const val ACTION_START = "com.fitlog.app.notifications.ACTION_START"
        const val ACTION_UPDATE = "com.fitlog.app.notifications.ACTION_UPDATE"
        const val ACTION_STOP = "com.fitlog.app.notifications.ACTION_STOP"
        const val ACTION_SKIP_REST = "com.fitlog.app.notifications.ACTION_SKIP_REST"
        const val ACTION_ADD_15S = "com.fitlog.app.notifications.ACTION_ADD_15S"
        const val ACTION_FINISH_TAPPED = "com.fitlog.app.notifications.ACTION_FINISH_TAPPED"

        const val EXTRA_WORKOUT_ID = "workoutId"
        const val EXTRA_EXERCISE_NAME = "exerciseName"
        const val EXTRA_SETS_DONE = "setsDone"
        const val EXTRA_SETS_TOTAL = "setsTotal"
        const val EXTRA_STARTED_AT = "startedAt"
        const val EXTRA_REST_UNTIL_MS = "restUntilMs"
        const val EXTRA_REST_TOTAL_SEC = "restTotalSec"
        const val EXTRA_NOTIFY_REST_DONE = "notifyRestDone"

        private const val NOTIF_ID_ONGOING = 9001
        private const val NOTIF_ID_REST_DONE = 9002

        // Extension point for 08-02's WorkoutNotificationPlugin. Deliberately
        // NOT a reference to the plugin class itself — this file must compile
        // and be adb-testable with no plugin/JS layer present at all. The
        // plugin plugs a bound emitAction reference in from its own load().
        var actionListener: ((id: String, workoutId: String, type: String, payload: Int) -> Unit)? = null
    }

    private var workoutId: String? = null
    private var exerciseName: String? = null
    private var setsDone: Int = 0
    private var setsTotal: Int = 0
    private var startedAt: Long = 0L
    private var restUntil: Long = 0L // 0 = not resting
    private var restTotalSec: Int = 0
    private var notifyRestDone: Boolean = true

    private var wakeLock: PowerManager.WakeLock? = null
    private var restRunnable: Runnable? = null
    private var armedForRestUntil: Long = 0L
    private val handler = Handler(Looper.getMainLooper())

    // Only ever populated on API 26+ (see playDuckedDing/abandonDuckingFocus) —
    // the field itself is safe to declare unconditionally since it's nullable
    // and never instantiated below O.
    private var audioFocusRequest: AudioFocusRequest? = null

    override fun onCreate() {
        super.onCreate()
        NotificationChannels.ensureWorkoutChannel(this)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            teardown()
            return START_NOT_STICKY
        }
        if (intent == null) {
            // No data to rebuild state from (e.g. a killed-and-respawned
            // service with no in-memory state). The JS effect layer already
            // re-issues a fresh ACTION_START on reinit whenever
            // activeWorkout is still non-null — nothing useful to do here.
            return START_NOT_STICKY
        }

        // D-03: build + post the notification as the very first action,
        // before anything that could block (SharedPreferences, etc).
        applyIntentToState(intent)
        val notification = buildOngoingNotification()
        ServiceCompat.startForeground(
            this,
            NOTIF_ID_ONGOING,
            notification,
            ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
        )

        when (intent.action) {
            ACTION_SKIP_REST -> handleSkipRest()
            ACTION_ADD_15S -> handleAdd15s()
            ACTION_FINISH_TAPPED -> handleFinishTapped()
            else -> rescheduleRestAlarmIfNeeded()
        }

        return START_NOT_STICKY
    }

    override fun onDestroy() {
        cancelRestAlarm()
        super.onDestroy()
    }

    private fun applyIntentToState(intent: Intent) {
        if (intent.hasExtra(EXTRA_WORKOUT_ID)) workoutId = intent.getStringExtra(EXTRA_WORKOUT_ID)
        if (intent.hasExtra(EXTRA_EXERCISE_NAME)) exerciseName = intent.getStringExtra(EXTRA_EXERCISE_NAME)
        if (intent.hasExtra(EXTRA_SETS_DONE)) setsDone = intent.getIntExtra(EXTRA_SETS_DONE, setsDone)
        if (intent.hasExtra(EXTRA_SETS_TOTAL)) setsTotal = intent.getIntExtra(EXTRA_SETS_TOTAL, setsTotal)
        if (intent.hasExtra(EXTRA_STARTED_AT)) startedAt = intent.getLongExtra(EXTRA_STARTED_AT, startedAt)
        if (intent.hasExtra(EXTRA_REST_UNTIL_MS)) restUntil = intent.getLongExtra(EXTRA_REST_UNTIL_MS, 0L)
        if (intent.hasExtra(EXTRA_REST_TOTAL_SEC)) restTotalSec = intent.getIntExtra(EXTRA_REST_TOTAL_SEC, restTotalSec)
        if (intent.hasExtra(EXTRA_NOTIFY_REST_DONE)) notifyRestDone = intent.getBooleanExtra(EXTRA_NOTIFY_REST_DONE, true)
    }

    // Named directly rather than via packageManager.getLaunchIntentForPackage
    // (which returns a nullable Intent) — MainActivity's own
    // launchMode="singleTask" (manifest) means this resumes the existing
    // instance instead of creating a new one. Factored out so
    // handleFinishTapped() can also call startActivity() with it directly.
    private fun appLaunchIntent(): Intent =
        Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }

    private fun openAppPendingIntent(): PendingIntent {
        return PendingIntent.getActivity(
            this,
            0,
            appLaunchIntent(),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
    }

    private fun pendingIntentForAction(action: String, requestCode: Int): PendingIntent {
        val intent = Intent(this, WorkoutService::class.java).setAction(action)
        return PendingIntent.getService(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
    }

    private fun buildOngoingNotification(): Notification {
        val builder = NotificationCompat.Builder(this, NotificationChannels.WORKOUT_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_workout)
            .setContentTitle(exerciseName ?: "Workout in progress")
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setContentIntent(openAppPendingIntent())

        if (restUntil > 0) {
            builder
                .setContentText("Resting…")
                .setUsesChronometer(true)
                .setChronometerCountDown(true)
                .setWhen(restUntil)
                .addAction(R.drawable.ic_stat_workout, "Skip rest", pendingIntentForAction(ACTION_SKIP_REST, 1))
                .addAction(R.drawable.ic_stat_workout, "+15s", pendingIntentForAction(ACTION_ADD_15S, 2))
        } else {
            builder
                .setContentText("Set $setsDone/$setsTotal")
                .setUsesChronometer(true)
                .setChronometerCountDown(false)
                .setWhen(startedAt)
                // Routes through the service (not a direct openAppPendingIntent)
                // so the tap is durably recorded via the same pending-action
                // pipeline as Skip/+15s — see handleFinishTapped().
                .addAction(R.drawable.ic_stat_workout, "Finish", pendingIntentForAction(ACTION_FINISH_TAPPED, 3))
        }

        return builder.build()
    }

    private fun postOngoingNotification() {
        NotificationManagerCompat.from(this).notify(NOTIF_ID_ONGOING, buildOngoingNotification())
    }

    private fun rescheduleRestAlarmIfNeeded() {
        if (restUntil <= 0L) {
            cancelRestAlarm()
            return
        }
        if (restUntil == armedForRestUntil) return // already armed for this exact deadline
        armRestAlarm(restUntil - System.currentTimeMillis(), restUntil)
    }

    private fun armRestAlarm(delayMs: Long, deadline: Long) {
        cancelRestAlarm()
        armedForRestUntil = deadline
        if (delayMs <= 0) {
            fireRestDone()
            return
        }
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "FitLog:RestTimer").apply {
            setReferenceCounted(false)
            // Hard cap beyond the expected delay: a safety net so a bug in
            // cancelRestAlarm() can't hold the lock forever, not the primary
            // timing mechanism (the Handler callback is).
            acquire(delayMs + 5_000)
        }
        val runnable = Runnable { fireRestDone() }
        restRunnable = runnable
        handler.postDelayed(runnable, delayMs)
    }

    private fun cancelRestAlarm() {
        restRunnable?.let { handler.removeCallbacks(it) }
        restRunnable = null
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        armedForRestUntil = 0L
    }

    private fun fireRestDone() {
        cancelRestAlarm()
        if (notifyRestDone) {
            postRestDoneAlert()
            playDuckedDing()
            vibrateForRestDone()
        }
        restUntil = 0L
        restTotalSec = 0
        postOngoingNotification()
    }

    // Visual only — sound/vibration are owned entirely by playDuckedDing()/
    // vibrateForRestDone() below (Phase 9, NOTIF-16), not the channel or
    // this builder. setSilent(true) suppresses both uniformly across API
    // levels so nothing plays twice.
    private fun postRestDoneAlert() {
        val builder = NotificationCompat.Builder(this, NotificationChannels.REST_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_workout)
            .setContentTitle("Rest done")
            .setContentText(exerciseName?.let { "Back to $it" } ?: "Time for your next set")
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setSilent(true)
        NotificationManagerCompat.from(this).notify(NOTIF_ID_REST_DONE, builder.build())
    }

    // NOTIF-16: plays through the app's own audio focus request
    // (AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK) so concurrent music (Spotify,
    // etc.) ducks instead of being talked over or drowning out the ding —
    // the channel-default notification sound this replaced did neither.
    //
    // Plays the bundled res/raw/fitlog_chime asset, not
    // RingtoneManager.getDefaultUri() — the phone's own default
    // notification sound can be (and commonly is) set to silent, which
    // would make this fire with no audible result despite the ducking
    // working correctly. A bundled asset has no such dependency.
    private fun playDuckedDing() {
        val audioManager = getSystemService(AUDIO_SERVICE) as AudioManager
        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                .setAudioAttributes(attrs)
                .build()
            audioFocusRequest = request
            audioManager.requestAudioFocus(request)
        } else {
            @Suppress("DEPRECATION")
            audioManager.requestAudioFocus(
                AudioManager.OnAudioFocusChangeListener {},
                AudioManager.STREAM_ALARM,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
            )
        }

        val player = MediaPlayer()
        try {
            player.setAudioAttributes(attrs)
            val chimeUri = Uri.parse("android.resource://$packageName/${R.raw.fitlog_chime}")
            player.setDataSource(this, chimeUri)
            player.setOnCompletionListener {
                it.release()
                abandonDuckingFocus()
            }
            player.prepare()
            player.start()
        } catch (e: Exception) {
            player.release()
            abandonDuckingFocus()
        }
    }

    private fun abandonDuckingFocus() {
        val audioManager = getSystemService(AUDIO_SERVICE) as AudioManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
            audioFocusRequest = null
        } else {
            @Suppress("DEPRECATION")
            audioManager.abandonAudioFocus(AudioManager.OnAudioFocusChangeListener {})
        }
    }

    // NOTIF-16: explicit Vibrator call with USAGE_ALARM, not channel-default
    // vibration — unaffected by the user's own per-channel vibration tweaks.
    private fun vibrateForRestDone() {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(VIBRATOR_SERVICE) as Vibrator
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // VibrationEffect.createWaveform is API 26+ — this call must stay
            // inside the branch, not hoisted above it, or it would resolve
            // (and crash) unconditionally on API 24-25 devices too.
            val effect = VibrationEffect.createWaveform(longArrayOf(0, 300, 200, 300), -1)
            val attrs = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build()
            vibrator.vibrate(effect, attrs)
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(longArrayOf(0, 300, 200, 300), -1)
        }
    }

    private fun handleSkipRest() {
        restUntil = 0L
        restTotalSec = 0
        cancelRestAlarm()
        enqueueAndEmit("REST_SKIP", 0)
        postOngoingNotification()
    }

    private fun handleAdd15s() {
        if (restUntil <= 0L) return
        val now = System.currentTimeMillis()
        // Mirrors reducer.js's REST_ADJUST clamp exactly: never push the
        // deadline into the past, and keep the ring's denominator moving
        // with it so it can't visually overflow past full.
        restUntil = maxOf(now, restUntil + 15_000)
        restTotalSec = maxOf(1, restTotalSec + 15)
        armRestAlarm(restUntil - now, restUntil)
        enqueueAndEmit("REST_ADJUST", 15)
        postOngoingNotification()
    }

    private fun handleFinishTapped() {
        // Durably records the tap through the exact same pipeline Skip/+15s
        // already use (Phase 8) — 09-02's JS drains/listens for it the same
        // way, setting a finishRequested flag rather than finishing the
        // workout natively (this service has none of FINISH_WORKOUT's
        // volume/PR/session-building logic). startActivity is separate:
        // a PendingIntent.getService() tap alone never brings the app to
        // the foreground on its own.
        enqueueAndEmit("FINISH_TAPPED", 0)
        startActivity(appLaunchIntent())
    }

    private fun enqueueAndEmit(type: String, payload: Int) {
        val wid = workoutId ?: return
        val id = UUID.randomUUID().toString()
        PendingActionStore.enqueue(this, PendingAction(id, wid, type, payload, System.currentTimeMillis()))
        actionListener?.invoke(id, wid, type, payload)
    }

    private fun teardown() {
        cancelRestAlarm()
        if (workoutId != null) PendingActionStore.clear(this)
        workoutId = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }
}
