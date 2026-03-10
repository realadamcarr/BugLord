@echo off
echo Building BugLord Test APK...
echo.
echo This will build a local development APK for testing
echo.

REM Check if EAS CLI is installed
echo Checking EAS CLI installation...
eas --version
if %ERRORLEVEL% neq 0 (
    echo Installing EAS CLI...
    npm install -g @expo/eas-cli
)

echo.
echo Logging into EAS...
eas login

echo.
echo Building APK for testing...
eas build --platform android --profile preview --local

echo.
echo Build complete! Look for the APK file in the current directory.
pause
