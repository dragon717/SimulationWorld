#Requires -Version 5.1
[CmdletBinding()]
param(
    [ValidateSet('Start', 'Update', 'Status', 'Stop')]
    [string]$Action = 'Start',

    [ValidateScript({
        $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
        $_.ToString() -ne '0.0.0.0' -and $_.ToString() -ne '255.255.255.255'
    })]
    [ipaddress]$BindAddress,

    [ValidateRange(1, 65535)]
    [int]$Port = 5184,

    [switch]$OpenBrowser
)

$ErrorActionPreference = 'Stop'
$runtime = Join-Path $PSScriptRoot '.runtime'
$cfg = Join-Path $PSScriptRoot 'upstream/SimulationWorld/cfg'

function Remove-ServerProcess($Process) {
    if ($Process.HasExited) { return }
    Stop-Process -InputObject $Process
    if (!$Process.WaitForExit(5000)) { throw "Server PID $($Process.Id) did not exit." }
}

function Read-World($Url, $Command = 'state') {
    $request = [System.Net.WebRequest]::Create("$Url/api/$Command")
    $request.Proxy = $null
    $request.Timeout = if ($Command -eq 'state') { 3000 } else { 60000 }
    if ($Command -ne 'state') {
        $request.Method = 'POST'
        $request.ContentLength = 0
    }
    $response = $request.GetResponse()
    try {
        $reader = [System.IO.StreamReader]::new($response.GetResponseStream())
        try {
            # Keep the Go engine's uint64 values exact in Windows PowerShell.
            ($reader.ReadToEnd() -replace '("(?:seed|state_hash)"\s*:\s*)(\d+)', '$1"$2"') | ConvertFrom-Json
        } finally { $reader.Dispose() }
    } finally { $response.Dispose() }
}

function Assert-World($Expected, $Actual) {
    if ($Actual.seed -ne $Expected.seed -or $Actual.tick -ne $Expected.tick -or
        $Actual.state_hash -ne $Expected.state_hash) {
        throw 'The world state does not match the saved seed, tick and hash.'
    }
}

function Show-Server($Server) {
    $Server
    if ($OpenBrowser) { Start-Process -FilePath $Server.Url }
}

function Start-Release($Directory, $Address, $ServerPort, $Expected = $null) {
    $url = "http://${Address}:$ServerPort"
    $binary = Join-Path $Directory 'ecosim.exe'
    $site = Join-Path $Directory 'site'
    $seed = if ($Expected) { $Expected.seed } else { '0' }
    $arguments = '-addr {0}:{1} -cfg "{2}" -client "{3}" -seed {4}' -f $Address, $ServerPort, $cfg, $site, $seed
    $process = Start-Process -FilePath $binary -ArgumentList $arguments -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru
    try {
        $state = $null
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            if ($process.HasExited) { throw "Server exited with code $($process.ExitCode) at $url." }
            try { $state = Read-World $url; break } catch [System.Net.WebException] { Start-Sleep -Milliseconds 150 }
        }
        $listener = Get-NetTCPConnection -LocalAddress $Address -LocalPort $ServerPort -State Listen -ErrorAction SilentlyContinue
        if (!$state -or $listener.OwningProcess -ne $process.Id) { throw "Server did not become ready at $url." }
        if ($Expected) {
            if ($state.tick -eq 0 -and $state.seed -ne $Expected.seed) {
                $state = Read-World $url "reset?seed=$($Expected.seed)"
            }
            if ($state.seed -eq $Expected.seed -and $state.tick -lt $Expected.tick) {
                $state = Read-World $url "run?n=$($Expected.tick - $state.tick)"
            }
            Assert-World $Expected $state
        }
        [PSCustomObject]@{ Url = $url; PID = $process.Id; Seed = $state.seed; Tick = $state.tick; Hash = $state.state_hash }
    } catch {
        Remove-ServerProcess $process
        throw
    }
}

Push-Location -LiteralPath $PSScriptRoot
$lock = $null
try {
    if ($Action -ne 'Status') {
        $null = New-Item -ItemType Directory -Path $runtime -Force
        $lock = [System.IO.File]::Open((Join-Path $runtime 'windows-deploy.lock'), 'OpenOrCreate', 'Write', 'None')
    }
    $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    $previous = $null
    if ($listeners.Count -gt 0) {
        if ($listeners.Count -ne 1) { throw "Multiple listeners are using port $Port." }
        $previous = Get-Process -Id $listeners[0].OwningProcess
        $path = $previous.Path
        if (!$path -or !$path.StartsWith("$runtime\", [StringComparison]::OrdinalIgnoreCase) -or
            $previous.ProcessName -ne 'ecosim') {
            throw "Port $Port is in use by $($previous.ProcessName) (PID $($previous.Id))."
        }
        $previousAddress = $listeners[0].LocalAddress
        $previousUrl = "http://${previousAddress}:$Port"
    }

    if ($Action -eq 'Status' -or ($Action -eq 'Start' -and $previous -and
        (!$BindAddress -or $BindAddress.ToString() -eq $previousAddress))) {
        if (!$previous) { Write-Output "SimulationWorld is stopped on port $Port."; return }
        $state = Read-World $previousUrl
        Show-Server ([PSCustomObject]@{ Url = $previousUrl; PID = $previous.Id; Seed = $state.seed; Tick = $state.tick; Hash = $state.state_hash })
        return
    }
    if ($Action -eq 'Stop') {
        if ($previous) { Remove-ServerProcess $previous }
        Write-Output "SimulationWorld is stopped on port $Port."
        return
    }

    $address = if ($BindAddress) { $BindAddress.ToString() } elseif ($previous) { $previousAddress } else { '127.0.0.1' }
    if (!(Get-NetIPAddress -AddressFamily IPv4 -IPAddress $address -ErrorAction SilentlyContinue)) {
        throw "IPv4 address $address is not assigned to this computer."
    }
    Get-Command git, go, python, npm.cmd | Out-Null
    if ($Action -eq 'Update') {
        git pull --ff-only
        if ($LASTEXITCODE -ne 0) { throw 'git pull failed.' }
        npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
    }

    $revision = git rev-parse --short HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Could not read the current Git revision.' }
    $release = Join-Path $runtime "windows-$Port-$revision"
    if ($previous -and $previous.Path -eq (Join-Path $release 'ecosim.exe')) { $release += '-next' }
    $prepare = "import sys; from pathlib import Path; import backend; backend.SITE = Path(sys.argv[1]) / 'site'; backend.BINARY = backend.SITE.parent / backend.BINARY.name; backend.prepare()"
    python -c $prepare $release
    if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
    if (!$previous) { Show-Server (Start-Release $release $address $Port); return }

    $saved = Read-World $previousUrl
    $probe = [System.Net.Sockets.TcpListener]::new([ipaddress]::Loopback, 0)
    $probe.Start()
    try { $probePort = $probe.LocalEndpoint.Port } finally { $probe.Stop() }
    $trial = Start-Release $release '127.0.0.1' $probePort $saved
    Remove-ServerProcess (Get-Process -Id $trial.PID)
    Assert-World $saved (Read-World $previousUrl)
    $previousDirectory = Split-Path -Parent $previous.Path
    Remove-ServerProcess $previous
    try { $server = Start-Release $release $address $Port $saved } catch {
        Start-Release $previousDirectory $previousAddress $Port $saved | Out-Host
        throw
    }
    Show-Server $server
} finally {
    if ($lock) { $lock.Dispose() }
    Pop-Location
}
