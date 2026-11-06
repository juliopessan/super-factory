param(
  [Parameter(Position = 0)]
  [ValidateSet('definir', 'remover', 'listar', 'iniciar')]
  [string]$Acao = 'listar',
  [Parameter(Position = 1)]
  [string]$Nome
)

$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'O cofre requer Windows e PowerShell 7.' }
if (-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA nao esta definido.' }
$nomesPermitidos = @(
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'GITHUB_TOKEN',
  'AZURE_DEVOPS_PAT'
)
$diretorioCofre = Join-Path $env:LOCALAPPDATA 'SuperFactory\cofre'

function CaminhoSegredo([string]$nomeSegredo) {
  if ($nomeSegredo -cnotin $nomesPermitidos) {
    throw 'Credencial nao reconhecida. Use o comando listar para ver os nomes permitidos.'
  }
  return Join-Path $diretorioCofre "$nomeSegredo.txt"
}

function SalvarSegredo([string]$nomeSegredo, [securestring]$segredo) {
  $caminho = CaminhoSegredo $nomeSegredo
  if ($segredo.Length -eq 0) { throw 'A credencial nao pode estar vazia.' }
  [void][System.IO.Directory]::CreateDirectory($diretorioCofre)
  $segredo | ConvertFrom-SecureString | Set-Content -LiteralPath $caminho -Encoding ascii
}

function CarregarSegredos {
  foreach ($nomeSegredo in $nomesPermitidos) {
    $caminho = CaminhoSegredo $nomeSegredo
    if (-not (Test-Path -LiteralPath $caminho -PathType Leaf)) { continue }
    if ($nomeSegredo -ne 'GITHUB_TOKEN' -and [Environment]::GetEnvironmentVariable($nomeSegredo, 'Process')) { continue }
    $seguro = (Get-Content -LiteralPath $caminho -Raw).Trim() | ConvertTo-SecureString
    $ponteiro = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)
    try {
      [Environment]::SetEnvironmentVariable($nomeSegredo, [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ponteiro), 'Process')
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ponteiro)
      $seguro.Dispose()
    }
  }
}

if ($MyInvocation.InvocationName -ne '.') {
  switch ($Acao) {
    'definir' {
      [void](CaminhoSegredo $Nome)
      $segredo = Read-Host "Informe $Nome" -AsSecureString
      try { SalvarSegredo $Nome $segredo } finally { $segredo.Dispose() }
      Write-Host 'Credencial salva no cofre do usuario Windows.'
    }
    'remover' {
      $caminho = CaminhoSegredo $Nome
      if (Test-Path -LiteralPath $caminho -PathType Leaf) { Remove-Item -LiteralPath $caminho }
      Write-Host 'Credencial removida do cofre.'
    }
    'listar' {
      foreach ($nomeSegredo in $nomesPermitidos) {
        $situacao = if (Test-Path -LiteralPath (CaminhoSegredo $nomeSegredo) -PathType Leaf) { 'salva' } else { 'nao configurada' }
        Write-Host "${nomeSegredo}: $situacao"
      }
    }
    'iniciar' {
      CarregarSegredos
      $env:MASTRA_AUTO_DETECT_URL = 'true'
      & (Join-Path $PSScriptRoot '..\..\node_modules\.bin\mastra.cmd') dev
      exit $LASTEXITCODE
    }
  }
}