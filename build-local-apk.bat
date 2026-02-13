@echo off
echo Building BugLord APK locally...
echo.
echo This will create a release APK for testing
echo Make sure you have Android Studio installed
echo.
cd android
echo Building with Gradle...
gradlew assembleRelease
echo.
echo APK created at: android\app\build\outputs\apk\release\app-release.apk
echo.
echo Copy this file to your Android device to install and test
pause
