$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$source = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'AgentDockDesktop.cs') -Raw
$nodePath = $env:AGENTDOCK_NODE_PATH
if (-not $nodePath) { throw 'Node executable path was not provided by npm install.' }
$source = $source.Replace('__NODE_PATH__', $nodePath.Replace('"','""'))
$references = @('System.Windows.Forms.dll','System.Drawing.dll','System.dll','System.Core.dll')
if ($env:AGENTDOCK_LAUNCHER_CHECK -eq '1') {
    Add-Type -TypeDefinition $source -ReferencedAssemblies $references
    Write-Output 'Launcher C# compiled in memory; no executable was created.'
    exit 0
}
$destination = Join-Path $projectRoot 'agentdock.exe'
# This exact generated file is the only replacement target.
if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Force }
Add-Type -TypeDefinition $source -ReferencedAssemblies $references -OutputAssembly $destination -OutputType WindowsApplication
Write-Output ('Created ' + $destination)
