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
  blocked:"#dc2626", completed:"#16803c", canceled:"#9d174d",
};
export const DEFAULT_ICONS = {
  job:"mods/ttj/assets/octicons/checklist-16.svg",
  search:"mods/ttj/icons/search.svg",
  edit:"mods/ttj/icons/edit.svg",
  execute:"mods/ttj/icons/execute.svg",
  test:"mods/ttj/assets/octicons/checklist-16.svg",
  review:"mods/ttj/icons/review.svg",
  book:"mods/ttj/icons/book.svg",
  github:"mods/ttj/assets/octicons/mark-github-16.svg",
  "custom.star":"mods/ttj/assets/octicons/star-16.svg",
  "id.copy":"mods/ttj/assets/octicons/tag-16.svg",
};
export const TIME_ZONES = {JST:"JST（UTC+09:00）",UTC:"UTC",local:"端末の設定"};
export function jobIcon(key, customIcons={}) {
  const path=customIcons[key] ?? DEFAULT_ICONS[key];
  return typeof path==="string" && /\.(svg|png)$/i.test(path) ? key : "job";
}
export function formatTimestamp(value, timeZone="JST") {
  if (value===undefined || value===null || value==="") return "";
  const timestamp=Date.parse(value);
  if (!Number.isFinite(timestamp)) return String(value);
  const zone=Object.hasOwn(TIME_ZONES,timeZone) ? timeZone : "JST";
  const offset=zone==="local" ? -new Date(timestamp).getTimezoneOffset() : zone==="UTC" ? 0 : 540;
  const date=new Date(timestamp+offset*60000);
  if (!Number.isFinite(date.getTime())) return String(value);
  const pad=number=>String(number).padStart(2,"0"),absolute=Math.abs(offset);
  const label=zone==="local" ? "UTC"+(offset<0 ? "-" : "+")+pad(Math.floor(absolute/60))+":"+pad(absolute%60) : zone;
  return date.toISOString().slice(0,19).replace("T"," ")+" "+label;
}
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
export function dependencyTickets(snapshot, record) {
  const local=entityMap(snapshot);
  const references=new Map((snapshot?.dependencies ?? []).map(entry=>[entry.record.id,entry]));
  return (record.depends ?? []).map(id=>{
    const item=local.get(id),entry=item?.kind==="ticket" ? item.entry : references.get(id);
    return {id,title:entry?.record.objective ?? "参照先を確認できません",status:entry?.record.status,
      deleted:entry?.deleted===true,local:item?.kind==="ticket"};
  });
}
export function timeline(snapshot, timeZone="JST") {
  const map=entityMap(snapshot);
  return [...(snapshot?.timeline ?? [])].sort((a,b)=>{
    const left=Date.parse(a.timestamp),right=Date.parse(b.timestamp);
    return (Number.isFinite(right)&&Number.isFinite(left) ? right-left : 0) || Number(b.id)-Number(a.id);
  }).map(event=>{
    const before=event.from?.record,after=event.to?.record;
    const from=before?.status,to=after?.status;
    return {...event,
      title:after?.objective ?? after?.name ?? after?.content
        ?? before?.objective ?? before?.name ?? before?.content
        ?? map.get(after?.job ?? before?.job ?? event.target)?.entry.record.objective ?? "対象を確認できません",
      label:EVENTS[event.event] ?? event.event,
      transition:from!==to&&to ? (from ? (STATUS[from]??from)+" → " : "")+(STATUS[to]??to) : "",
      actorLabel:Array.isArray(event.actor) ? event.actor.join("・") : "",
      timeLabel:formatTimestamp(event.timestamp,timeZone),
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

export function visibleWork(snapshot, {workOnly=false}={}) {
  const items=tickets(snapshot),byId=new Map(items.map(item=>[item.ticket.record.id,item]));
  const visible=new Set();
  if (!workOnly) {
    for (const task of snapshot?.tasks ?? []) visible.add(task.task.record.id);
    for (const id of byId.keys()) visible.add(id);
    return visible;
  }
  const ended=record=>record.status==="completed" || record.status==="canceled";
  const target=record=>!ended(record) && record.status!=="waiting";
  const children=new Map();
  for (const item of items) for (const parent of item.ticket.record.depends ?? []) {
    if (!children.has(parent)) children.set(parent,[]);
    children.get(parent).push(item.ticket.record.id);
  }
  const descendants=predicate=>{
    const memo=new Map(),visiting=new Set();
    const has=id=>{
      if (memo.has(id)) return memo.get(id);
      if (visiting.has(id)) return false;
      visiting.add(id);
      const found=(children.get(id) ?? []).some(child=>predicate(byId.get(child).ticket.record) || has(child));
      visiting.delete(id);memo.set(id,found);return found;
    };
    return has;
  };
  const hasLaterTarget=descendants(target);
  function retain(id) {
    if (visible.has(id) || !byId.has(id)) return;
    const item=byId.get(id);visible.add(id);visible.add(item.task.record.id);
    for (const parent of item.ticket.record.depends ?? []) retain(parent);
  }
  for (const item of items) {
    const record=item.ticket.record;
    if (target(record) && record.status!=="paused" && !hasLaterTarget(record.id)) retain(record.id);
  }
  for (const task of snapshot?.tasks ?? []) {
    const id=task.task.record.id,remaining=task.tickets.filter(item=>!ended(item.ticket.record));
    const hasLaterUnfinished=descendants(record=>record.task===id && !ended(record));
    const frontier=remaining.filter(item=>!hasLaterUnfinished(item.ticket.record.id));
    const allPaused=frontier.length>0 && frontier.every(item=>item.ticket.record.status==="paused");
    if (remaining.length && !allPaused || !task.tickets.length && !ended(task.task.record) && task.task.record.status!=="paused") visible.add(id);
  }
  return visible;
}

export function canPurgeTask(snapshot, entry) {
  const ended=wrapper=>["completed","canceled"].includes(wrapper?.record?.status) && !wrapper.active;
  if (!ended(entry)) return false;
  const task=snapshot?.tasks?.find(item=>item.task.record.id===entry.record.id);
  return Boolean(task) && task.tickets.every(item=>ended(item.ticket) && item.jobs.every(ended));
}

export function edgeBridges(edges) {
  const bridges=new Map(),horizontal=[],vertical=[];
  for (const edge of edges) for (let index=1;index<edge.points.length;index++) {
    const [x1,y1]=edge.points[index-1],[x2,y2]=edge.points[index];
    if (y1===y2) horizontal.push({edge,y:y1,left:Math.min(x1,x2),right:Math.max(x1,x2)});
    else vertical.push({edge,x:x1,top:Math.min(y1,y2),bottom:Math.max(y1,y2)});
  }
  for (const h of horizontal) for (const v of vertical) {
    if (h.edge===v.edge || h.edge.from && h.edge.from===v.edge.from || h.edge.to===v.edge.to) continue;
    if (v.x>=h.left+6 && v.x<=h.right-6 && h.y>=v.top && h.y<=v.bottom)
      bridges.set(v.x+":"+h.y,{x:v.x,y:h.y});
  }
  return [...bridges.values()].sort((a,b)=>a.y-b.y || a.x-b.x);
}

export function ticketCanvas(snapshot, visibility={}) {
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
  const nodes=[];
  for (const item of items) {
    const column=rank(item.ticket.record.id);
    nodes.push({...item,kind:"ticket",entry:item.ticket,x:24+294*column,y:24,width:242,height:98});
  }
  const placed=new Map(nodes.map(node=>[node.entry.record.id,node]));
  const taskNodes=(snapshot?.tasks ?? []).map(item=>({
    kind:"task",entry:item.task,x:24,y:24,width:242,height:98,
  }));
  const tasksById=new Map(taskNodes.map(node=>[node.entry.record.id,node]));
  const edges=nodes.flatMap(to=>{
    const dependencies=(to.entry.record.depends ?? []).filter(id=>placed.has(id));
    const parents=dependencies.length ? dependencies.map(id=>placed.get(id)) : [tasksById.get(to.entry.record.task)];
    return parents.filter(Boolean).map(from=>({from,to}));
  });
  const compare=(a,b)=>a.entry.record.id<b.entry.record.id ? -1 : a.entry.record.id>b.entry.record.id ? 1 : 0;
  const incoming=new Map(),outgoing=new Map();
  for (const edge of edges) {
    if (!incoming.has(edge.to)) incoming.set(edge.to,[]);
    if (!outgoing.has(edge.from)) outgoing.set(edge.from,[]);
    incoming.get(edge.to).push(edge.from);outgoing.get(edge.from).push(edge.to);
  }
  for (const children of outgoing.values()) children.sort(compare);
  const placedRows=new Set(),visited=new Set();let nextRow=0;
  function place(node,row=nextRow) {
    if (visited.has(node) || (incoming.get(node) ?? []).some(parent=>!visited.has(parent))) return false;
    while (placedRows.has(node.x+":"+row)) row=nextRow++;
    visited.add(node);placedRows.add(node.x+":"+row);node.y=24+130*row;nextRow=Math.max(nextRow,row+1);
    let first=true;
    for (const child of outgoing.get(node) ?? []) {
      if (place(child,first ? row : nextRow)) first=false;
    }
    return true;
  }
  for (const task of [...taskNodes].sort(compare)) place(task);
  for (const node of [...nodes].sort(compare)) place(node);
  const visible=visibleWork(snapshot,visibility);
  const all=[...taskNodes,...nodes].filter(node=>visible.has(node.entry.record.id));
  const connections=edges.filter(({from,to})=>visible.has(from.entry.record.id) && visible.has(to.entry.record.id));
  const column=node=>Math.round((node.x-24)/294),row=node=>Math.round((node.y-24)/130);
  // Edges that skip columns travel below their target row, clear of cards.
  const gutters=new Map();
  for (const edge of connections) {
    edge.column=column(edge.from);
    if (column(edge.to)>edge.column+1) {
      const index=row(edge.to);
      if (!gutters.has(index)) gutters.set(index,new Set());
      gutters.get(index).add(edge.to.entry.record.id);
    }
  }
  const spacing=Math.max(130,122+12*Math.max(0,...[...gutters.values()].map(ids=>ids.size)));
  const gutterIndex=new Map([...gutters].map(([index,ids])=>[index,[...ids].sort()]));
  for (const node of all) {node.column=column(node);node.y=24+spacing*row(node);}
  for (const node of all) {
    const outputs=connections.filter(edge=>edge.from===node).sort((a,b)=>a.to.y-b.to.y || a.to.x-b.to.x || compare(a.to,b.to));
    const straight=outputs.every(edge=>edge.to.y===node.y && edge.to.column===node.column+1);
    outputs.forEach(edge=>{
      edge.startY=node.y+(straight ? 49 : 70);
      edge.endY=edge.to.y+49;
      edge.gutterY=edge.to.column>edge.column+1 ? edge.to.y+110+12*gutterIndex.get(Math.round((edge.to.y-24)/spacing)).indexOf(edge.to.entry.record.id) : edge.endY;
    });
  }
  const lanes=new Map(),branches=new Map();
  for (const edge of connections) {
    if (!branches.has(edge.from)) branches.set(edge.from,[]);
    branches.get(edge.from).push(edge);
  }
  const span=edges=>Math.max(...edges.map(edge=>Math.max(edge.startY,edge.gutterY)))-Math.min(...edges.map(edge=>Math.min(edge.startY,edge.gutterY)));
  // One lane per source keeps large fan-outs narrow. Merges may share a lane.
  for (const branch of [...branches.values()].sort((a,b)=>span(b)-span(a) || compare(a[0].from,b[0].from))) {
    const column=branch[0].column;
    if (!lanes.has(column)) lanes.set(column,[]);
    const slots=lanes.get(column);
    const routes=branch.map(edge=>({top:Math.min(edge.startY,edge.gutterY),bottom:Math.max(edge.startY,edge.gutterY),to:edge.to}));
    let lane=slots.findIndex(items=>routes.every(route=>items.every(other=>other.to===route.to || route.bottom+8<other.top || route.top>other.bottom+8)));
    if (lane<0) {lane=slots.length;slots.push([]);}
    slots[lane].push(...routes);
    for (const edge of branch) edge.lane=lane;
  }
  const columns=[24];
  for (let index=0;index<Math.max(0,...all.map(node=>node.column));index++) columns.push(columns[index]+242+Math.max(52,24+12*(lanes.get(index)?.length ?? 0)));
  for (const node of all) node.x=columns[node.column];
  for (const edge of connections) {
    const start=edge.from.x+edge.from.width,bend=start+12+12*edge.lane,end=edge.to.x;
    edge.points=[[start,edge.startY],[bend,edge.startY],[bend,edge.gutterY]];
    if (edge.to.column>edge.column+1) edge.points.push([end-12,edge.gutterY],[end-12,edge.endY]);
    edge.points.push([end,edge.endY]);
    edge.points=edge.points.filter((point,index,points)=>!index || point[0]!==points[index-1][0] || point[1]!==points[index-1][1]);
  }
  return {nodes:all,edges:connections,bridges:edgeBridges(connections),width:Math.max(48,...all.map(n=>n.x+n.width+24)),
    height:Math.max(48,...all.map(n=>n.y+n.height+24),...connections.flatMap(edge=>edge.points.map(point=>point[1]+12)))};
}
