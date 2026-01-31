# Download TFLite model from Roboflow
# Get your API key from: https://app.roboflow.com/settings/api

$API_KEY = Read-Host "Enter your Roboflow API key"
$url = "https://api.roboflow.com/buglord/buglord-insect-detection/2/tflite?api_key=$API_KEY"
$zipFile = "assets\ml\model.zip"
$outputDir = "assets\ml"

Write-Host "Downloading TFLite model from Roboflow..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $url -OutFile $zipFile

Write-Host "Extracting model..." -ForegroundColor Cyan
Expand-Archive -Path $zipFile -DestinationPath $outputDir -Force

# Find and rename the model file
$tfliteFile = Get-ChildItem -Path $outputDir -Filter "*.tflite" -Recurse | Select-Object -First 1
if ($tfliteFile) {
    Copy-Item $tfliteFile.FullName -Destination "$outputDir\insect_detector.tflite" -Force
    Write-Host "Model installed successfully at: $outputDir\insect_detector.tflite" -ForegroundColor Green
} else {
    Write-Host "Error: No .tflite file found in the downloaded archive" -ForegroundColor Red
}

# Clean up
Remove-Item $zipFile -Force -ErrorAction SilentlyContinue

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Run: npx expo prebuild --clean" -ForegroundColor White
Write-Host "2. Run: npm run android" -ForegroundColor White
