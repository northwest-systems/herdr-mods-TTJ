export const STATUS = {
  todo:"未着手", doing:"作業中", waiting:"待機", paused:"保留",
  blocked:"障害", completed:"完了", canceled:"中止", active:"採用中", supersed:"過去",
};
const EVENTS = {
  "record.created":"作成", "record.updated":"更新", "record.deleted":"削除",
  "status.changed":"状態変更", "run.started":"実行開始", "run.finished":"実行終了",
  "execution.stop_requested":"停止要求", "knowledge.superseded":"Knowledgeの置換",
};
export const JOB_COLORS = {
  todo:"#64748b", doing:"#2563eb", waiting:"#b45309", paused:"#7c3aed",
  blocked:"#dc2626", completed:"#16803c", canceled:"#475569",
};
export const DEFAULT_ICONS = {
  job:"mods/ttj/assets/octicons/checklist-16.svg",
  github:"mods/ttj/assets/octicons/mark-github-16.svg",
  "custom.star":"mods/ttj/assets/octicons/star-16.svg",
  "id.copy":"mods/ttj/assets/octicons/tag-16.svg",
};
export function tickets(snapshot) {
  return (snapshot?.tasks ?? []).flatMap(task=>task.tickets.map(ticket=>({...ticket,task:task.task})));
}
export function entityMap(snapshot) {
  const map=new Map();
  if (snapshot?.project) map.set(snapshot.project.record.id,{kind:"project",entry:snapshot.project});
  for (const knowledge of snapshot?.knowledge ?? []) map.set(knowledge.record.id,{kind:"knowledge",entry:knowledge});
  for (const task of snapshot?.tasks ?? []) {
    map.set(task.task.record.id,{kind:"task",entry:task.task});
    for (const item of task.tickets) {
      map.set(item.ticket.record.id,{kind:"ticket",entry:item.ticket,jobs:item.jobs});
      for (const job of item.jobs) map.set(job.record.id,{kind:"job",entry:job});
    }
  }
  return map;
}
export function timeline(snapshot) {
  const map=entityMap(snapshot);
  return [...(snapshot?.timeline ?? [])].sort((a,b)=>{
    const left=Date.parse(a.timestamp),right=Date.parse(b.timestamp);
    return (Number.isFinite(right)&&Number.isFinite(left) ? right-left : 0) || Number(b.id)-Number(a.id);
  }).map(event=>{
    const before=event.from?.record,after=event.to?.record;
    const from=before?.status,to=after?.status;
    return {...event,
      title:after?.objective ?? after?.name ?? after?.content
        ?? map.get(after?.job)?.entry.record.objective ?? event.target,
      label:EVENTS[event.event] ?? event.event,
      transition:from!==to&&to ? (from ? (STATUS[from]??from)+" → " : "")+(STATUS[to]??to) : "",
      actorLabel:Array.isArray(event.actor) ? event.actor.join("・") : "",
      timeLabel:String(event.timestamp??"").replace("T"," ").replace(/\.\d+(?=Z|[+-])/,"").replace(/Z$/," UTC"),
    };
  });
}

export function visibleJobs(jobs) {
  if (jobs.length <= 8) return jobs;
  let current=jobs.findIndex(job=>job.record.status==="doing");
  if (current<0) current=jobs.findIndex(job=>!["completed","canceled"].includes(job.record.status));
  if (current<0) current=jobs.length-1;
  return jobs.slice(Math.max(0,current-6),Math.min(jobs.length,current+2));
}

export function ticketCanvas(snapshot) {
  const items=tickets(snapshot),byId=new Map(items.map(item=>[item.ticket.record.id,item]));
  const ranks=new Map(),visiting=new Set();
  function rank(id) {
    if (ranks.has(id)) return ranks.get(id);
    if (visiting.has(id)) return 1;
    visiting.add(id);
    const dependencies=(byId.get(id).ticket.record.depends ?? []).filter(id=>byId.has(id));
    const value=Math.max(1,...dependencies.map(id=>rank(id)+1));
    visiting.delete(id);ranks.set(id,value);return value;
  }
  const nodes=[],columns=new Map();
  for (const item of items) {
    const column=rank(item.ticket.record.id),y=columns.get(column) ?? 24;
    nodes.push({...item,kind:"ticket",entry:item.ticket,x:24+294*column,y,width:242,height:98});
    columns.set(column,y+130);
  }
  const placed=new Map(nodes.map(node=>[node.entry.record.id,node]));
  const taskNodes=(snapshot?.tasks ?? []).map((item,index)=>({
    kind:"task",entry:item.task,x:24,y:24+130*index,width:242,height:98,
  }));
  const tasksById=new Map(taskNodes.map(node=>[node.entry.record.id,node]));
  const edges=nodes.flatMap(to=>{
    const dependencies=(to.entry.record.depends ?? []).filter(id=>placed.has(id));
    const parents=dependencies.length ? dependencies.map(id=>placed.get(id)) : [tasksById.get(to.entry.record.task)];
    return parents.filter(Boolean).map(from=>({from,to}));
  });
  const all=[...taskNodes,...nodes];
  return {nodes:all,edges,width:Math.max(48,...all.map(n=>n.x+n.width+24)),
    height:Math.max(48,...all.map(n=>n.y+n.height+24))};
}
