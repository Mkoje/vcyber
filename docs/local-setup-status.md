# Current local setup status

The website setup and functional review are complete for local demo use. The previous local-server startup rejection is resolved. The backend starts, 15 integration tests pass, production build and browser acceptance pass, and Android emulator acceptance passes.

See functional-review.md for the full current validation record and remaining external provider/production requirements. After reboot, run npm run dev and open http://localhost:5173. The administration page is /admin.

The Android APK, instructions and Android Studio project are in Desktop/New folder. Sign-in uses the same backend administrator account; storage/admin-credentials.txt contains the local administrator password. No password is embedded in the Android app.
