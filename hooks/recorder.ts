// Records the default microphone through Windows' built-in winmm (MCI) API,
// so nothing has to be installed. Prints RECORDING once capture runs and
// SAVED once the WAV is written; stops when the stop file appears or after
// MaxSeconds. MCI commands are capped at 128 characters, so a long output
// path is saved under the temp folder first and moved afterwards.
export const RECORD_SCRIPT = `param([string]$Out, [string]$Stop, [int]$MaxSeconds = 600)
$ErrorActionPreference = 'Stop'
Add-Type -Namespace ClaudeDictation -Name Mci -MemberDefinition @'
[DllImport("winmm.dll", CharSet = CharSet.Unicode)]
public static extern int mciSendString(string command, System.Text.StringBuilder buffer, int bufferSize, System.IntPtr callback);
[DllImport("winmm.dll", CharSet = CharSet.Unicode)]
public static extern bool mciGetErrorString(int error, System.Text.StringBuilder buffer, int bufferSize);
'@
function Send-Mci([string]$Command) {
  $code = [ClaudeDictation.Mci]::mciSendString($Command, $null, 0, [IntPtr]::Zero)
  if ($code -ne 0) {
    $buffer = New-Object System.Text.StringBuilder 256
    [void][ClaudeDictation.Mci]::mciGetErrorString($code, $buffer, 256)
    throw ('MCI "' + $Command + '": ' + $buffer.ToString())
  }
}
function Close-Recorder { [void][ClaudeDictation.Mci]::mciSendString('close clauderec', $null, 0, [IntPtr]::Zero) }
$folder = Split-Path -Parent $Out
Get-ChildItem -LiteralPath $folder -File -ErrorAction SilentlyContinue |
  Where-Object { ($_.Extension -eq '.wav' -or $_.Extension -eq '.stop') -and $_.LastWriteTime -lt (Get-Date).AddHours(-1) } |
  Remove-Item -Force -ErrorAction SilentlyContinue
Close-Recorder
Send-Mci 'open new type waveaudio alias clauderec'
try {
  try { Send-Mci 'set clauderec bitspersample 16 channels 1 samplespersec 16000 bytespersec 32000 alignment 2' } catch { }
  Send-Mci 'record clauderec'
  [Console]::Out.WriteLine('RECORDING')
  $clock = [Diagnostics.Stopwatch]::StartNew()
  while (-not (Test-Path -LiteralPath $Stop) -and $clock.Elapsed.TotalSeconds -lt $MaxSeconds) { Start-Sleep -Milliseconds 60 }
  Send-Mci 'stop clauderec'
  $target = $Out
  if ($target.Length -gt 100) { $target = Join-Path ([IO.Path]::GetTempPath()) ('cdr' + $PID + '.wav') }
  Send-Mci ('save clauderec "' + $target + '"')
  Close-Recorder
  if ($target -ne $Out) { Move-Item -LiteralPath $target -Destination $Out -Force }
  [Console]::Out.WriteLine('SAVED')
} finally {
  Close-Recorder
  Remove-Item -LiteralPath $Stop -Force -ErrorAction SilentlyContinue
}
`
