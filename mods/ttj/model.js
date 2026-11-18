export const STATUS = {
  todo:"未着手", doing:"作業中", waiting:"待機", paused:"保留",
  blocked:"障害", completed:"完了", canceled:"中止", active:"採用中", supersed:"過去",
};
const EVENTS = {
  "record.created":"作成", "record.updated":"更新", "record.deleted":"削除",
  "status.changed":"状態変更", "run.started":"実行開始", "run.finished":"実行終了",
  "execution.stop_requested":"停止要求", "knowledge.superseded":"知識の置換",
};
export function tickets(snapshot) {
  return (snapshot?.tasks ?? []).flatMap(task=>task.tickets.map(ticket=>({...ticket,task:task.task})));
}
export function selectedTicket(snapshot,id) {
  return tickets(snapshot).find(item=>item.ticket.record.id===id) ?? null;
}
export function entityMap(snapshot) {
  const map=new Map();
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