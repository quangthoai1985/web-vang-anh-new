$content = Get-Content -Path "e:\WEB\MGVA\public\office\assets\index-yK0MJkgc.js" -Raw
$index = $content.IndexOf("DocEditor")
if ($index -ge 0) {
    $start = [Math]::Max(0, $index - 100)
    $length = [Math]::Min($content.Length - $start, 300)
    Write-Host "Context found:"
    Write-Host $content.Substring($start, $length)
} else {
    Write-Host "Not found"
}
