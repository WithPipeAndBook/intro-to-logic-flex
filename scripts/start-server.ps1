param(
  [int]$Port = 5173
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$prefix = "http://localhost:$Port/"
$contentRoot = Join-Path $root 'content'
$lessonRoot = Join-Path $contentRoot 'lessons'
$assetRoot = Join-Path $contentRoot 'assets'
$coursePath = Join-Path $contentRoot 'course.json'
$quizSeedPath = Join-Path $contentRoot 'quiz-seed.json'
$authorConfigPath = Join-Path $root 'config\authoring.json'
$sessions = @{}
$mimeTypes = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.md' = 'text/markdown; charset=utf-8'; '.json' = 'application/json; charset=utf-8'; '.svg' = 'image/svg+xml'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.gif' = 'image/gif'; '.webp' = 'image/webp'
}

function Send-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$StatusText,
    [string]$ContentType,
    [byte[]]$Body,
    [hashtable]$ExtraHeaders = @{}
  )

  $header = "HTTP/1.1 $StatusCode $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nConnection: close`r`n"
  foreach ($key in $ExtraHeaders.Keys) { $header += "${key}: $($ExtraHeaders[$key])`r`n" }
  $header += "`r`n"
  $headerBytes = [Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($Body.Length) { $Stream.Write($Body, 0, $Body.Length) }
}

function Send-Text { param($Stream, $StatusCode, $StatusText, $Text, $Headers = @{}) Send-Response $Stream $StatusCode $StatusText 'text/plain; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes($Text)) $Headers }
function Send-Json { param($Stream, $StatusCode, $Data, $Headers = @{}) Send-Response $Stream $StatusCode 'OK' 'application/json; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes(($Data | ConvertTo-Json -Depth 32 -Compress))) $Headers }
function Get-JsonFile { param([string]$Path) Get-Content -Raw $Path | ConvertFrom-Json }
function Write-JsonFile {
  param([string]$Path, $Data)
  $temp = "$Path.$([guid]::NewGuid().ToString('N')).tmp"
  [IO.File]::WriteAllText($temp, ($Data | ConvertTo-Json -Depth 32), [Text.UTF8Encoding]::new($false))
  if (Test-Path $Path) {
    $backup = "$Path.bak"
    if (Test-Path $backup) { Remove-Item -LiteralPath $backup -Force }
    [IO.File]::Replace($temp, $Path, $backup)
    Remove-Item -LiteralPath $backup -Force
  } else { [IO.File]::Move($temp, $Path) }
}
function New-ContentId { return [guid]::NewGuid().ToString('N') }
function Escape-Html {
  param([string]$Value)
  return ($Value -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;')
}
function Convert-MarkdownToHtml {
  param([string]$Markdown)
  $parts = New-Object System.Collections.Generic.List[string]
  $listOpen = $false
  foreach ($raw in ($Markdown -split "`r?`n")) {
    $line = $raw.Trim()
    if (-not $line) { if ($listOpen) { $parts.Add('</ul>'); $listOpen = $false }; continue }
    if ($line -match '^###\s+(.+)$') { if ($listOpen) { $parts.Add('</ul>'); $listOpen = $false }; $parts.Add("<h3>$(Escape-Html $Matches[1])</h3>"); continue }
    if ($line -match '^####\s+(.+)$') { if ($listOpen) { $parts.Add('</ul>'); $listOpen = $false }; $parts.Add("<h4>$(Escape-Html $Matches[1])</h4>"); continue }
    if ($line -match '^[-*]\s+(.+)$') { if (-not $listOpen) { $parts.Add('<ul>'); $listOpen = $true }; $parts.Add("<li>$(Escape-Html $Matches[1])</li>"); continue }
    if ($listOpen) { $parts.Add('</ul>'); $listOpen = $false }
    $escaped = Escape-Html $line
    $escaped = $escaped -replace '\*\*(.+?)\*\*', '<strong>$1</strong>' -replace '\*(.+?)\*', '<em>$1</em>'
    $parts.Add("<p>$escaped</p>")
  }
  if ($listOpen) { $parts.Add('</ul>') }
  return ($parts -join "`n")
}
function Convert-MarkdownLesson {
  param($Entry, $QuizSeed)
  $sourcePath = Join-Path $root $Entry.markdownSource
  $markdown = Get-Content -Raw $sourcePath
  $markdown = $markdown -replace '(?s)^---.*?---\s*', ''
  $markdown = $markdown -replace '(?m)^#\s+.*\r?\n+', ''
  $matches = [regex]::Matches($markdown, '(?m)^##\s+(.+?)\s*$')
  $tabs = New-Object System.Collections.Generic.List[object]
  if ($matches.Count -eq 0) {
    $tabs.Add([pscustomobject]@{ id = 'reading'; title = 'Reading'; containers = @([pscustomobject]@{ id = 'reading'; title = 'Reading'; blocks = @([pscustomobject]@{ id = (New-ContentId); type = 'richText'; html = (Convert-MarkdownToHtml $markdown) }) }) })
  } else {
    for ($index = 0; $index -lt $matches.Count; $index += 1) {
      $heading = $matches[$index].Groups[1].Value.Trim()
      $start = $matches[$index].Index + $matches[$index].Length
      $end = if ($index + 1 -lt $matches.Count) { $matches[$index + 1].Index } else { $markdown.Length }
      $section = $markdown.Substring($start, $end - $start).Trim()
      $tabId = (($heading.ToLowerInvariant() -replace '[^a-z0-9]+', '-') -replace '^-|-$', '')
      $tabs.Add([pscustomobject]@{ id = $tabId; title = $heading; containers = @([pscustomobject]@{ id = "${tabId}-content"; title = $heading; blocks = @([pscustomobject]@{ id = (New-ContentId); type = 'richText'; html = (Convert-MarkdownToHtml $section) }) }) })
    }
  }
  if ($QuizSeed -and $QuizSeed.PSObject.Properties.Name -contains $Entry.id) {
    $blocks = @()
    foreach ($question in $QuizSeed.$($Entry.id)) {
      $blocks += [pscustomobject]@{ id = (New-ContentId); type = 'quiz'; quizType = $question.type; prompt = $question.prompt; context = $question.context; choices = @($question.choices); answer = $question.answer; explanation = '' }
    }
    $tabs.Add([pscustomobject]@{ id = 'training'; title = 'Training'; containers = @([pscustomobject]@{ id = 'vocabulary-practice'; title = 'Vocabulary Practice'; blocks = $blocks }) })
  }
  if ($Entry.id -eq 'symbolization-well-formed-formulas') {
    $tabs.Add([pscustomobject]@{ id = 'training'; title = 'Training'; containers = @([pscustomobject]@{ id = 'well-formed-formulas'; title = 'Well-Formed Formula Practice'; blocks = @([pscustomobject]@{ id = (New-ContentId); type = 'legacySymbolizing'; title = 'Well-Formed Formula Practice'; instructions = 'The original Well-Formed Formula activity remains reserved here while the new interactive block system grows.' }) }) })
  }
  $content = [pscustomobject]@{ tabs = $tabs.ToArray() }
  return [pscustomobject]@{ id = $Entry.id; chapterId = $Entry.chapterId; lessonNumber = $Entry.lessonNumber; title = $Entry.title; summary = $Entry.summary; draft = $content; published = ($content | ConvertTo-Json -Depth 32 | ConvertFrom-Json); updatedAt = (Get-Date).ToUniversalTime().ToString('o'); publishedAt = (Get-Date).ToUniversalTime().ToString('o') }
}
function Initialize-Lessons {
  New-Item -ItemType Directory -Force -Path $lessonRoot, $assetRoot | Out-Null
  $course = Get-JsonFile $coursePath
  $quizSeed = if (Test-Path $quizSeedPath) { Get-JsonFile $quizSeedPath } else { $null }
  foreach ($entry in $course.lessons) {
    $path = Join-Path $lessonRoot "$($entry.id).json"
    if (-not (Test-Path $path)) { Write-JsonFile $path (Convert-MarkdownLesson $entry $quizSeed) }
  }
}
function Read-Request {
  param([System.IO.StreamReader]$Reader)
  $line = $Reader.ReadLine()
  if ([string]::IsNullOrWhiteSpace($line)) { return $null }
  $parts = $line.Split(' ')
  $headers = @{}
  while ($true) {
    $header = $Reader.ReadLine()
    if ($null -eq $header -or $header.Length -eq 0) { break }
    $separator = $header.IndexOf(':')
    if ($separator -gt 0) { $headers[$header.Substring(0, $separator).Trim().ToLowerInvariant()] = $header.Substring($separator + 1).Trim() }
  }
  $body = ''
  if ($headers.ContainsKey('content-length')) {
    $length = [int]$headers['content-length']
    if ($length -gt 15728640) { throw 'Request body is too large.' }
    $builder = [Text.StringBuilder]::new()
    $byteCount = 0
    while ($byteCount -lt $length) {
      $next = $Reader.Read()
      if ($next -lt 0) { break }
      $character = [char]$next
      [void]$builder.Append($character)
      $byteCount += [Text.Encoding]::UTF8.GetByteCount([string]$character)
    }
    $body = $builder.ToString()
  }
  return [pscustomobject]@{ method = $parts[0].ToUpperInvariant(); target = $parts[1]; headers = $headers; body = $body }
}
function Get-RequestPath { param($Request) return ([uri]("http://localhost" + $Request.target)).AbsolutePath }
function Get-CookieValue { param($Request, [string]$Name) if (-not $Request.headers.ContainsKey('cookie')) { return $null }; foreach ($part in $Request.headers.cookie.Split(';')) { $pair = $part.Trim().Split('=', 2); if ($pair.Length -eq 2 -and $pair[0] -eq $Name) { return $pair[1] } }; return $null }
function Test-Author { param($Request) $token = Get-CookieValue $Request 'eagle_logic_author'; if (-not $token -or -not $sessions.ContainsKey($token)) { return $false }; if ($sessions[$token] -lt (Get-Date)) { $sessions.Remove($token); return $false }; return $true }
function Get-PasswordHash { param([string]$Value) $sha = [Security.Cryptography.SHA256]::Create(); return (($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value)) | ForEach-Object { $_.ToString('x2') }) -join '') }
function Get-LessonPath { param([string]$LessonId) if ($LessonId -notmatch '^[a-z0-9-]+$') { throw 'Invalid lesson identifier.' }; return (Join-Path $lessonRoot "$LessonId.json") }
function Test-LessonDocument {
  param($Document, [string]$LessonId)
  if ($Document.id -ne $LessonId -or [string]::IsNullOrWhiteSpace($Document.title) -or -not $Document.draft.tabs) { throw 'Lesson metadata and at least one draft tab are required.' }
  foreach ($tab in $Document.draft.tabs) {
    if ([string]::IsNullOrWhiteSpace($tab.id) -or [string]::IsNullOrWhiteSpace($tab.title) -or -not $tab.containers) { throw 'Every tab requires an identifier, title, and container.' }
    foreach ($container in $tab.containers) {
      if ([string]::IsNullOrWhiteSpace($container.title) -or -not $container.blocks) { throw 'Every container requires a title and block.' }
      foreach ($block in $container.blocks) {
        if ($block.type -notin @('richText', 'image', 'quiz', 'interactivePlaceholder', 'legacySymbolizing')) { throw 'Unsupported block type.' }
        if ($block.type -eq 'richText' -and (($block.html -as [string]) -match '(?i)<\s*(script|iframe|object|embed|style)')) { throw 'Unsafe rich text.' }
        if ($block.type -eq 'image' -and ([string]::IsNullOrWhiteSpace($block.src) -or [string]::IsNullOrWhiteSpace($block.alt))) { throw 'Images require a source and alt text.' }
        if ($block.type -eq 'quiz' -and ([string]::IsNullOrWhiteSpace($block.quizType) -or [string]::IsNullOrWhiteSpace($block.prompt) -or [string]::IsNullOrWhiteSpace($block.answer))) { throw 'Quiz blocks require type, prompt, and answer.' }
      }
    }
  }
}
function Handle-Api {
  param($Stream, $Request, [string]$Path)
  if ($Request.method -eq 'GET' -and $Path -eq '/api/course') { Send-Json $Stream 200 (Get-JsonFile $coursePath); return $true }
  if ($Request.method -eq 'GET' -and $Path -match '^/api/lessons/([a-z0-9-]+)$') {
    $path = Get-LessonPath $Matches[1]; if (-not (Test-Path $path)) { Send-Text $Stream 404 'Not Found' 'Lesson not found.'; return $true }
    $doc = Get-JsonFile $path; Send-Json $Stream 200 ([pscustomobject]@{ id = $doc.id; chapterId = $doc.chapterId; lessonNumber = $doc.lessonNumber; title = $doc.title; summary = $doc.summary; published = $doc.published; publishedAt = $doc.publishedAt }); return $true
  }
  if ($Path -eq '/api/author/login' -and $Request.method -eq 'POST') {
    $payload = $Request.body | ConvertFrom-Json; $config = Get-JsonFile $authorConfigPath
    if ((Get-PasswordHash ([string]$payload.password)) -ne $config.passwordHash) { Send-Text $Stream 401 'Unauthorized' 'Incorrect author password.'; return $true }
    $token = New-ContentId; $sessions[$token] = (Get-Date).AddHours(8); Send-Json $Stream 200 ([pscustomobject]@{ ok = $true }) @{ 'Set-Cookie' = "eagle_logic_author=$token; Path=/; HttpOnly; SameSite=Strict" }; return $true
  }
  if ($Path -eq '/api/author/logout' -and $Request.method -eq 'POST') { $token = Get-CookieValue $Request 'eagle_logic_author'; if ($token) { $sessions.Remove($token) }; Send-Json $Stream 200 ([pscustomobject]@{ ok = $true }) @{ 'Set-Cookie' = 'eagle_logic_author=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict' }; return $true }
  if (-not (Test-Author $Request)) { Send-Text $Stream 401 'Unauthorized' 'Author sign-in required.'; return $true }
  if ($Path -eq '/api/author/lessons' -and $Request.method -eq 'GET') { $docs = @(Get-ChildItem $lessonRoot -Filter '*.json' | ForEach-Object { Get-JsonFile $_.FullName }); Send-Json $Stream 200 $docs; return $true }
  if ($Path -match '^/api/author/lessons/([a-z0-9-]+)$') {
    $lessonId = $Matches[1]; $path = Get-LessonPath $lessonId
    if ($Request.method -eq 'GET') { if (-not (Test-Path $path)) { Send-Text $Stream 404 'Not Found' 'Lesson not found.' } else { Send-Json $Stream 200 (Get-JsonFile $path) }; return $true }
    if ($Request.method -eq 'PUT') { $doc = $Request.body | ConvertFrom-Json; Test-LessonDocument $doc $lessonId; $doc.updatedAt = (Get-Date).ToUniversalTime().ToString('o'); if (-not $doc.published) { $doc | Add-Member -NotePropertyName published -NotePropertyValue $null }; Write-JsonFile $path $doc; Send-Json $Stream 200 $doc; return $true }
  }
  if ($Path -match '^/api/author/lessons/([a-z0-9-]+)/publish$' -and $Request.method -eq 'POST') {
    $path = Get-LessonPath $Matches[1]; if (-not (Test-Path $path)) { Send-Text $Stream 404 'Not Found' 'Lesson not found.'; return $true }; $doc = Get-JsonFile $path; $doc.published = ($doc.draft | ConvertTo-Json -Depth 32 | ConvertFrom-Json); $doc.publishedAt = (Get-Date).ToUniversalTime().ToString('o'); Write-JsonFile $path $doc; $course = Get-JsonFile $coursePath; $entry = $course.lessons | Where-Object id -eq $doc.id | Select-Object -First 1; if ($entry) { $entry.chapterId = $doc.chapterId; $entry.lessonNumber = $doc.lessonNumber; $entry.title = $doc.title; $entry.summary = $doc.summary } else { $course.lessons += [pscustomobject]@{ id = $doc.id; chapterId = $doc.chapterId; lessonNumber = $doc.lessonNumber; title = $doc.title; summary = $doc.summary; markdownSource = '' } }; Write-JsonFile $coursePath $course; Send-Json $Stream 200 $doc; return $true
  }
  if ($Path -eq '/api/author/assets' -and $Request.method -eq 'POST') {
    $payload = $Request.body | ConvertFrom-Json; $extension = [IO.Path]::GetExtension([string]$payload.name).ToLowerInvariant(); $allowed = @{ '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.gif'='image/gif'; '.webp'='image/webp' }
    if (-not $allowed.ContainsKey($extension) -or $payload.type -ne $allowed[$extension]) { Send-Text $Stream 400 'Bad Request' 'Use a PNG, JPEG, GIF, or WebP image.'; return $true }
    $bytes = [Convert]::FromBase64String([string]$payload.data); if ($bytes.Length -gt 10485760) { Send-Text $Stream 400 'Bad Request' 'Images must be 10 MB or smaller.'; return $true }
    $fileName = "$(New-ContentId)$extension"; [IO.File]::WriteAllBytes((Join-Path $assetRoot $fileName), $bytes); Send-Json $Stream 201 ([pscustomobject]@{ src = "/content/assets/$fileName" }); return $true
  }
  Send-Text $Stream 404 'Not Found' 'Unknown API route.'; return $true
}

Initialize-Lessons
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
try { $listener.Start() } catch [System.Net.Sockets.SocketException] { Write-Host "Port $Port is already in use."; Write-Host "Refresh http://localhost:$Port/ if Eagle Logic is already open, or use .\scripts\start-server.cmd 5174"; exit 1 }
Write-Host "Eagle Logic is running at $prefix"; Write-Host "Serving files and authoring API from $root"; Write-Host 'Press Ctrl+C to stop.'
try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream(); $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::UTF8, $false, 4096, $true)
      try {
        $request = Read-Request $reader; if ($null -eq $request) { continue }; $path = Get-RequestPath $request
        if ($path.StartsWith('/api/')) { [void](Handle-Api $stream $request $path); continue }
        if ($request.method -ne 'GET') { Send-Text $stream 405 'Method Not Allowed' 'Method not allowed.'; continue }
        $relativePath = [Uri]::UnescapeDataString($path.TrimStart('/')); if ([string]::IsNullOrWhiteSpace($relativePath)) { $relativePath = 'index.html' }
        $candidate = Join-Path $root $relativePath; $resolved = if (Test-Path $candidate -PathType Leaf) { (Resolve-Path $candidate).Path } else { $null }
        if ($null -eq $resolved -or -not $resolved.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) { Send-Text $stream 404 'Not Found' 'Not found'; continue }
        $extension = [IO.Path]::GetExtension($resolved).ToLowerInvariant(); $contentType = if ($mimeTypes.ContainsKey($extension)) { $mimeTypes[$extension] } else { 'application/octet-stream' }
        Send-Response $stream 200 'OK' $contentType ([IO.File]::ReadAllBytes($resolved))
      } catch { Send-Text $stream 400 'Bad Request' $_.Exception.Message }
    } finally { $client.Close() }
  }
} finally { $listener.Stop() }
