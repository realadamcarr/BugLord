@echo off
echo BugLord Icon Update Script
echo ========================
echo.

REM Check if caterpillar image exists in common locations
set "image_found=false"

if exist "caterpillar.png" (
    set "source_image=caterpillar.png"
    set "image_found=true"
) else if exist "%USERPROFILE%\Downloads\caterpillar.png" (
    set "source_image=%USERPROFILE%\Downloads\caterpillar.png"
    set "image_found=true"
) else if exist "%USERPROFILE%\Desktop\caterpillar.png" (
    set "source_image=%USERPROFILE%\Desktop\caterpillar.png"
    set "image_found=true"
)

if "%image_found%"=="true" (
    echo Found caterpillar image at: %source_image%
    echo.
    echo Replacing app icons...
    
    copy "%source_image%" "assets\images\icon.png" >nul 2>&1
    if %errorlevel% equ 0 (echo ✓ Updated icon.png) else (echo ✗ Failed to update icon.png)
    
    copy "%source_image%" "assets\images\adaptive-icon.png" >nul 2>&1
    if %errorlevel% equ 0 (echo ✓ Updated adaptive-icon.png) else (echo ✗ Failed to update adaptive-icon.png)
    
    copy "%source_image%" "assets\images\favicon.png" >nul 2>&1
    if %errorlevel% equ 0 (echo ✓ Updated favicon.png) else (echo ✗ Failed to update favicon.png)
    
    copy "%source_image%" "assets\images\splash-icon.png" >nul 2>&1
    if %errorlevel% equ 0 (echo ✓ Updated splash-icon.png) else (echo ✗ Failed to update splash-icon.png)
    
    echo.
    echo ✓ All icons updated successfully!
    echo.
    echo Next steps:
    echo 1. Run: npx expo start --clear
    echo 2. Your caterpillar icon will appear in the app!
    
) else (
    echo ✗ Caterpillar image not found!
    echo.
    echo Please save your caterpillar image as one of:
    echo   - caterpillar.png (in this folder)
    echo   - %USERPROFILE%\Downloads\caterpillar.png
    echo   - %USERPROFILE%\Desktop\caterpillar.png
    echo.
    echo Then run this script again.
)

echo.
pause