#!/bin/sh
set -eu
app_home=$1
shared_json=$2
source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
window_home="$app_home/ttj-window"
mod_target="$window_home/mods/ttj"
command -v herdr-app >/dev/null
mkdir -p "$mod_target" "$window_home/layouts"
for entry in main.js model.js placement.js client.js mod.json open-window.ps1 open-window.sh icons assets bin THIRD_PARTY_NOTICES.txt; do
    if [ -e "$source_dir/$entry" ]; then cp -R "$source_dir/$entry" "$mod_target/"; fi
done
for file in "$app_home"/layouts/ttj*.json; do
    if [ -f "$file" ]; then cp "$file" "$window_home/layouts/"; fi
done
if [ ! -f "$window_home/shared.json" ]; then printf '%s\n' "$shared_json" > "$window_home/shared.json"; fi
if [ -f "$app_home/settings.json" ] && [ ! -f "$window_home/settings.json" ]; then
    cp "$app_home/settings.json" "$window_home/settings.json"
fi
HERDR_APP_HOME="$window_home" nohup herdr-app </dev/null >/dev/null 2>&1 &
printf '%s\n' 'Opened TTJ window.'
