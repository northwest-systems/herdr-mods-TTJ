import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient, PROTOCOL } from "../mods/ttj/client.js";
import { timeline, ticketCanvas, visibleJobs } from "../mods/ttj/model.js";
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
