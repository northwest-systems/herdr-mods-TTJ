import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClient, PROTOCOL } from "../mods/ttj/client.js";
import { timeline, dependencyTickets, formatTimestamp, ticketCanvas, edgeBridges, visibleJobs, visibleWork, jobIcon, DEFAULT_ICONS } from "../mods/ttj/model.js";
test("ships a valid asset for every standard Job icon",async()=>{
 for (const key of ["job","search","edit","execute","test","review","book"]) {
   assert.ok(DEFAULT_ICONS[key]);
 }
 for (const path of Object.values(DEFAULT_ICONS)) {
   const asset=await readFile(new URL("../"+path,import.meta.url),"utf8");
   assert.match(asset,/<svg\b/);assert.match(asset,/viewBox="0 0 16 16"/);
 }
});
test("uses a default Job icon for missing or unsupported keys",()=>{
 for (const key of [undefined,null,"","missing","toString"]) assert.equal(jobIcon(key),"job");
 for (const key of Object.keys(DEFAULT_ICONS)) assert.equal(jobIcon(key),key);
 assert.equal(jobIcon("custom.build",{"custom.build":"mods/ttj/assets/build.svg"}),"custom.build");
 assert.equal(jobIcon("custom.build",{"custom.build":"mods/ttj/assets/build.PNG"}),"custom.build");
 assert.equal(jobIcon("custom.build",{"custom.build":""}),"job");
 assert.equal(jobIcon("custom.build",{"custom.build":"not-an-image"}),"job");
});
test("passes JSON as a separate argument without invoking a shell", async () => {
 let call;const client=createClient(async(...args)=>{call=args;return{code:0,stdout:JSON.stringify({jsonrpc:"2.0",protocol:PROTOCOL,id:1,result:{items:[]}})};},{command:"core-command",args:["prefix"],autoStart:false});
 const id='project"; echo example';assert.deepEqual(await client("project.snapshot",{id}),{items:[]});
 assert.equal(call[0],"core-command");assert.deepEqual(call[1].slice(0,4),["prefix","call","project.snapshot","--params"]);
 assert.deepEqual(JSON.parse(call[1][4]),{id});
});
test("rejects incompatible versions and unrelated response ids",async()=>{
 for(const change of [{protocol:"TTJ/0.1.0"},{id:99}]){
 const client=createClient(async()=>({code:0,stdout:JSON.stringify({jsonrpc:"2.0",protocol:PROTOCOL,id:1,result:{},...change})}),{autoStart:false});
 await assert.rejects(client("project.list"),Error);}
});
test("shows structured domain errors without exposing process diagnostics",async()=>{
 const client=createClient(async()=>({code:2,stdout:JSON.stringify({jsonrpc:"2.0",protocol:PROTOCOL,id:1,error:{code:-32004,message:"Project not found"}})}),{autoStart:false});
 await assert.rejects(client("project.snapshot"),/Project not found/);
 const broken=createClient(async()=>({code:1,stdout:"",stderr:"private diagnostic"}),{autoStart:false});
 await assert.rejects(broken("project.list"),e=>!e.message.includes("private diagnostic"));
});
test("sorts timezone-qualified events by actual time and stable event ids",()=>{
 const rows=timeline({timeline:[
 {id:1,timestamp:"2026-01-01T10:00:00+09:00",event:"record.created",to:{record:{objective:"Earlier"}}},
 {id:2,timestamp:"2026-01-01T02:00:00Z",event:"status.changed",from:{record:{status:"todo"}},to:{record:{status:"doing",objective:"Later"}}},
 {id:3,timestamp:"2026-01-01T02:00:00Z",event:"run.started",target:"run",actor:["reviewer"]}]});
 assert.deepEqual(rows.map(r=>r.id),[3,2,1]);assert.equal(rows[1].transition,"未着手 → 作業中");assert.equal(rows[0].actorLabel,"reviewer");
});

test("resolves dependency names across Tasks, Projects and deleted Tickets without exposing missing ids",()=>{
 const snapshot={tasks:[
   {task:{record:{id:"tsk-12abcd00"}},tickets:[{ticket:{record:{id:"tkt-12abcd00",objective:"案内を作成する",status:"completed"}},jobs:[]}]},
   {task:{record:{id:"tsk-12abcd01"}},tickets:[{ticket:{record:{id:"550e8400-e29b-41d4-a716-446655440000",objective:"配信先を確認する",status:"doing"}},jobs:[]}]},
 ],dependencies:[
   {record:{id:"tkt-12abcd00",objective:"古い表示名"}},
   {record:{id:"external",objective:"別Projectの承認を受ける",status:"todo"}},
   {record:{id:"deleted",objective:"旧手順を確認する",status:"completed"},deleted:true},
 ]};
 const record={depends:["tkt-12abcd00","550e8400-e29b-41d4-a716-446655440000","external","deleted","unknown-internal-id"]};
 const before=JSON.stringify({snapshot,record}),items=dependencyTickets(snapshot,record);
 assert.deepEqual(items.map(item=>item.title),["案内を作成する","配信先を確認する","別Projectの承認を受ける","旧手順を確認する","参照先を確認できません"]);
 assert.deepEqual(items.map(item=>item.local),[true,true,false,false,false]);
 assert.equal(items[3].deleted,true);assert.equal(items[0].status,"completed");
 assert.equal(JSON.stringify({snapshot,record}),before);
 assert.deepEqual(dependencyTickets(null,{}),[]);
});

test("uses readable timeline titles for Runs and missing records instead of internal ids",()=>{
 const snapshot={tasks:[{task:{record:{id:"task"}},tickets:[{ticket:{record:{id:"ticket"}},jobs:[{record:{id:"job-12abcd00",objective:"案内を確認する"}}]}]}],timeline:[
   {id:1,target:"internal-run-id",event:"run.started",to:{record:{job:"job-12abcd00"}}},
   {id:2,target:"internal-ticket-id",event:"record.deleted",from:{record:{objective:"旧案内を確認する"}}},
   {id:3,target:"unknown-internal-id",event:"record.updated"},
 ]};
 assert.deepEqual(timeline(snapshot).map(event=>event.title),["対象を確認できません","旧案内を確認する","案内を確認する"]);
});

test("defaults display to JST and converts input offsets across date boundaries",()=>{
 assert.equal(formatTimestamp("2026-11-20T18:30:12.456Z"),"2026-11-21 03:30:12 JST");
 assert.equal(formatTimestamp("2026-01-01T00:15:00+09:00","UTC"),"2025-12-31 15:15:00 UTC");
 assert.equal(formatTimestamp("2026-11-20T10:00:00-05:00"),"2026-11-21 00:00:00 JST");
 assert.equal(formatTimestamp("2026-11-20T18:30:12Z","unknown"),"2026-11-21 03:30:12 JST");
 for (const value of [undefined,null,""]) assert.equal(formatTimestamp(value),"");
 assert.equal(formatTimestamp("not a date"),"not a date");
});

test("follows the device timezone including daylight saving time",()=>{
 const previous=process.env.TZ;
 try {
   process.env.TZ="America/New_York";
   assert.equal(formatTimestamp("2026-01-01T01:00:00Z","local"),"2025-12-31 20:00:00 UTC-05:00");
   assert.equal(formatTimestamp("2026-07-01T01:00:00Z","local"),"2026-06-30 21:00:00 UTC-04:00");
 } finally {
   if (previous===undefined) delete process.env.TZ;else process.env.TZ=previous;
 }
});

test("changes only timeline time labels when switching display timezone",()=>{
 const snapshot={timeline:[
   {id:1,timestamp:"2026-01-01T10:00:00+09:00",event:"record.created"},
   {id:2,timestamp:"2026-01-01T02:00:00Z",event:"status.changed"},
 ]},before=JSON.stringify(snapshot);
 const jst=timeline(snapshot),utc=timeline(snapshot,"UTC");
 assert.deepEqual(jst.map(event=>event.id),[2,1]);
 assert.deepEqual(utc.map(event=>event.id),[2,1]);
 assert.equal(jst[0].timeLabel,"2026-01-01 11:00:00 JST");
 assert.equal(utc[0].timeLabel,"2026-01-01 02:00:00 UTC");
 assert.equal(JSON.stringify(snapshot),before);
});

test("keeps Task heads and dependencies in a compact branching canvas",()=>{
 const entry=(id,depends)=>({ticket:{record:{id,task:"task",depends}},jobs:[]});
 const snapshot={tasks:[{task:{record:{id:"task"}},tickets:[entry("later",["first"]),entry("first",[])]}]};
 const scene=ticketCanvas(snapshot),nodes=new Map(scene.nodes.map(n=>[n.entry.record.id,n]));
 assert.ok(nodes.get("later").x>nodes.get("first").x);
 assert.ok(nodes.get("first").x>nodes.get("task").x);
 const {width,height}=nodes.get("first");
 assert.ok(width>0 && height>0);
 assert.ok(scene.nodes.every(node=>node.width===width && node.height===height));
 assert.deepEqual(new Set(scene.edges.map(({from,to})=>from.entry.record.id+"->"+to.entry.record.id)),new Set(["first->later","task->first"]));
});

const graph=(definitions)=>({tasks:definitions.map(([id,items])=>({task:{record:{id,status:"doing"}},tickets:items.map(([ticket,depends=[]])=>({ticket:{record:{id:ticket,task:id,depends,status:"todo"}},jobs:[]}))}))});
const segments=edge=>edge.points.slice(1).map((point,index)=>({from:edge.points[index],to:point}));
function nonMergingOverlaps(scene) {
 const overlaps=[];
 for (let i=0;i<scene.edges.length;i++) for(let j=i+1;j<scene.edges.length;j++) {
   const a=scene.edges[i],b=scene.edges[j];if(a.to===b.to) continue;
   for(const left of segments(a)) for(const right of segments(b)) {
     const horizontal=left.from[1]===left.to[1] && right.from[1]===right.to[1] && left.from[1]===right.from[1];
     const vertical=left.from[0]===left.to[0] && right.from[0]===right.to[0] && left.from[0]===right.from[0];
     if (!horizontal && !vertical) continue;
     const axis=horizontal?0:1;
     if(Math.max(Math.min(left.from[axis],left.to[axis]),Math.min(right.from[axis],right.to[axis]))<Math.min(Math.max(left.from[axis],left.to[axis]),Math.max(right.from[axis],right.to[axis]))-.01) overlaps.push([a.from.entry.record.id,a.to.entry.record.id,b.from.entry.record.id,b.to.entry.record.id]);
   }
 }
 return overlaps;
}
test("places independent branches below the complete preceding branch",()=>{
 const snapshot=graph([["task",[["a"],["b",["a"]],["c",["a"]],["d",["b"]],["e",["c"]]]],["other",[["f"],["g",["f"]]]]]);
 const scene=ticketCanvas(snapshot),nodes=new Map(scene.nodes.map(node=>[node.entry.record.id,node]));
 assert.equal(nodes.get("b").y,nodes.get("d").y);
 assert.ok(nodes.get("c").y>nodes.get("d").y);
 assert.equal(nodes.get("e").y,nodes.get("c").y);
 const firstTask=new Set(["task","a","b","c","d","e"]);
 const otherRows=["other","f","g"].map(id=>nodes.get(id).y),firstRows=[...firstTask].map(id=>nodes.get(id).y);
 assert.ok(Math.min(...otherRows)>Math.max(...firstRows) || Math.min(...firstRows)>Math.max(...otherRows));
 assert.deepEqual(nonMergingOverlaps(scene),[]);
 const reverse=structuredClone(snapshot);reverse.tasks.reverse();for(const task of reverse.tasks) task.tickets.reverse();
 const positions=scene=>Object.fromEntries([...scene.nodes].sort((a,b)=>a.entry.record.id.localeCompare(b.entry.record.id)).map(node=>[node.entry.record.id,[node.x,node.y]]));
 assert.deepEqual(positions(ticketCanvas(reverse)),positions(scene));
});
test("keeps one card per Ticket at merges and routes long dependencies around cards",()=>{
 const scene=ticketCanvas(graph([["task",[["a"],["b",["a"]],["c",["a"]],["d",["b","c"]],["e",["a","d"]]]]]));
 assert.equal(new Set(scene.nodes.map(node=>node.entry.record.id)).size,scene.nodes.length);
 assert.equal(scene.edges.filter(edge=>edge.to.entry.record.id==="d").length,2);
 assert.deepEqual(nonMergingOverlaps(scene),[]);
 for(const edge of scene.edges) for(const segment of segments(edge)) for(const node of scene.nodes) {
   const [x1,y1]=segment.from,[x2,y2]=segment.to;
   const intersects=x1===x2 ? x1>node.x && x1<node.x+node.width && Math.max(Math.min(y1,y2),node.y)<Math.min(Math.max(y1,y2),node.y+node.height)
     : y1>node.y && y1<node.y+node.height && Math.max(Math.min(x1,x2),node.x)<Math.min(Math.max(x1,x2),node.x+node.width);
   assert.equal(intersects,false,`edge crosses card ${node.entry.record.id}`);
 }
});
test("keeps non-merging routes separate in densely connected dependency graphs",()=>{
 let seed=17;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
 for(let sample=0;sample<64;sample++) {
   const definitions=Array.from({length:10},(_,index)=>["ticket-"+index,Array.from({length:index},(_,prior)=>"ticket-"+prior).filter(()=>random()<.3)]);
   const scene=ticketCanvas(graph([["task",definitions]]));
   assert.deepEqual(nonMergingOverlaps(scene),[],`overlap in sample ${sample}`);
   assert.equal(new Set(scene.nodes.map(node=>node.entry.record.id)).size,11);
 }
});
test("adds a semicircle at non-merging crossings while leaving merges connected",()=>{
 const destination={},other={};
 const horizontal={to:destination,points:[[0,20],[60,20]]},vertical={to:other,points:[[30,0],[30,40]]};
 assert.deepEqual(edgeBridges([horizontal,vertical]),[{x:30,y:20}]);
 assert.deepEqual(edgeBridges([horizontal,{...vertical,to:destination}]),[]);
 assert.deepEqual(edgeBridges([horizontal,vertical,{...vertical,to:{}}]),[{x:30,y:20}]);
 assert.deepEqual(edgeBridges([{to:{},points:[[0,20],[60,20],[60,0],[30,0],[30,40]]}]),[]);
 const scene=ticketCanvas(graph([["task",[["a"],["b"],["c",["a","b"]],["d",["a","b"]]]]]));
 assert.ok(scene.bridges.length>0);
 assert.deepEqual(nonMergingOverlaps(scene),[]);
 assert.equal(scene.nodes.length,5);
});
test("wires the side and bottom launcher to an initially hidden TTJ panel",async()=>{
 for (const name of ["ttj-side","ttj-bottom"]) {
   const layout=JSON.parse(await readFile(new URL("../layouts/"+name+".json",import.meta.url),"utf8"));
   const nodes=[];const walk=node=>{nodes.push(node);for(const child of node.children??[]) walk(child);};walk(layout);
   assert.equal(new Set(nodes.map(node=>node.id)).size,nodes.length);
   const launcher=nodes.find(node=>node.content?.props?.launcher),panel=nodes.find(node=>node.id==="ttj-panel");
   assert.equal(launcher.content.mod,"ttj");assert.equal(launcher.content.props.panel,panel.id);
   assert.equal(panel.hidden,true);assert.equal(panel.content.props.panel,panel.id);
 }
});
test("shows the current Job and one next Job without changing the left alignment",()=>{
 const jobs=Array.from({length:12},(_,index)=>({record:{id:index,status:index<9 ? "completed" : index===9 ? "doing" : "todo"}}));
 assert.deepEqual(visibleJobs(jobs).map(job=>job.record.id),[3,4,5,6,7,8,9,10]);
 jobs[9].record.status="completed";jobs[10].record.status="completed";jobs[11].record.status="doing";
 assert.deepEqual(visibleJobs(jobs).map(job=>job.record.id),[5,6,7,8,9,10,11]);
 assert.equal(visibleJobs(jobs.slice(0,8)).length,8);
});
test("initializes a shared Core once before concurrent calls",async()=>{
 const calls=[];
 const client=createClient(async(command,args)=>{
   calls.push(args);
   return {code:0,stdout:JSON.stringify({jsonrpc:"2.0",protocol:PROTOCOL,id:1,result:{}})};
 },{command:"ttjcore",profile:"example-profile"});
 await Promise.all([client("project.list"),client("rpc.discover")]);
 assert.equal(calls.filter(args=>args.at(-1)==="ensure").length,1);
 assert.deepEqual(calls[0],["--home","example-profile","ensure"]);
});

test("retains prerequisite paths and unfinished Tasks without inventing edges",()=>{
 const ticket=(id,status,depends=[])=>({ticket:{record:{id,status,task:"task",depends}},jobs:[]});
 const snapshot={tasks:[
   {task:{record:{id:"task",status:"doing"}},tickets:[ticket("done","completed"),ticket("wait","waiting",["done"]),ticket("active","doing",["wait"]),ticket("next","todo",["active"]),ticket("canceled","canceled")]},
   {task:{record:{id:"waiting-task",status:"waiting"}},tickets:[{ticket:{record:{id:"active-child",status:"doing",task:"waiting-task"}},jobs:[]}]},
   {task:{record:{id:"done-task",status:"completed"}},tickets:[]},
 ]};
 const before=JSON.stringify(snapshot);
 const scene=ticketCanvas(snapshot,{workOnly:true});
 assert.deepEqual(new Set(scene.nodes.map(node=>node.entry.record.id)),new Set(["task","done","wait","active","next","waiting-task","active-child"]));
 assert.deepEqual(new Set(scene.edges.map(({from,to})=>from.entry.record.id+"->"+to.entry.record.id)),new Set(["task->done","done->wait","wait->active","active->next","waiting-task->active-child"]));
 assert.deepEqual(new Set(scene.nodes.map(node=>node.entry.record.id)),visibleWork(snapshot,{workOnly:true}));
 assert.equal(JSON.stringify(snapshot),before);
 assert.equal(ticketCanvas(snapshot).nodes.length,9);
});

test("hides ended and waiting tails while preserving intermediate records and merge inputs",()=>{
 const snapshot=graph([["task",[["done"],["wait",["done"]],["cancel",["wait"]],["live",["cancel"]],["merge",["live","other"]],["other"],["ended",["live"]],["waiting",["merge"]]]]]);
 const statuses={done:"completed",wait:"waiting",cancel:"canceled",live:"doing",merge:"blocked",other:"completed",ended:"completed",waiting:"waiting"};
 for(const item of snapshot.tasks[0].tickets) item.ticket.record.status=statuses[item.ticket.record.id];
 const before=JSON.stringify(snapshot),visible=visibleWork(snapshot,{workOnly:true});
 assert.deepEqual(visible,new Set(["task","done","wait","cancel","live","merge","other"]));
 assert.deepEqual(new Set(ticketCanvas(snapshot,{workOnly:true}).nodes.map(node=>node.entry.record.id)),visible);
 assert.equal(JSON.stringify(snapshot),before);
});

test("keeps all-waiting Tasks and hides branches whose unfinished leaves are all paused",()=>{
 const snapshot=graph([
   ["waiting-task",[["waiting"]]],
   ["paused-task",[["parent"],["pause-a",["parent"]],["pause-b",["parent"]],["old",["parent"]]]],
   ["mixed-task",[["root"],["paused",["root"]],["active",["root"]]]],
   ["empty",[]],["paused-empty",[]],["ended-empty",[]],
 ]);
 const statuses={waiting:"waiting","pause-a":"paused","pause-b":"paused",old:"completed",paused:"paused",active:"doing"};
 for(const task of snapshot.tasks) for(const item of task.tickets) item.ticket.record.status=statuses[item.ticket.record.id] ?? "todo";
 snapshot.tasks[4].task.record.status="paused";snapshot.tasks[5].task.record.status="completed";
 const visible=visibleWork(snapshot,{workOnly:true});
 assert.deepEqual(visible,new Set(["waiting-task","mixed-task","root","active","empty"]));
 assert.deepEqual(new Set(ticketCanvas(snapshot,{workOnly:true}).nodes.map(node=>node.entry.record.id)),visible);
 assert.equal(visibleWork(snapshot).size,14);
});

test("retains cross-Task prerequisites and paused intermediate nodes leading to active work",()=>{
 const snapshot=graph([["first",[["paused"]]],["second",[["next",["paused"]]]]]);
 snapshot.tasks[0].tickets[0].ticket.record.status="paused";
 assert.deepEqual(visibleWork(snapshot,{workOnly:true}),new Set(["paused","first","next","second"]));
 assert.deepEqual(visibleWork(null,{workOnly:true}),new Set());
});
