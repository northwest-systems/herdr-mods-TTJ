import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient, PROTOCOL } from "../mods/ttj/client.js";
import { timeline } from "../mods/ttj/model.js";
test("passes JSON as a separate argument without invoking a shell", async () => {
 let call;const client=createClient(async(...args)=>{call=args;return{code:0,stdout:JSON.stringify({jsonrpc:"2.0",protocol:PROTOCOL,id:1,result:{items:[]}})};},{command:"core-command",args:["prefix"]});
 const id='project"; echo example';assert.deepEqual(await client("project.snapshot",{id}),{items:[]});
 assert.equal(call[0],"core-command");assert.deepEqual(call[1].slice(0,4),["prefix","call","project.snapshot","--params"]);
 assert.deepEqual(JSON.parse(call[1][4]),{id});
});
test("rejects incompatible versions and unrelated response ids",async()=>{
 for(const change of [{protocol:"TTJ/0.1.0"},{id:99}]){
 const client=createClient(async()=>({code:0,stdout:JSON.stringify({jsonrpc:"2.0",protocol:PROTOCOL,id:1,result:{},...change})}));
 await assert.rejects(client("project.list"),/プロトコル/);}
});
test("shows structured domain errors without exposing process diagnostics",async()=>{
 const client=createClient(async()=>({code:2,stdout:JSON.stringify({jsonrpc:"2.0",protocol:PROTOCOL,id:1,error:{code:-32004,message:"Project not found"}})}));
 await assert.rejects(client("project.snapshot"),/Project not found/);
 const broken=createClient(async()=>({code:1,stdout:"",stderr:"private diagnostic"}));
 await assert.rejects(broken("project.list"),e=>!e.message.includes("private diagnostic"));
});
test("sorts timezone-qualified events by actual time and stable event ids",()=>{
 const rows=timeline({timeline:[
 {id:1,timestamp:"2026-01-01T10:00:00+09:00",event:"record.created",to:{record:{objective:"Earlier"}}},
 {id:2,timestamp:"2026-01-01T02:00:00Z",event:"status.changed",from:{record:{status:"todo"}},to:{record:{status:"doing",objective:"Later"}}},
 {id:3,timestamp:"2026-01-01T02:00:00Z",event:"run.started",target:"run",actor:["reviewer"]}]});
 assert.deepEqual(rows.map(r=>r.id),[3,2,1]);assert.equal(rows[1].transition,"未着手 → 作業中");assert.equal(rows[0].actorLabel,"reviewer");
});
