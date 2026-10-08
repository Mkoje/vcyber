# Victorious Cyber Admin for Android

This Android application opens the website's authenticated administration dashboard in a restricted WebView. It shares the website backend, resource library, price tiers and admin accounts. There is no separate database or embedded password.

You can upload documents and software through Android's system document picker, edit listing titles/descriptions/licenses, replace uploaded files, publish/unpublish resources, download uploaded files, change price tiers, view business statistics and transactions, and sign out. Internet access to your configured website is required.

## Install and connect

1. Transfer `Victorious-Cyber-Admin.apk` from the Desktop delivery folder to your Android phone (Android 8.0 or later).
2. Open the APK and allow installation from the app you used to open it, if prompted. This is a signed development APK for local installation, not a Play Store release.
3. Open **Victorious Cyber Admin**, tap **Server**, and enter the origin of your hosted website, for example `https://vcyber.co.ke`. Do not include `/admin` or another path.
4. Sign in with your existing website administrator email and password. No admin credentials are bundled in this folder.
5. Use **Add a resource** to choose Documents, Software or Printer utilities and select a file. Use **Manage resources** to edit or replace files. Replacing a file preserves the original file for existing purchases.

The app cannot administer an unrelated website currently hosted at your domain: deploy this project's backend and built frontend there first.

## Testing against this computer

Run `npm run build` in the website project, then start the backend from a separate PowerShell terminal:

```powershell
$env:APP_URL='http://127.0.0.1:3001'
npm start
```

For an emulator, forward the port with `adb reverse tcp:3001 tcp:3001`, then enter `http://127.0.0.1:3001` in the app's Server dialog. For a physical phone connected over USB with developer debugging enabled, use the same `adb reverse` command for that device. The computer and backend must remain running. Browser development via `npm run dev` uses the README's localhost:5173 origin instead; do not run two backends on port 3001.

The debug build permits HTTP for local development. Use HTTPS for real administration. Release builds require HTTPS, reject mixed content and certificate errors, disable WebView debugging, and exclude credentials and cookies from backups.

## Build from source

Open this folder in Android Studio, set the Android SDK location if prompted, and build the `app` module. The project uses Java 17, Android SDK 34, Android Gradle Plugin 8.5.2 and Gradle 8.7.

```powershell
.\gradlew.bat assembleDebug lintDebug
```

APK output: `app/build/outputs/apk/debug/app-debug.apk`. To distribute a production release, configure your own release signing key in Android Studio. Keep that key private and retain it for future updates; it is not included in this project.

The file picker follows Android's [WebChromeClient upload callback](https://developer.android.com/reference/android/webkit/WebChromeClient#onShowFileChooser(android.webkit.WebView,android.webkit.ValueCallback%3Candroid.net.Uri[]%3E,android.webkit.WebChromeClient.FileChooserParams)). No broad storage permission or native JavaScript bridge is used.
