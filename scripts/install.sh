#!/bin/sh
set -eu
source_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
herdr_app_home=${HERDR_APP_HOME:-${XDG_CONFIG_HOME:-$HOME/.config}/herdr-app}
mkdir -p "$herdr_app_home/mods/ttj" "$herdr_app_home/layouts"
for entry in main.js model.js client.js mod.json icons assets; do
    cp -R "$source_root/mods/ttj/$entry" "$herdr_app_home/mods/ttj/"
done
cp "$source_root"/layouts/ttj*.json "$herdr_app_home/layouts/"
cp "$source_root/THIRD_PARTY_NOTICES.txt" "$herdr_app_home/mods/ttj/"
if [ "$#" -gt 0 ]; then
    test -f "$1"
    mkdir -p "$herdr_app_home/mods/ttj/bin"
    core_target="$herdr_app_home/mods/ttj/bin/ttjcore"
    if [ ! -f "$core_target" ] || ! cmp -s "$1" "$core_target"; then
        cp "$1" "$core_target"
    fi
    chmod +x "$core_target"
fi
printf '%s\n' 'Installed TTJ Mod and layouts.'
