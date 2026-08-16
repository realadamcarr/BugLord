@echo off
echo Building BugLord for local testing...
echo.

echo Starting Metro bundler and Expo development server...
echo.
echo To test on Android:
echo 1. Install Expo Go app on your Android device
echo 2. Scan the QR code that appears
echo 3. Or use 'a' to open Android emulator if installed
echo.

npx expo start --android
