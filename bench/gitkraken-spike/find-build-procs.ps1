# Bash $_ escape 함정 회피 — $psItem 사용.
Get-Process | Where-Object {
    $psItem.Name -match 'cargo|rustc|tauri|git-fried|bun|node|gitkraken'
} | Select-Object Id, Name, MainWindowTitle | Format-Table -AutoSize -Wrap
