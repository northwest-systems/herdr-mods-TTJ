import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PLACEMENTS,showPlacement} from "../mods/ttj/placement.js";

const dock={id:"ttj-side",children:[{id:"ttj-panel",hidden:false}]};
function host(overrides={}) {
  const calls=[];
  return {calls,root:dock,pane:"example-pane",appHome:"/path/to/app home",platform:"linux",
    run:(command,args)=>calls.push({command,args}),exec:async(command,args)=>{calls.push({command,args});return {code:0};},...overrides};
}
test("offers docks, pane splits and an OS window without a separate tab",()=>{
  assert.deepEqual(PLACEMENTS.map(([mode])=>mode),["right","bottom","pane-right","pane-down","window"]);
});
test("ships icons and window helpers used by the launcher",async()=>{
  for(const icon of ["chevron-down",...PLACEMENTS.map(([, ,icon])=>icon)]) {
    assert.match(await readFile(new URL("../mods/ttj/icons/"+icon+".svg",import.meta.url),"utf8"),/<svg\b/);
  }
  for(const file of ["open-window.ps1","open-window.sh"]) {
    assert.ok((await readFile(new URL("../mods/ttj/"+file,import.meta.url))).length>0);
  }
});
test("shows an existing dock and switches layout only for a different dock",async()=>{
  const right=host();await showPlacement("right",right);
  assert.deepEqual(right.calls,[{command:"layout.show",args:{id:"ttj-panel"}}]);
  const bottom=host();await showPlacement("bottom",bottom);
  assert.deepEqual(bottom.calls,[{command:"layout.switch",args:{name:"ttj-bottom"}},{command:"layout.show",args:{id:"ttj-panel"}}]);
});
test("splits the selected pane in either direction and hides the dock",async()=>{
  for(const [mode,direction] of [["pane-right","right"],["pane-down","down"]]) {
    const current=host();await showPlacement(mode,current);
    assert.deepEqual(current.calls,[{command:"layout.hide",args:{id:"ttj-panel"}},
      {command:"pane.split",args:{pane:"example-pane",direction,mod:"ttj"}}]);
  }
});
test("focuses the current tab's existing TTJ pane without making another split",async()=>{
  const current=host({existingPane:"existing-ttj"});await showPlacement("pane-right",current);
  assert.deepEqual(current.calls.at(-1),{command:"pane.focus",args:{pane:"existing-ttj"}});
  assert.ok(current.calls.every(call=>call.command!=="pane.split"));
  const missing=host({pane:null});await assert.rejects(showPlacement("pane-down",missing),/作業pane/);
  assert.deepEqual(missing.calls,[]);
});
test("starts the OS window helper with paths and settings as separate arguments",async()=>{
  for(const platform of ["linux","darwin","win32"]) {
    const preferences={mode:"custom",profile:"/path/to/profile's folder",operator:"operator"};
    const current=host({platform,preferences});await showPlacement("window",current);
    const invocation=current.calls[0];
    assert.equal(invocation.command,platform==="win32" ? "powershell.exe" : "sh");
    assert.deepEqual(JSON.parse(invocation.args.at(-1)),{layout:"ttj","frame.welcomed":"skipped","ttj.settings":preferences});
    assert.ok(invocation.args.includes(current.appHome));
    assert.deepEqual(current.calls.at(-1),{command:"layout.hide",args:{id:"ttj-panel"}});
  }
});
test("keeps the dock open when window startup fails without exposing process diagnostics",async()=>{
  const current=host({exec:async()=>({code:1,stderr:"private diagnostic"})});
  await assert.rejects(showPlacement("window",current),error=>!error.message.includes("private diagnostic"));
  assert.deepEqual(current.calls,[]);
  await assert.rejects(showPlacement("unsupported",current),/表示先/);
});
