export const PLACEMENTS = [
  ["right","右側","panel-right"],
  ["bottom","下側","panel-bottom"],
  ["pane-right","paneを右に分割","pane-right"],
  ["pane-down","paneを下に分割","pane-down"],
  ["window","別OSウインドウ","window"],
];

export function findPanel(root) {
  if (root?.id==="ttj-panel") return root;
  for (const child of root?.children ?? []) {
    const panel=findPanel(child);if (panel) return panel;
  }
  return null;
}

export async function showPlacement(mode, host) {
  const {root,pane,existingPane,run,exec,appHome,platform,preferences={}}=host;
  if (mode==="right" || mode==="bottom") {
    const name=mode==="right" ? "ttj-side" : "ttj-bottom";
    if (root?.id!==name) run("layout.switch",{name});
    run("layout.show",{id:"ttj-panel"});
  } else if (mode==="pane-right" || mode==="pane-down") {
    if (!existingPane && !pane) throw new Error("分割する作業paneを選択してください。");
    if (findPanel(root)) run("layout.hide",{id:"ttj-panel"});
    if (existingPane) run("pane.focus",{pane:existingPane});
    else run("pane.split",{pane,direction:mode==="pane-right" ? "right" : "down",mod:"ttj"});
  } else if (mode==="window") {
    const windows=platform==="win32" || platform==="windows";
    const shared=JSON.stringify({layout:"ttj","frame.welcomed":"skipped","ttj.settings":preferences});
    const result=await exec(windows ? "powershell.exe" : "sh",windows
      ? ["-NoProfile","-File",appHome+"/mods/ttj/open-window.ps1","-AppHome",appHome,"-SharedJson",shared]
      : [appHome+"/mods/ttj/open-window.sh",appHome,shared]);
    if (result.code!==0) throw new Error("別OSウインドウを開けません。HerdrをPATHから起動できることを確認してください。");
    if (findPanel(root)) run("layout.hide",{id:"ttj-panel"});
  } else throw new Error("表示先を選択してください。");
}
