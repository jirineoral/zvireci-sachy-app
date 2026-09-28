# Lesson video: Windows SAPI text-to-speech (Czech voice "Microsoft Jakub").
# Input: a JSON array of { "text": "...", "out": "C:\\...\\hash.wav" }; existing files are
# skipped (build.mjs names them by a hash of voice + rate + text, so they form a cache).
# Output: 44.1 kHz, 16-bit, mono PCM WAV.
param(
  [Parameter(Mandatory = $true)][string]$JobsPath,
  [string]$Voice = 'Microsoft Jakub',
  [int]$Rate = -1
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech

$jobs = Get-Content -Raw -Encoding UTF8 -Path $JobsPath | ConvertFrom-Json
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $synth.SelectVoice($Voice)
} catch {
  $names = ($synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }) -join ', '
  throw "Voice '$Voice' is not installed. Installed voices: $names"
}
$synth.Rate = $Rate
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(44100, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)

$made = 0
foreach ($job in @($jobs)) {
  if (Test-Path -LiteralPath $job.out) { continue }
  $tmp = "$($job.out).part"
  $synth.SetOutputToWaveFile($tmp, $format)
  $synth.Speak([string]$job.text)
  $synth.SetOutputToNull()
  Move-Item -LiteralPath $tmp -Destination $job.out -Force
  $made++
}
$synth.Dispose()
Write-Host "tts: $made new, $(@($jobs).Count - $made) cached"
