1. JDK 21 (required by @capacitor/android 8.x, which sets sourceCompatibility/targetCompatibility to VERSION_21)
winget install --id EclipseAdoptium.Temurin.21.JDK
Temurin ships native arm64 builds for Windows-on-ARM, so winget should give you the right one. Restart your terminal after.
Set JAVA_HOME to the JDK 21 install (check the actual path winget used, e.g. under "C:\Program Files\Eclipse Adoptium\"):
setx JAVA_HOME "C:\Program Files\Eclipse Adoptium\jdk-21.<version>-hotspot"

2. Android SDK command-line tools (no full Android Studio needed)
- Download "Command line tools only" from the official page: https://developer.android.com/studio#command-tools
- Unzip so you end up with: C:\Android\cmdline-tools\latest\bin\sdkmanager.bat (the folder must be named latest, so if the zip extracts to cmdline-tools\cmdline-tools, rename the inner one to latest)

3. Set environment variables (PowerShell, no admin needed — restart terminal after)
setx ANDROID_HOME "C:\Android"
setx PATH "$env:PATH;C:\Android\cmdline-tools\latest\bin;C:\Android\platform-tools"

4. Install the SDK pieces this project needs (compileSdk 36)
sdkmanager --licenses        # type 'y' to each prompt
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"

5. Enable USB debugging on your phone
Settings → About phone → tap "Build number" 7 times → Developer options → enable USB debugging. Plug the phone in via USB-C, accept the "Allow USB debugging?" prompt on the phone screen.

6. Verify the device is seen
adb devices
Should list your phone (not "unauthorized" — if it says that, .
                                                                                                                                                         7. Build and install straight to the phone
cd D:\workfiles\ProjectWork\StrengthLog\android                                                                                                          .\gradlew.bat installDebug
This compiles the APK and pushes it directly onto your connected phone in one step — no emulator involved anywhere. Then just open the "FitLog" app icon on your phone.

Whenever you change the web code, run npm run build && npx cap) before re-running gradlew.bat installDebug (in Windows) topick up the changes.