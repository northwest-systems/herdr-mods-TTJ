import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, Button } from "gpui-base";
import { exec, theme, checking, props as modProps, openOverlay, closeOverlay } from "herdr";
import { createClient } from "./client.js";
import { STATUS, tickets, timeline, entityMap } from "./model.js";

const BUTTON_WIDTH = 36, PROJECT_WIDTH = 160, CHIP_WIDTH = 88;
const VIEWS = [["timeline","タイムライン"],["tree","ツリー"],["list","リスト"]];
const FIELDS = {
  id:"ID", objective:"目標", criteria:"完了条件", instructions:"手順", assignee:"担当",
  depends:"前提Ticket", handoffs:"申し送り", resume:"再開条件", deadline:"期限",
  result:"結果", actor:"実参加者", started:"開始時刻", ended:"終了時刻",
  content:"内容", basis:"根拠", supersedes:"置換元", jobs:"Job",
};

export default class TTJ extends View {
  init(_props, cx) {
    this.config = modProps() ?? {};
    this.detailRef = this.config.detail ?? null;
    this.projects = []; this.snapshot = this.config.snapshot ?? null; this.project = this.config.project ?? null;
    this.states = new Map(); this.token = 0; this.watchToken = 0; this.closed = false;
    this.busy = false; this.error = ""; this.connected = false;
    try { this.client = createClient(exec, this.config); }
    catch (error) { this.error = error.message; }
    if (checking() || !this.client) return;
    this.refresh(cx);
  }
  state() {
    const key = this.project ?? "";
    if (!this.states.has(key)) {
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem("ttj-view:"+key) || "{}"); } catch {}
      this.states.set(key, {
        view: VIEWS.some(([id])=>id===saved.view) ? saved.view : "timeline",
        list: saved.list === "task" ? "task" : "ticket", collapsed: new Set(),
      });
    }
    return this.states.get(key);
  }
  choose(field, value, cx) {
    const state = this.state(); state[field] = value;
    localStorage.setItem("ttj-view:"+this.project,JSON.stringify({view:state.view,list:state.list}));
    cx.notify();
  }
  refresh(cx, project) {
    const token = ++this.token;
    ++this.watchToken;
    if (project && project !== this.project) { this.project = project; this.snapshot = null; }
    this.busy = true; this.error = ""; cx.notify();
    cx.spawn(async cx => {
      try {
        const list = await this.client("project.list");
        if (token !== this.token || this.closed) return;
        this.projects = list.items;
        const id = this.project ?? list.items[0]?.record.id;
        if (id && !list.items.some(item=>item.record.id===id)) throw new Error("指定したProjectが見つかりません。");
        if (!id) {
          this.snapshot = null; this.project = null;
          this.startWatch(cx,list.cursor ?? 0); return;
        }
        const snapshot = await this.client("project.snapshot",{id});
        if (token !== this.token || this.closed) return;
        if (snapshot.project?.record?.id !== id) throw new Error("Projectの応答が一致しません。");
        this.project = id; this.snapshot = snapshot;
        this.startWatch(cx,snapshot.cursor ?? list.cursor ?? 0);
      } catch (error) { if (token === this.token) { this.error = error.message; this.connected = false; } }
      finally { if (token === this.token && !this.closed) { this.busy = false; cx.notify(); } }
    });
  }
  startWatch(cx, cursor) {
    const watch = ++this.watchToken;
    this.connected = true;
    cx.spawn(async cx => {
      while (!this.closed && watch === this.watchToken) {
        try {
          const changes = await this.client("events.wait",{cursor,timeout_ms:20000});
          if (this.closed || watch !== this.watchToken) return;
          cursor = changes.cursor;
          if (!changes.events.length) continue;
          const list = await this.client("project.list");
          if (this.closed || watch !== this.watchToken) return;
          this.projects = list.items;
          if (changes.events.some(event=>event.project === this.project)) {
            if (!list.items.some(item=>item.record.id===this.project)) {
              this.snapshot = null; this.project = null;
            } else {
              const snapshot = await this.client("project.snapshot",{id:this.project});
              if (this.closed || watch !== this.watchToken) return;
              this.snapshot = snapshot;
            }
          }
          cx.notify();
        } catch (error) {
          if (watch !== this.watchToken || this.closed) return;
          this.connected = false; this.error = error.message; cx.notify();
          cx.timer.after(2000,cx=>{ if (!this.closed && watch === this.watchToken) this.refresh(cx); });
          return;
        }
      }
    });
  }
  close() { this.closed = true; ++this.watchToken; ++this.token; }
  button(id,label,action,t,selected=false,disabled=false) {
    const project=id.startsWith("pj-");
    const icon=project ? "folder" : id.startsWith("view-") ? id.slice(5)
      : id.startsWith("list-type-") ? id.slice(10)
      : id==="ttj-close-detail" ? "close" : "refresh";
    const content=project
      ? h_flex().w_full().min_w(0).gap(8).items_center()
        .child(svg("mods/ttj/icons/folder.svg").size(16).flex_none())
        .child(div().flex_1().min_w(0).truncate().child(label))
      : svg("mods/ttj/icons/"+icon+".svg").size(18);
    return Button.new(id).w(project ? PROJECT_WIDTH : BUTTON_WIDTH).h(36).flex_none()
      .disabled(disabled).px(project ? 10 : 8).rounded(6).text_size(12)
      .text_color(selected ? t.accent_foreground : t.foreground)
      .bg(selected ? t.accent : t.raised).accessibility_label(label).tooltip(label)
      .when(!disabled,el=>el.cursor_pointer().hover(s=>s.bg(selected ? t.accent : t.hover)))
      .on_click((_event,cx)=>action(cx)).child(content);
  }
  chip(text,t,color=t.muted) {
    return div().w(CHIP_WIDTH).h(26).flex_none().px(6).rounded(5).bg(t.raised)
      .py(5).text_size(11).text_color(color).text_center().truncate().child(text);
  }
  badge(status,t) {
    return this.chip(STATUS[status] ?? status ?? "",t,
      status==="blocked" ? t.ansi1 : status==="completed" ? t.ansi2 : status==="doing" ? t.accent : t.muted);
  }
  row(id,title,kind,status,action,t,depth=0,leading=null) {
    return h_flex().id(id).w_full().h(54).flex_none().pl(14+depth*26).pr(14).gap(10)
      .items_center().rounded(6).bg(t.surface).cursor_pointer().hover(s=>s.bg(t.hover))
      .on_click((_event,cx)=>action(cx))
      .when(Boolean(leading),el=>el.child(leading))
      .child(div().flex_1().min_w(0).truncate().text_size(13).child(title))
      .child(this.chip(kind,t)).child(this.badge(status,t));
  }
  openRecord(kind,id,cx) {
    const ref = {kind,id,project:this.project};
    openOverlay({mod:"ttj",kind:"dialog",modal:true,width:760,height:640,
      props:{...this.config,project:this.project,detail:ref,snapshot:this.snapshot}});
  }
  tree(t) {
    const rows=[],state=this.state();
    for (const item of this.snapshot?.tasks ?? []) {
      const task=item.task.record,folded=state.collapsed.has(task.id);
      const disclosure=div().w(24).h(28).flex_none().text_center().text_color(t.muted)
        .cursor_pointer().child(folded ? "›" : "⌄").on_click((_event,cx)=>{
          cx.stop_propagation();
          if (state.collapsed.has(task.id)) state.collapsed.delete(task.id); else state.collapsed.add(task.id);
          cx.notify();
        });
      rows.push(this.row("task-"+task.id,task.objective,"TASK",task.status,
        cx=>this.openRecord("task",task.id,cx),t,0,disclosure));
      if (!folded) for (const ticketItem of item.tickets) {
        const ticket=ticketItem.ticket.record;
        rows.push(this.row("ticket-"+ticket.id,ticket.objective,"TICKET",ticket.status,
          cx=>this.openRecord("ticket",ticket.id,cx),t,1,div().w(24).flex_none()));
      }
    }
    return this.scroll("ttj-tree",rows,"Task・Ticketはまだありません。",t);
  }
  list(t) {
    const taskMode=this.state().list==="task";
    const items=taskMode ? (this.snapshot?.tasks ?? []).map(item=>item.task)
      : tickets(this.snapshot).map(item=>item.ticket);
    return this.scroll("ttj-list",items.map(item=>this.row("list-"+item.record.id,
      item.record.objective,taskMode ? "TASK" : "TICKET",item.record.status,
      cx=>this.openRecord(taskMode ? "task" : "ticket",item.record.id,cx),t)),
      taskMode ? "Taskはまだありません。" : "Ticketはまだありません。",t);
  }
  events(t) {
    return this.scroll("ttj-timeline",timeline(this.snapshot).map(event=>
      h_flex().id("event-"+event.id).w_full().h(62).flex_none().px(14).gap(10)
        .items_center().rounded(6).bg(t.surface).cursor_pointer().hover(s=>s.bg(t.hover))
        .on_click((_event,cx)=>this.openRecord("event",event.id,cx))
        .child(v_flex().flex_1().min_w(0).gap(4)
          .child(div().text_size(13).truncate().child(event.title))
          .child(div().text_size(10).text_color(t.muted).child(event.timeLabel)))
        .child(this.chip(event.label,t,t.accent))
        .child(this.badge(event.to?.record?.status,t))),
      "実行・状態変更の履歴はまだありません。",t);
  }
  scroll(id,rows,empty,t) {
    return v_flex().id(id).w_full().flex_1().min_h(0).overflow_y_scrollbar().p(14).gap(6)
      .when(!rows.length,el=>el.child(div().p(16).text_size(13).text_color(t.muted).child(empty)))
      .children(rows);
  }
  field(label,value,t) {
    const lines=Array.isArray(value) ? value.map(String) : [String(value ?? "")];
    return v_flex().w_full().gap(5).flex_none()
      .child(div().text_size(11).text_color(t.muted).child(label))
      .children(lines.map(line=>div().text_size(13).child(line)));
  }
  details(ref) {
    const t=theme(),map=entityMap(this.snapshot);
    const event=ref.kind==="event" ? timeline(this.snapshot).find(e=>e.id===ref.id) : null;
    const entry=ref.kind==="event" ? null : map.get(ref.id);
    const wrapper=event?.to ?? event?.from ?? entry?.entry;
    const record=wrapper?.record;
    const fields=[];
    if (event) {
      fields.push(this.field("変更",event.transition || event.label,t));
      fields.push(this.field("時刻",event.timeLabel,t));
      fields.push(this.field("変更主体",event.actorLabel,t));
      fields.push(this.field("理由",event.reason,t));
    }
    if (record) for (const [key,label] of Object.entries(FIELDS)) {
      if (record[key]===undefined || key==="jobs") continue;
      fields.push(this.field(label,record[key],t));
    }
    if (entry?.kind==="ticket") for (const job of entry.jobs) {
      fields.push(this.row("modal-job-"+job.record.id,job.record.objective,"JOB",job.record.status,
        cx=>this.openRecord("job",job.record.id,cx),t));
    }
    if (record?.jobs && !entry) fields.push(this.field("Job",record.jobs,t));
    return v_flex().w(720).h(600).min_h(0).bg(t.surface).text_color(t.foreground).p(20).gap(14)
      .child(h_flex().w_full().flex_none().gap(10).items_center()
        .child(div().flex_1().min_w(0).text_size(17).font_semibold().child(
          record?.objective ?? record?.name ?? event?.title ?? "詳細"))
        .when(Boolean(record?.status),el=>el.child(this.badge(record.status,t))))
      .when(Boolean(this.error),el=>el.child(div().w_full().flex_none().text_color(t.ansi1).text_size(12).child(this.error)))
      .child(v_flex().id("ttj-modal-fields").w_full().flex_1().min_h(0).overflow_y_scrollbar().gap(16)
        .when(!record,el=>el.child(div().child("この作業は削除されたか、現在のProjectにありません。")))
        .children(fields))
      .child(h_flex().w_full().flex_none().justify_end()
        .child(this.button("ttj-close-detail","閉じる",()=>closeOverlay(this.config.overlay),t)));
  }
  render() {
    if (this.detailRef) return this.details(this.detailRef);
    const t=theme(),state=this.state();
    return v_flex().size_full().min_w(0).min_h(0).bg(t.background).text_color(t.foreground)
      .child(h_flex().w_full().h(72).flex_none().px(16).gap(12).items_center().bg(t.chrome)
        .child(div().text_size(20).font_semibold().child("TTJ"))
        .child(v_flex().flex_1().min_w(0).gap(4)
          .child(div().text_size(14).truncate().child(this.snapshot?.project.record.name ?? "Projectを選択"))
          .child(div().text_size(11).text_color(t.muted).child(
            this.busy ? "更新中…" : this.error ? "接続を確認してください" : this.connected ? "変更を受信中" : "")))
        .child(this.button("ttj-refresh","更新",cx=>this.refresh(cx),t,false,this.busy || !this.client)))
      .child(h_flex().id("ttj-projects").w_full().h(48).flex_none().items_center().overflow_x_scrollbar().px(14).gap(8)
        .children(this.projects.map(item=>this.button("pj-"+item.record.id,item.record.name,
          cx=>this.refresh(cx,item.record.id),t,this.project===item.record.id)))
        .when(!this.projects.length,el=>el.child(div().text_size(12).text_color(t.muted).child(
          this.busy ? "Projectを読み込み中…" : "Projectがありません。"))))
      .child(h_flex().w_full().h(48).flex_none().items_center().px(14).gap(8)
        .children(VIEWS.map(([id,label])=>this.button("view-"+id,label,cx=>this.choose("view",id,cx),t,state.view===id))))
      .when(state.view==="list",el=>el.child(h_flex().w_full().h(48).flex_none().items_center().px(14).gap(8)
        .children([["task","Task"],["ticket","Ticket"]].map(([id,label])=>
          this.button("list-type-"+id,label,cx=>this.choose("list",id,cx),t,state.list===id)))))
      .when(Boolean(this.error),el=>el.child(div().w_full().flex_none().px(16).py(8).text_color(t.ansi1).text_size(12).child(this.error)))
      .child(state.view==="tree" ? this.tree(t) : state.view==="list" ? this.list(t) : this.events(t));
  }
}