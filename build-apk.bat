@echo off
echo Building BugLord APK...
echo.
echo Step 1: Login to EAS
eas login
echo.
echo Step 2: Configure build
eas build:configure
echo.
echo Step 3: Start APK build
eas build --platform android --profile preview
echo.
echo Build started! Check your Expo dashboard for progress.
echo Download link will be provided when complete.
pause
