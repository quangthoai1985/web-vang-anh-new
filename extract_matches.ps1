$content = Get-Content -Path "e:\WEB\MGVA\public\office\assets\index-yK0MJkgc.js" -Raw
$indices = [System.Collections.Generic.List[int]]::new()
$pos = 0
while (($pos = $content.IndexOf("DocEditor", $pos)) -ne -1) {
    $indices.Add($pos)
    $pos += 9
}

$output = @()
foreach ($idx in $indices) {
    $start = [Math]::Max(0, $idx - 150)
    $length = [Math]::Min($content.Length - $start, 450)
    $output += "Match at " + $idx
    $output += $content.Substring($start, $length)
    $output += "---------------------------------------------------"
}
$output | Out-File "e:\WEB\MGVA\debug_examples.txt" -Encoding utf8
