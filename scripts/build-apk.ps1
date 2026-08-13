param(
  [ValidateSet("debug", "release")]
  [string]$BuildType = "release",

  [string]$VersionName,
  [int]$VersionCode,
  [switch]$Clean,
  [switch]$NoDesktopCopy
)

$ErrorActionPreference = "Stop"

# Marca o início para conseguir provar, no fim, que o APK é desta execução.
$startedAt = Get-Date

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$AndroidDir = Join-Path $RootDir "android"
$AppGradle = Join-Path $AndroidDir "app\build.gradle"
$DesktopDir = [Environment]::GetFolderPath("Desktop")
$DistDir = Join-Path $RootDir "dist\apk"

function Read-GradleValue {
  param(
    [string]$Content,
    [string]$Pattern,
    [string]$Fallback
  )

  $match = [regex]::Match($Content, $Pattern)
  if ($match.Success) {
    return $match.Groups[1].Value
  }

  return $Fallback
}

$gradleContent = Get-Content -LiteralPath $AppGradle -Raw

if ($VersionName) {
  $gradleContent = [regex]::Replace($gradleContent, 'versionName\s+"[^"]+"', "versionName `"$VersionName`"")
}

if ($VersionCode -gt 0) {
  $gradleContent = [regex]::Replace($gradleContent, 'versionCode\s+\d+', "versionCode $VersionCode")
}

if ($VersionName -or ($VersionCode -gt 0)) {
  Set-Content -LiteralPath $AppGradle -Value $gradleContent -Encoding UTF8
}

$versionName = Read-GradleValue -Content $gradleContent -Pattern 'versionName\s+"([^"]+)"' -Fallback "0.0"
$versionCode = Read-GradleValue -Content $gradleContent -Pattern 'versionCode\s+(\d+)' -Fallback "0"
$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$variant = if ($BuildType -eq "release") { "Release" } else { "Debug" }
$gradleTask = "assemble$variant"
$sourceApk = Join-Path $AndroidDir "app\build\outputs\apk\$BuildType\app-$BuildType.apk"
$apkName = "DetailGo-v$versionName-code$versionCode-$BuildType-$stamp.apk"
$distApk = Join-Path $DistDir $apkName
$desktopApk = Join-Path $DesktopDir $apkName

Write-Host "DetailGo APK Builder"
Write-Host "Build: $BuildType"
Write-Host "Version: $versionName ($versionCode)"
Write-Host ""

# $ErrorActionPreference não cobre código de saída de programa externo: se o
# Gradle falhar e ninguém checar $LASTEXITCODE, o script segue, encontra o APK
# da build anterior e o copia como se fosse novo — inclusive para a Área de
# Trabalho. Já aconteceu: um APK antigo foi distribuído achando que era o atual.
function Invoke-Gradle {
  param([string[]]$GradleArgs)

  & .\gradlew.bat @GradleArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Gradle falhou (exit $LASTEXITCODE) em: gradlew $($GradleArgs -join ' ')"
  }
}

Push-Location $AndroidDir
try {
  if ($Clean) {
    Write-Host "Cleaning previous Android build..."
    Invoke-Gradle @("clean")
  }

  Write-Host "Generating APK with Gradle task: $gradleTask"
  Invoke-Gradle @($gradleTask)
}
finally {
  Pop-Location
}

if (!(Test-Path -LiteralPath $sourceApk)) {
  throw "APK not found at: $sourceApk"
}

# Segunda rede de proteção: se o APK for anterior ao início desta execução, ele
# é de uma build passada e não deve ser publicado como novo.
$apkWrittenAt = (Get-Item -LiteralPath $sourceApk).LastWriteTime
if ($apkWrittenAt -lt $startedAt) {
  throw "APK em $sourceApk e de $apkWrittenAt, anterior ao inicio desta build ($startedAt). Build nao gerou APK novo."
}

New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
Copy-Item -LiteralPath $sourceApk -Destination $distApk -Force

Write-Host ""
Write-Host "APK generated:"
Write-Host $distApk

if (!$NoDesktopCopy) {
  Copy-Item -LiteralPath $sourceApk -Destination $desktopApk -Force
  Write-Host ""
  Write-Host "Desktop copy:"
  Write-Host $desktopApk
}

$apkInfo = Get-Item -LiteralPath $distApk
$sizeMb = [math]::Round($apkInfo.Length / 1MB, 2)
Write-Host ""
Write-Host "Size: $sizeMb MB"
Write-Host "Done."
