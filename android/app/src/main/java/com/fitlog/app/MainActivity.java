package com.fitlog.app;

import com.fitlog.app.notifications.WorkoutNotificationPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  {
    registerPlugin(WorkoutNotificationPlugin.class);
  }
}
