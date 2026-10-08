param(
  [Parameter(Mandatory=$true)][string]$Manifest,
  [string]$Project = "treino-louise",
  [string]$Bucket = "treino-louise-private-diets"
)
$ErrorActionPreference = 'Stop'
# Manifest contains rendered page folders, never credentials or original PDF URLs.
$items = Get-Content -LiteralPath $Manifest -Raw | ConvertFrom-Json
$stage = Join-Path (Split-Path -Parent (Resolve-Path -LiteralPath $Manifest)) 'upload/diet-documents'
New-Item -ItemType Directory -Path $stage -Force | Out-Null
foreach ($item in $items) {
  if ($item.documentId -notmatch '^[a-f0-9]{32}$' -or $item.kind -notin @('diet','recipe') -or $item.pageCount -lt 1 -or $item.pageCount -gt 100) { throw 'Manifesto inválido' }
  $dest = Join-Path $stage $item.documentId
  New-Item -ItemType Directory -Path $dest -Force | Out-Null
  foreach ($page in 1..$item.pageCount) {
    Copy-Item -LiteralPath (Join-Path $item.folder "$page.png") -Destination (Join-Path $dest "$page.png")
  }
}
# Private bucket used by the existing authenticated API page reader.
gcloud storage cp --recursive $stage "gs://$Bucket/" --project=$Project --quiet
if ($LASTEXITCODE -ne 0) { throw 'Falha no envio das páginas privadas; nenhum cadastro realizado.' }
$access = (gcloud auth print-access-token).Trim()
if ($LASTEXITCODE -ne 0 -or !$access) { throw 'Autenticação Google indisponível' }
$db = "https://firestore.googleapis.com/v1/projects/$Project/databases/(default)/documents"
$writes = @()
foreach ($item in $items) {
  $fields = @{
    name = @{stringValue=$item.name}
    studentId = @{stringValue=''}
    kind = @{stringValue=$item.kind}
    description = @{stringValue= $(if($item.kind -eq 'recipe') {'Receita disponível para todos os alunos.'} else {'Plano alimentar em PDF. Associar ao aluno pela gestão.'})}
    document = @{mapValue=@{fields=@{id=@{stringValue=$item.documentId};pageCount=@{integerValue=[string]$item.pageCount}}}}
    createdAt = @{timestampValue=[DateTimeOffset]::UtcNow.ToString('o')}
    updatedAt = @{timestampValue=[DateTimeOffset]::UtcNow.ToString('o')}
  }
  $writes += @{update=@{name="projects/$Project/databases/(default)/documents/diets/$($item.id)";fields=$fields};currentDocument=@{exists=$false}}
}
# Create-only, deterministic IDs: repeat runs do not overwrite existing data.
$body = @{writes=$writes} | ConvertTo-Json -Depth 20 -Compress
$result = Invoke-RestMethod -Method Post -Uri ($db+':batchWrite') -Headers @{Authorization="Bearer $access";'x-goog-user-project'=$Project} -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
for ($i=0; $i -lt $items.Count; $i++) {
  $status = $result.status[$i]
  if ($status.code -and $status.code -ne 6) { throw "Falha no cadastro de $($items[$i].name): $($status.message)" }
  Write-Output "$($items[$i].kind): $($items[$i].name) — $($items[$i].pageCount) página(s)"
}
