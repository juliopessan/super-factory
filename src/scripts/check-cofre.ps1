$ErrorActionPreference = 'Stop'
$localOriginal = $env:LOCALAPPDATA
$tokenOriginal = $env:GITHUB_TOKEN
$googleOriginal = $env:GOOGLE_API_KEY
$diretorioTeste = Join-Path $env:TEMP ([guid]::NewGuid().ToString())

try {
  $env:LOCALAPPDATA = $diretorioTeste
  Remove-Item Env:GITHUB_TOKEN -ErrorAction SilentlyContinue
  . (Join-Path $PSScriptRoot 'cofre.ps1')

  $segredo = ConvertTo-SecureString 'credencial-ficticia' -AsPlainText -Force
  try { SalvarSegredo 'GITHUB_TOKEN' $segredo } finally { $segredo.Dispose() }
  if ((Get-Content -LiteralPath (CaminhoSegredo 'GITHUB_TOKEN') -Raw) -match 'credencial-ficticia') {
    throw 'Credencial salva em texto aberto.'
  }
  CarregarSegredos
  if ($env:GITHUB_TOKEN -ne 'credencial-ficticia') { throw 'Falha ao carregar credencial.' }

  $env:GITHUB_TOKEN = 'precedencia-ambiente'
  CarregarSegredos
  if ($env:GITHUB_TOKEN -ne 'credencial-ficticia') { throw 'O token do cofre nao substituiu o token herdado.' }

  $segredoGoogle = ConvertTo-SecureString 'google-ficticia' -AsPlainText -Force
  try { SalvarSegredo 'GOOGLE_API_KEY' $segredoGoogle } finally { $segredoGoogle.Dispose() }
  $env:GOOGLE_API_KEY = 'precedencia-ambiente'
  CarregarSegredos
  if ($env:GOOGLE_API_KEY -ne 'precedencia-ambiente') { throw 'Outra variavel de ambiente foi substituida.' }

  $rejeitado = $false
  try { [void](CaminhoSegredo '../invalido') } catch { $rejeitado = $true }
  if (-not $rejeitado) { throw 'Nome invalido aceito.' }

  Write-Host 'Cofre: criptografia, leitura, precedencia e validacao OK.'
} finally {
  $env:LOCALAPPDATA = $localOriginal
  $env:GITHUB_TOKEN = $tokenOriginal
  $env:GOOGLE_API_KEY = $googleOriginal
  if (Test-Path -LiteralPath $diretorioTeste) { Remove-Item -LiteralPath $diretorioTeste -Recurse -Force }
}