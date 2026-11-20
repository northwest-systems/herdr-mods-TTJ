import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, Button, InputState, Input, TextareaState, Textarea } from "gpui-base";
import * as herdr from "herdr";
const { exec, theme, props:modProps, appHome, openOverlay, closeOverlay, shared, setShared, nextCommand, layout, run, focused, panes, notify } = herdr;
import { platform } from "process";
import { exists } from "fs/promises";
import { createClient } from "./client.js";
import { STATUS, KIND_NAMES, tickets, timeline, entityMap, dependencyTickets, formatTimestamp, TIME_ZONES, ticketCanvas, visibleJobs, visibleWork, canPurgeTask, jobIcon, JOB_COLORS, DEFAULT_ICONS } from "./model.js";
import { PLACEMENTS, PANE_ACTIONS, paneTarget, actOnPane, findPanel, showPlacement } from "./placement.js";

const VIEWS=[["timeline","タイムライン"],["tree","キャンバス"],["list","リスト"]];
const LABELS={name:"名前",objective:"目標",summary:"概要",criteria:"完了条件（1行に1つ）",deadline:"期限（タイムゾーン付き日時）",
  instructions:"手順",assignee:"担当（1行に1人）",handoffs:"申し送り（1行に1件）",resume:"再開条件",priority:"優先度",
  content:"記録",basis:"根拠",reason:"変更理由",result:"結果・完了の根拠",icon:"アイコンキー",operator:"操作者",command:"実行ファイル",
  args:"引数（JSON配列）",profile:"接続先プロファイル（空欄は標準）",icons:"アイコンキーとSVG / PNGパス（JSON）"};
const TERMINAL=new Set(["completed","canceled"]);
const lines=value=>String(value ?? "").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
const initial=value=>Array.isArray(value) ? value.join("\n") : String(value ?? "");
const settings=()=>shared("ttj.settings") ?? {};

export default class TTJ extends View {
  init(_props,cx) {
    this.config=modProps() ?? {}; this.project=this.config.project ?? null;
    this.snapshot=this.config.snapshot ?? null;this.projects=[];this.states=new Map();
    this.detailRef=this.config.detail ?? null;this.back=[];this.runs=[];
    this.screen=this.config.screen ?? null;this.form=null;this.inputs=[];
    this.error="";this.busy=false;this.closed=false;this.token=0;this.watchToken=0;this.drag=null;
    this.preferences=settings();this.settingsStamp=JSON.stringify(this.preferences);
    if (this.screen==="pane-menu") {this.menuAt=0;this.menuHandle=cx.focus_handle();this.menuHandle.focus();}
    if (["settings","create","edit","delete","status"].includes(this.screen)) this.buildForm(this.screen,this.config.kind,this.config.entry,cx);
    if (herdr.checking?.() || ["pane-header","pane-menu"].includes(this.screen)) return;
    cx.spawn(async cx=>{
      while (!this.closed) {
        await nextCommand();
        if (this.closed) return;
        const next=settings();
        if (JSON.stringify(next)!==this.settingsStamp) {
          this.preferences=next;this.settingsStamp=JSON.stringify(next);
          if (!this.config.launcher && this.screen!=="placement") await this.connect(cx);
        }
        cx.notify();
      }
    });
    if (!this.config.launcher && this.screen!=="placement") cx.spawn(async cx=>this.connect(cx));
  }
  async connect(cx) {
    const p=this.preferences;
    let command=this.config.command;
    if (p.mode==="custom") command=p.command || "ttjcore";
    else if (!command) {
      const bundled=appHome()+"/mods/ttj/bin/ttjcore"+(platform==="win32"||platform==="windows" ? ".exe" : "");
      command=await exists(bundled) ? bundled : "ttjcore";
    }
    try {
      this.client=createClient(exec,{command,args:p.mode==="custom" ? p.args ?? [] : this.config.args ?? [],
        profile:p.mode==="custom" ? p.profile : undefined,
        autoStart:p.mode==="custom" ? p.autoStart===true : true});
      this.refresh(cx);
    } catch(error) {this.error=error.message;cx.notify();}
  }
  state() {
    const key=this.project ?? "";
    if (!this.states.has(key)) {
      let saved={};try {saved=JSON.parse(localStorage.getItem("ttj-view:"+key) || "{}");} catch {}
      this.states.set(key,{view:VIEWS.some(([id])=>id===saved.view) ? saved.view : "tree",
        list:saved.list==="task" ? "task" : "ticket",workOnly:saved.workOnly===true,
        zoom:saved.zoom ?? 1,x:saved.x ?? 0,y:saved.y ?? 0});
    }
    return this.states.get(key);
  }
  choose(field,value,cx) {this.state()[field]=value;this.saveView();cx.notify();}
  saveView() {localStorage.setItem("ttj-view:"+this.project,JSON.stringify(this.state()));}
  refresh(cx,project) {
    const token=++this.token;++this.watchToken;
    if (project && project!==this.project) {this.project=project;this.snapshot=null;}
    this.busy=true;this.error="";cx.notify();
    cx.spawn(async cx=>{
      try {
        const list=await this.client("project.list");
        if (token!==this.token || this.closed) return;
        this.projects=list.items;
        if (this.config.overlay && this.project && !list.items.some(item=>item.record.id===this.project)) {
          this.snapshot=null;this.error="このProjectは削除されました。";this.startWatch(cx,list.cursor ?? 0);return;
        }
        this.project=list.items.some(item=>item.record.id===this.project) ? this.project : list.items[0]?.record.id ?? null;
        this.snapshot=this.project ? await this.client("project.snapshot",{id:this.project}) : null;
        if (token!==this.token || this.closed) return;
        await this.loadRuns();
        this.startWatch(cx,this.snapshot?.cursor ?? list.cursor ?? 0);
      } catch(error) {if (token===this.token) this.error=error.message;}
      finally {if (token===this.token && !this.closed) {this.busy=false;cx.notify();}}
    });
  }
  async loadRuns() {
    if (this.detailRef?.kind==="job") {
      const id=this.detailRef.id,runs=(await this.client("run.list",{parent:id})).items;
      if (this.detailRef?.id===id) this.runs=runs;
    }
  }
  startWatch(cx,cursor) {
    const watch=++this.watchToken;
    cx.spawn(async cx=>{
      while (!this.closed && watch===this.watchToken) {
        try {
          const changes=await this.client("events.wait",{cursor,timeout_ms:20000});
          if (this.closed || watch!==this.watchToken) return;
          cursor=changes.cursor;
          if (!changes.events.length) continue;
          const list=await this.client("project.list");
          const project=list.items.some(item=>item.record.id===this.project) ? this.project : this.config.overlay ? null : list.items[0]?.record.id ?? null;
          const snapshot=project ? await this.client("project.snapshot",{id:project}) : null;
          if (this.closed || watch!==this.watchToken) return;
          this.projects=list.items;this.snapshot=snapshot;this.project=project;
          await this.loadRuns();cx.notify();
        } catch(error) {
          if (watch!==this.watchToken || this.closed) return;
          this.error=error.message;cx.notify();
          cx.timer.after(2000,cx=>{if (!this.closed && watch===this.watchToken) this.refresh(cx);});
          return;
        }
      }
    });
  }
  close() {this.closed=true;++this.token;++this.watchToken;this.releaseInputs();}
  releaseInputs() {for (const input of this.inputs) input.release();this.inputs=[];}
  colors(cx) {
    const mode=settings().theme ?? "system",dark=mode==="dark" || mode==="system" && cx.theme().is_dark;
    return {...theme(),background:dark ? "#141819" : "#f3f6f3",surface:dark ? "#1c2222" : "#ffffff",
      raised:dark ? "#293131" : "#e8eee8",hover:dark ? "#333e35" : "#dcebdc",
      foreground:dark ? "#e6eae6" : "#202a22",muted:dark ? "#a5afa6" : "#59665b",
      border:dark ? "#3b453e" : "#d1dbd2",accent:dark ? "#a3e635" : "#166534",dark};
  }
  glyph(key,t,size=12) {
    const path=({...DEFAULT_ICONS,...(settings().icons ?? {})})[key] ?? "mods/ttj/icons/"+key+".svg";
    return (/\.svg$/i.test(path) ? svg(path).text_color(key==="github" ? t.dark ? "#ffffff" : "#000000" : t.foreground) : image(path)).size(size).flex_none();
  }
  button(id,key,label,action,t,selected=false,disabled=false) {
    return Button.new(id).w(26).h(26).p(0).flex_none().rounded(0).bg(selected ? t.hover : t.surface)
      .text_color(t.foreground).disabled(disabled).accessibility_label(label).tooltip(label)
      .when(!disabled,el=>el.cursor_pointer().hover(s=>s.bg(t.hover)))
      .on_mouse_down("left",(_event,cx)=>cx.stop_propagation())
      .on_click((_event,cx)=>{cx.stop_propagation();action(cx);}).child(this.glyph(key,t));
  }
  tab(id,label,action,t,selected=false,width=92) {
    return Button.new(id).w(width).h(24).px(6).rounded(0).text_size(10).bg(selected ? t.hover : t.surface)
      .text_color(selected ? t.accent : t.muted).tooltip(label).accessibility_label(label).cursor_pointer()
      .hover(s=>s.bg(t.hover)).on_click((_event,cx)=>action(cx))
      .child(div().w_full().text_center().truncate().child(label));
  }
  badge(status,t) {
    return h_flex().w(54).h(20).flex_none().items_center().justify_center().rounded(3).bg(t.raised)
      .text_size(10).text_color(this.statusColor(status,t)).child(STATUS[status] ?? status ?? "");
  }
  statusColor(status,t) {
    const dark={todo:"#94a3b8",doing:"#60a5fa",waiting:"#fbbf24",paused:"#c4b5fd",blocked:"#f87171",completed:"#86efac",canceled:"#f9a8d4"};
    return (t.dark ? dark[status] : JOB_COLORS[status]) ?? t.muted;
  }
  legend(t) {
    return h_flex().id("status-legend").w_full().h(26).flex_none().px(10).gap(12).items_center()
      .overflow_x_scrollbar().bg(t.surface).border_t_1().border_color(t.border)
      .children(Object.keys(JOB_COLORS).map(status=>h_flex().flex_none().gap(4).items_center()
        .child(div().size(7).rounded_full().bg(this.statusColor(status,t)))
        .child(div().text_size(10).text_color(t.muted).child(STATUS[status]))));
  }
  placement() {
    const saved=shared("ttj.placement");
    return PLACEMENTS.some(([id])=>id===saved) ? saved : layout()?.id==="ttj-bottom" ? "bottom" : "right";
  }
  paneMenu(pane) {
    if (!pane) {
      notify({title:"TTJ",body:"操作するpaneのヘッダーを右クリックしてください。",level:"info"});
      return;
    }
    openOverlay({mod:"ttj",kind:"popup",width:220,height:150,props:{screen:"pane-menu",pane:pane.pane}});
  }
  paneAction(action,pane=this.config.pane) {
    actOnPane(action,pane,{panes,run});
    if (this.config.overlay) closeOverlay(this.config.overlay);
  }
  paneHeader(t) {
    const pane=paneTarget(modProps(),null,panes());
    if (!pane) return div();
    return h_flex().size_full().px(8).gap(4).items_center().bg(t.surface).text_color(t.foreground)
      .on_click(()=>run("pane.focus",{pane:pane.pane}))
      .on_mouse_down("right",(_event,cx)=>{cx.stop_propagation();this.paneMenu(pane);})
      .child(div().flex_1().truncate().text_size(12).child(pane.mod==="ttj" ? "TTJ" : pane.title || pane.program?.name || "Terminal"))
      .children(PANE_ACTIONS.map(([action,label,icon])=>this.button("pane-"+action,icon,label,()=>this.paneAction(action,pane.pane),t)));
  }
  paneMenuView(t) {
    return v_flex().w_full().p(5).gap(2).bg(t.popover).text_color(t.foreground).track_focus(this.menuHandle)
      .on_key_down((event,cx)=>{
        if (event.key==="up") this.menuAt=(this.menuAt+PANE_ACTIONS.length-1)%PANE_ACTIONS.length;
        else if (event.key==="down") this.menuAt=(this.menuAt+1)%PANE_ACTIONS.length;
        else if (event.key==="enter") this.paneAction(PANE_ACTIONS[this.menuAt][0]);
        else if (event.key==="escape") closeOverlay(this.config.overlay);
        else return;
        cx.notify();
      })
      .children(PANE_ACTIONS.map(([action,label,icon],index)=>Button.new("pane-menu-"+action).w_full().h(32).px(8).rounded(6)
        .bg(index===this.menuAt ? t.selected : t.popover).hover(s=>s.bg(t.hover))
        .on_click(()=>this.paneAction(action))
        .child(h_flex().gap(8).items_center().child(this.glyph(icon,t,14)).child(label))));
  }
  placementContext() {
    const focus=focused(),current=panes();
    return {pane:focus?.pane,existingPane:current.find(item=>item.mod==="ttj" && item.tab===focus?.tab)?.pane};
  }
  choosePlacement(mode,cx) {
    if (this.busy) return;
    const context=this.screen==="placement" ? this.config : this.placementContext();
    this.error="";this.busy=true;cx.notify();
    cx.spawn(async cx=>{
      try {
        await showPlacement(mode,{...context,root:layout(),run,exec,appHome:appHome(),platform,preferences:settings()});
        setShared("ttj.placement",mode);
        if (this.screen==="placement") closeOverlay(this.config.overlay);
      } catch {
        this.error="表示先を開けません。作業paneの選択とHerdrの起動設定を確認してください。";
        if (this.config.launcher) notify({title:"TTJ",body:this.error,level:"error"});
      }
      finally {this.busy=false;cx.notify();}
    });
  }
  placementMenu() {
    openOverlay({mod:"ttj",kind:"popup",width:240,props:{screen:"placement",...this.placementContext()}});
  }
  panelToggle(cx) {
    const t=theme(),panel=findPanel(layout()),mode=this.placement();
    const dock=mode==="right" ? "ttj-side" : "ttj-bottom";
    const open=["right","bottom"].includes(mode) && layout()?.id===dock && panel && !panel.hidden;
    return h_flex().size_full().px(2).gap(1).items_center().justify_end().bg(t.chrome)
      .child(h_flex().id("ttj-panel-toggle").h(26).px(8).gap(5).flex_none().items_center().rounded(6)
        .text_size(12).bg(open ? t.selected : t.chrome).text_color(open ? t.foreground : t.muted)
        .tooltip(open ? "TTJを閉じる" : "TTJを開く").accessibility_label(open ? "TTJを閉じる" : "TTJを開く")
        .cursor_pointer().hover(s=>s.bg(t.hover)).on_mouse_down("left",(_event,cx)=>cx.stop_propagation())
        .on_click((_event,cx)=>open ? run("layout.hide",{id:"ttj-panel"}) : this.choosePlacement(mode,cx))
        .child(image("mods/ttj/assets/app-icon-"+(cx.theme().is_dark ? "white" : "black")+".png").size(14).flex_none())
        .child("TTJ"))
      .child(div().id("ttj-placement").size(26).flex_none().flex().items_center().justify_center().rounded(6)
        .bg(t.chrome).text_color(t.muted).cursor_pointer().hover(s=>s.bg(t.hover))
        .tooltip("TTJを開く場所").accessibility_label("TTJを開く場所")
        .on_mouse_down("left",(_event,cx)=>cx.stop_propagation()).on_click(()=>this.placementMenu())
        .child(svg("mods/ttj/icons/chevron-down.svg").size(14)));
  }
  placementView() {
    const t=theme(),mode=this.placement();
    return v_flex().w_full().p(6).gap(3).bg(t.popover).text_color(t.foreground)
      .child(div().px(8).py(6).text_size(12).font_semibold().child("TTJを開く場所"))
      .children(PLACEMENTS.map(([id,label,icon])=>{
        const disabled=this.busy || id.startsWith("pane-") && !this.config.pane && !this.config.existingPane;
        return Button.new("placement-"+id).w_full().h(32).px(8).rounded(6).disabled(disabled)
          .bg(id===mode ? t.selected : t.popover).text_color(disabled ? t.dim : t.foreground)
          .tooltip(disabled && id.startsWith("pane-") ? "分割する作業paneを選択してください" : label)
          .when(!disabled,el=>el.cursor_pointer().hover(s=>s.bg(t.hover)))
          .on_click((_event,cx)=>this.choosePlacement(id,cx))
          .child(h_flex().gap(8).items_center().text_size(12).child(this.glyph(icon,t,14)).child(label));
      }))
      .when(Boolean(this.error),el=>el.child(div().p(8).text_size(11).text_color(t.ansi1).child(this.error)));
  }
  copy(id,t) {return this.button("copy-"+id,"id.copy",id+" · クリックでコピー",cx=>cx.write_to_clipboard(id),t);}
  taskDelete(entry,t,z=1) {
    const allowed=canPurgeTask(this.snapshot,entry);
    return Button.new("task-delete-"+entry.record.id).w(20*z).h(20*z).p(0).rounded(0).bg(t.surface).disabled(!allowed)
      .tooltip(allowed ? "Taskを削除" : "Taskと配下を完了または中止にしてから削除できます")
      .accessibility_label("Taskを削除: "+entry.record.objective)
      .when(allowed,el=>el.cursor_pointer().hover(s=>s.bg(t.hover)))
      .on_mouse_down("left",(_event,cx)=>cx.stop_propagation())
      .on_click((_event,cx)=>{cx.stop_propagation();if (allowed) this.overlay("delete","task",entry);})
      .child(this.glyph("trash",{...t,foreground:allowed ? t.ansi1 : t.muted},12*z));
  }
  row(id,title,status,action,t,key=null,trailing=null) {
    return h_flex().id(id).w_full().h(38).flex_none().px(10).gap(8).items_center().bg(t.surface)
      .cursor_pointer().hover(s=>s.bg(t.hover)).on_click((_event,cx)=>action(cx))
      .when(Boolean(key),el=>el.child(this.glyph(key,t)))
      .child(div().flex_1().min_w(0).truncate().text_size(12).child(title))
      .when(Boolean(status),el=>el.child(this.badge(status,t)))
      .when(Boolean(trailing),el=>el.child(trailing));
  }
  overlay(screen,kind,entry=null) {
    openOverlay({mod:"ttj",kind:"dialog",frame:"none",modal:true,width:600,height:screen==="delete" && kind==="task" ? 300 : 520,
      props:{...this.config,screen,kind,entry,project:this.project,snapshot:this.snapshot,
        detail:screen==="detail" ? {kind,id:entry.record.id} : undefined}});
  }
  openRecord(kind,id,cx) {
    if (this.config.overlay) {
      if (this.detailRef) this.back.push(this.detailRef);
      this.detailRef={kind,id};this.screen="detail";this.error="";
      cx.spawn(async cx=>{await this.loadRuns();cx.notify();});cx.notify();
    } else {
      const entry=kind==="event" ? {record:{id}} : entityMap(this.snapshot).get(id)?.entry;
      if (entry) this.overlay("detail",kind,entry);
    }
  }
  jobDot(job,t,z=1) {
    const color=this.statusColor(job.record.status,t);
    return Button.new("job-"+job.record.id).w(20*z).h(20*z).p(0).flex_none().rounded_full().bg(t.surface)
      .tooltip(job.record.objective+" · "+(STATUS[job.record.status] ?? job.record.status)).accessibility_label(job.record.objective)
      .cursor_pointer().on_mouse_down("left",(_event,cx)=>cx.stop_propagation())
      .on_click((_event,cx)=>{cx.stop_propagation();this.openRecord("job",job.record.id,cx);})
      .child(h_flex().size(20*z).items_center().justify_center().rounded_full().border_color(color).border(3*z)
        .child(this.glyph(jobIcon(job.display?.icon,settings().icons),t,12*z)));
  }
  zoom(factor,cx,anchor={x:0,y:0}) {
    const state=this.state(),old=state.zoom,next=Math.max(.35,Math.min(2.5,old*factor));
    state.x=anchor.x-(anchor.x-state.x)*next/old;state.y=anchor.y-(anchor.y-state.y)*next/old;state.zoom=next;
    this.saveView();cx.notify();
  }
  tree(t) {
    const state=this.state(),scene=ticketCanvas(this.snapshot,state),z=state.zoom;
    const horizontal=(left,right,y)=>div().absolute().left(left*z+state.x).top((y-.5)*z+state.y)
      .w((right-left)*z).h(z).bg(t.muted);
    const vertical=(x,top,bottom)=>div().absolute().left((x-.5)*z+state.x).top(top*z+state.y)
      .w(z).h((bottom-top)*z).bg(t.muted);
    const edges=scene.edges.flatMap(({points})=>{
      const [endX,endY]=points[points.length-1];
      return [...points.slice(1).map(([x,y],index)=>{
        const [left,top]=points[index];
        return x===left ? vertical(x,Math.min(top,y),Math.max(top,y)) : horizontal(Math.min(left,x),Math.max(left,x),y);
      }),
        div().absolute().left((endX-10)*z+state.x).top((endY-6)*z+state.y).w(10*z).h(12*z)
          .child(svg("mods/ttj/icons/arrowhead.svg").w(10*z).h(12*z).text_color(t.muted))];
    });
    const bridges=scene.bridges.map(({x,y})=>div().absolute().left((x-7)*z+state.x).top((y-6)*z+state.y)
      .w(14*z).h(8*z).bg(t.background)
      .child(svg("mods/ttj/icons/bridge.svg").absolute().left(z).top(-z).w(12*z).h(8*z).text_color(t.muted)));
    const nodes=scene.nodes.map(node=>{
      const record=node.entry.record,task=node.kind==="task";
      return v_flex().id("node-"+record.id).absolute().left(node.x*z+state.x).top(node.y*z+state.y)
        .w(node.width*z).h(node.height*z).px(12*z).py(7*z).gap(3*z).border_1().border_color(t.border).bg(t.surface)
        .cursor_pointer().hover(s=>s.border_color(t.accent))
        .on_mouse_down("left",(_event,cx)=>cx.stop_propagation())
        .on_click((_event,cx)=>{cx.stop_propagation();this.openRecord(node.kind,record.id,cx);})
        .child(h_flex().w_full().h(20*z).items_center().justify_between()
          .child(h_flex().w(54*z).h(18*z).items_center().justify_center().bg(t.raised).text_size(9*z)
            .text_color(this.statusColor(record.status,t)).child(STATUS[record.status] ?? ""))
          .child(h_flex().gap(4*z).items_center()
          .when(task,el=>el.child(this.taskDelete(node.entry,t,z)))
          .child(Button.new("node-copy-"+record.id).w(20*z).h(20*z).p(0).rounded(0).bg(t.surface)
            .tooltip(record.id+" · コピー").on_mouse_down("left",(_event,cx)=>cx.stop_propagation())
            .on_click((_event,cx)=>{cx.stop_propagation();cx.write_to_clipboard(record.id);})
            .child(this.glyph("id.copy",t,12*z)))))
        .child(div().w_full().h(16*z).text_size(12*z).font_semibold().truncate().child((task ? "Task · " : "")+record.objective))
        .child(div().w_full().h(13*z).text_size(9*z).text_color(t.muted).truncate().child(node.entry.display?.summary ?? ""))
        .when(!task,el=>el.child(h_flex().w_full().h(20*z).gap(2*z).items_center()
          .children(visibleJobs(node.jobs).map(job=>this.jobDot(job,t,z)))));
    });
    return div().id("ttj-canvas").relative().w_full().flex_1().min_h(0).overflow_hidden().bg(t.background)
      .on_mouse_down("left",(event,cx)=>{this.drag={x:event.position.x,y:event.position.y};cx.notify();})
      .on_mouse_up("left",(_event,cx)=>{this.drag=null;this.saveView();cx.notify();})
      .on_mouse_down_out(()=>{this.drag=null;})
      .on_hover((hovered)=>{if (!hovered) this.drag=null;})
      .on_mouse_move((event,cx)=>{
        if (!this.drag) return;state.x+=event.position.x-this.drag.x;state.y+=event.position.y-this.drag.y;
        this.drag={x:event.position.x,y:event.position.y};cx.notify();
      })
      .on_scroll_wheel((event,cx)=>{
        cx.stop_propagation();this.drag=null;
        if (event.modifiers.control || event.modifiers.platform) this.zoom(Math.exp(event.delta.y*.002),cx,event.local_position);
        else {state.x+=event.delta.x;state.y+=event.delta.y;this.saveView();cx.notify();}
      })
      .children(edges).children(bridges).children(nodes)
      .when(!nodes.length,el=>el.child(div().p(20).text_size(12).text_color(t.muted).child(this.snapshot?.tasks.length ? "表示条件に一致するTask・Ticketはありません。" : "＋からTaskを作成してください。")));
  }
  scroll(id,rows,t,empty="項目はありません。") {
    return v_flex().id(id).w_full().flex_1().min_h(0).overflow_y_scrollbar().p(10).gap(4)
      .when(!rows.length,el=>el.child(div().p(10).text_size(12).text_color(t.muted).child(empty))).children(rows);
  }
  list(t) {
    const task=this.state().list==="task",kind=task ? "task" : "ticket";
    const entries=task ? (this.snapshot?.tasks ?? []).map(item=>item.task) : tickets(this.snapshot).map(item=>item.ticket);
    const visible=visibleWork(this.snapshot,this.state());
    return this.scroll("ttj-list",entries.filter(entry=>visible.has(entry.record.id)).map(entry=>this.row("list-"+entry.record.id,entry.record.objective,entry.record.status,
      cx=>this.openRecord(kind,entry.record.id,cx),t,null,task ? this.taskDelete(entry,t) : null)),t,"表示条件に一致するTask・Ticketはありません。");
  }
  events(t) {
    return this.scroll("ttj-events",timeline(this.snapshot,settings().timeZone).map(event=>
      h_flex().id("event-"+event.id).w_full().h(42).flex_none().px(10).gap(8).items_center().bg(t.surface)
        .cursor_pointer().hover(s=>s.bg(t.hover)).on_click((_event,cx)=>this.openRecord("event",event.id,cx))
        .child(v_flex().flex_1().min_w(0).gap(2)
          .child(h_flex().w_full().min_w(0).gap(6).items_center()
            .child(this.badge(event.kindLabel,t))
            .child(div().flex_1().min_w(0).text_size(12).truncate().child(event.title)))
          .child(div().text_size(9).text_color(t.muted).child(event.timeLabel)))
        .child(h_flex().w(64).h(20).items_center().justify_center().text_size(10).text_color(t.muted).child(event.label))
        .child(this.badge(event.to?.record?.status,t))),t,"実行・状態変更の履歴はまだありません。");
  }
  section(label,content,t) {
    return v_flex().w_full().flex_none().border_t_1().border_color(t.border).pt(10).gap(6)
      .child(div().text_size(10).text_color(t.muted).child(label)).child(content);
  }
  text(value,t) {return div().text_size(12).text_color(t.foreground).child(Array.isArray(value) ? value.join("\n") : String(value ?? ""));}
  modal(title,status,body,actions,t) {
    return v_flex().size_full().min_w(0).min_h(0).bg(t.surface).text_color(t.foreground).p(14).gap(10)
      .on_mouse_down("left",(_event,cx)=>cx.stop_propagation())
      .child(h_flex().w_full().h(26).flex_none().gap(4).items_center()
        .when(Boolean(status),el=>el.child(this.badge(status,t)))
        .child(div().flex_1()).children(actions)
        .child(this.button("modal-close","close","閉じる",()=>closeOverlay(this.config.overlay),t)))
      .child(div().w_full().h(24).flex_none().truncate().text_size(14).font_semibold().child(title))
      .when(Boolean(this.error),el=>el.child(div().w_full().flex_none().text_size(11).text_color(t.ansi1).child(this.error)))
      .child(body);
  }
  details(t) {
    const ref=this.detailRef,map=entityMap(this.snapshot),entry=map.get(ref?.id);
    const event=ref?.kind==="event" ? timeline(this.snapshot,settings().timeZone).find(event=>event.id===ref.id) : null;
    const wrapper=event?.to ?? event?.from ?? entry?.entry,record=wrapper?.record,fields=[];
    if (event) for (const [label,value] of [["変更",event.transition || event.label],["時刻",event.timeLabel],["操作者",event.actorLabel],["理由",event.reason]])
      fields.push(this.section(label,this.text(value,t),t));
    if (record) {
      if (record.objective) fields.push(this.section("目標",this.text(record.objective,t),t));
      if (wrapper.display?.summary) fields.push(this.section("概要",this.text(wrapper.display.summary,t),t));
      for (const key of ["criteria","instructions","assignee","depends","handoffs","resume","deadline","priority","result","content","basis","started","ended","actor"]) {
        if (record[key]===undefined) continue;
        if (key==="depends") {
          const dependencies=dependencyTickets(this.snapshot,record);
          fields.push(this.section("前提Ticket",dependencies.length ? v_flex().gap(4).children(dependencies.map(item=>
            item.local && !item.deleted ? this.row("dependency-"+item.id,item.title,item.status,cx=>this.openRecord("ticket",item.id,cx),t)
              : h_flex().w_full().gap(8).items_center()
                .child(div().flex_1().min_w(0).text_size(12).child(item.title+(item.deleted ? "（削除済み）" : "")))
                .when(Boolean(item.status),el=>el.child(this.badge(item.status,t))))) : this.text("なし",t),t));
        } else fields.push(this.section(LABELS[key] ?? key,this.text(["deadline","started","ended"].includes(key)
          ? formatTimestamp(record[key],settings().timeZone) : record[key],t),t));
      }
    }
    if (entry?.kind==="task") {
      const children=tickets(this.snapshot).filter(item=>item.ticket.record.task===record.id);
      fields.push(this.section("Tickets",v_flex().gap(4).children(children.map(item=>this.row("child-"+item.ticket.record.id,
        item.ticket.record.objective,item.ticket.record.status,cx=>this.openRecord("ticket",item.ticket.record.id,cx),t))),t));
    }
    if (entry?.kind==="ticket") fields.push(this.section("Jobs · 上から順に実行",v_flex().gap(4).children(entry.jobs.map(job=>
      h_flex().w_full().h(38).flex_none().gap(8).px(8).items_center().bg(["doing","waiting","blocked"].includes(job.record.status) ? t.hover : t.surface)
        .cursor_pointer().on_click((_event,cx)=>this.openRecord("job",job.record.id,cx))
        .child(this.jobDot(job,t)).child(div().flex_1().min_w(0).truncate().text_size(12).child(job.record.objective))
        .child(this.badge(job.record.status,t)))),t));
    if (entry?.kind==="job") fields.push(this.section("実行履歴",v_flex().gap(6).children(this.runs.map(run=>
      this.section(run.active ? "実行中" : run.record.ended ? "終了" : "停止・未確認",
        this.text([...(run.record.actor ?? []),formatTimestamp(run.record.started,settings().timeZone),run.record.result ?? "",
          formatTimestamp(run.record.ended,settings().timeZone)],t),t))),t));
    const actions=[];
    if (this.back.length) actions.push(this.button("detail-back","back","戻る",cx=>{this.detailRef=this.back.pop();cx.spawn(async cx=>{await this.loadRuns();cx.notify();});cx.notify();},t));
    if (record && !event) {
      actions.push(this.copy(record.id,t));
      if (["project","task","ticket","job"].includes(entry?.kind) && !TERMINAL.has(record.status))
        actions.push(this.button("detail-edit","edit","編集",cx=>this.buildForm("edit",entry.kind,entry.entry,cx),t));
      if (["task","ticket","job"].includes(entry?.kind) && !TERMINAL.has(record.status))
        actions.push(this.button("detail-status","status","状態変更",cx=>this.buildForm("status",entry.kind,entry.entry,cx),t));
      if (["project","task","ticket"].includes(entry?.kind))
        actions.push(this.button("detail-delete","trash",entry.kind==="task" ? "Taskを削除" : "論理削除",cx=>entry.kind==="task" ? this.overlay("delete","task",entry.entry) : this.buildForm("delete",entry.kind,entry.entry,cx),t,false,
          entry.kind==="task" && !canPurgeTask(this.snapshot,entry.entry)));
    }
    const title=record?.objective ?? record?.name ?? event?.title ?? KIND_NAMES[entry?.kind] ?? "詳細";
    return this.modal(event ? event.kindLabel+" · "+title : title,record?.status,
      this.scroll("detail-fields",fields,t,"この項目は削除されたか、現在のProjectにありません。"),actions,t);
  }
  input(name,value="",multi=false) {
    const state=multi ? TextareaState.new({value:initial(value),rows:3}) : InputState.new({value:initial(value)});
    state.on("change",()=>{if (this.form) this.form.request=null;});
    this.inputs.push(state);return {name,state,multi};
  }
  buildForm(screen,kind,entry,cx) {
    this.releaseInputs();this.screen=screen;this.error="";
    const record=entry?.record ?? {},p=settings();
    this.form={kind,entry,fields:[],jobs:[],task:record.task ?? this.snapshot?.tasks.find(item=>!TERMINAL.has(item.task.record.status))?.task.record.id,
      depends:new Set(record.depends ?? []),mode:p.mode ?? "standard",theme:p.theme ?? "system",timeZone:p.timeZone ?? "JST",autoStart:p.autoStart===true,
      status:record.status ?? "todo",release:false,resolved:false,criteria_met:false,operation:null};
    const add=(name,value,multi=false)=>this.form.fields.push(this.input(name,value,multi));
    if (screen==="settings") {
      add("operator",p.operator ?? "operator");add("command",p.command ?? "ttjcore");add("args",JSON.stringify(p.args ?? []));
      add("profile",p.profile ?? "");add("icons",JSON.stringify(p.icons ?? {},null,2),true);
    } else if (screen==="delete") {if (kind!=="task") add("reason","");}
    else if (screen==="status") {add("reason","");add("result","",true);}
    else {
      if (kind==="project") add("name",record.name);
      if (kind==="task" || kind==="ticket" && screen==="create") add("objective",record.objective);
      if (kind==="task" || kind==="ticket") add("summary",entry?.display?.summary);
      if (kind==="task") {add("criteria",record.criteria,true);add("deadline",record.deadline);}
      if (kind==="ticket" || kind==="job") {
        add("assignee",record.assignee,true);add("resume",record.resume);
        if (kind==="ticket") {add("handoffs",record.handoffs,true);add("priority",record.priority ?? 0);}
        else add("icon",entry?.display?.icon ?? "job");
      }
      if (kind==="ticket" && screen==="create") this.addJob(cx);
      if (kind==="knowledge") {add("content","",true);add("basis","",true);}
      add("reason","");
    }
    cx.notify();
  }
  addJob(cx) {
    this.form.jobs.push({fields:[this.input("objective"),this.input("criteria","",true),this.input("instructions","",true),this.input("icon","job")]});
    cx.notify();
  }
  fieldInput(field,t) {
    return this.section(LABELS[field.name] ?? field.name,(field.multi ? Textarea.new(field.state).h(74) : Input.new(field.state).h(30))
      .w_full().bg(t.surface).text_color(t.foreground).text_size(12),t);
  }
  values(fields) {return Object.fromEntries(fields.map(field=>[field.name,field.state.value().trim()]));}
  submit(cx) {
    if (this.busy) return;
    const form=this.form,screen=this.screen,v=this.values(form.fields);
    if (screen==="settings") {
      try {
        const args=JSON.parse(v.args),icons=JSON.parse(v.icons);
        if (!Array.isArray(args) || args.some(x=>typeof x!=="string")) throw new Error("引数は文字列のJSON配列を指定してください。");
        if (!icons || Array.isArray(icons) || typeof icons!=="object" || Object.entries(icons).some(([key,path])=>!key.trim() || typeof path!=="string" || !/\.(svg|png)$/i.test(path)))
          throw new Error("アイコンはキーとSVG / PNGパスのJSONオブジェクトを指定してください。");
        if (!v.operator) throw new Error("操作者を入力してください。");
        setShared("ttj.settings",{mode:form.mode,theme:form.theme,timeZone:form.timeZone,operator:v.operator,command:v.command,args,profile:v.profile,icons,autoStart:form.autoStart});
        closeOverlay(this.config.overlay);
      } catch(error) {this.error=error.message;cx.notify();}
      return;
    }
    const taskPurge=screen==="delete" && form.kind==="task";
    if (!taskPurge && !v.reason) {this.error="変更理由を入力してください。";cx.notify();return;}
    if (taskPurge && !canPurgeTask(this.snapshot,form.entry)) {this.error="Taskと配下を完了または中止にしてから削除してください。";cx.notify();return;}
    if (!this.client) {this.error="Coreへの接続を準備中です。";cx.notify();return;}
    this.busy=true;this.error="";cx.notify();
    cx.spawn(async cx=>{
      try {
        const actor=[settings().operator || "operator"];
        // Keep the exact operation and request for a retry after a lost response.
        if (!form.request) {
          const p={actor,operation:"ui-"+Date.now()+"-"+Math.random().toString(36).slice(2)};
          if (!taskPurge) p.reason=v.reason;
          let method;
          if (screen==="delete" || screen==="status") {
            Object.assign(p,{id:form.entry.record.id,revision:form.entry.revision});
            method=screen==="delete" ? (taskPurge ? "task.purge" : form.kind+".delete") : "status.set";
            if (screen==="status") Object.assign(p,{status:form.status,result:v.result,release:form.release,resolved:form.resolved,criteria_met:form.criteria_met});
          } else {
            const record={};method=form.kind+"."+(screen==="create" ? "create" : "update");
            for (const [key,value] of Object.entries(v)) {
              if (["reason","summary","icon"].includes(key)) continue;
              if (["criteria","assignee","handoffs"].includes(key)) {
                // An empty Job assignment keeps Ticket inheritance.
                if (key==="assignee" && form.kind==="job" && !value) record[key]=null;
                else record[key]=lines(value);
              } else if (key==="priority") {
                if (!Number.isSafeInteger(Number(value))) throw new Error("優先度は整数を指定してください。");
                record[key]=Number(value);
              } else if (key==="deadline" && !value) {if (screen==="edit") record[key]=null;}
              else record[key]=value;
            }
            if (form.kind==="ticket" && (screen==="create" || !form.entry.started)) record.depends=[...form.depends];
            if (screen==="create") {
              if (["task","knowledge"].includes(form.kind)) record.project=this.project;
              if (form.kind==="ticket") {
                if (!form.task) throw new Error("先にTaskを作成してください。");
                record.task=form.task;
                record.jobs=form.jobs.map(job=>{
                  const j=this.values(job.fields);
                  return {objective:j.objective,criteria:lines(j.criteria),instructions:j.instructions,display:{icon:j.icon}};
                });
              }
              p.record=record;
            } else Object.assign(p,{id:form.entry.record.id,revision:form.entry.revision,patch:record});
            if (v.summary!==undefined) p.display={summary:v.summary};
            if (v.icon!==undefined) p.display={icon:v.icon};
          }
          form.request={method,params:p};
        }
        const result=await this.client(form.request.method,form.request.params);
        if (taskPurge && result.value?.storage==="pending") notify({title:"Taskを削除しました",body:"データの削除は完了しましたが、容量回収は未完了です。",level:"warning"});
        closeOverlay(this.config.overlay);
      } catch(error) {this.error=taskPurge && error.code===-32601 ? "この削除操作に対応するTTJCoreへ更新してください。" : error.message;}
      finally {this.busy=false;cx.notify();}
    });
  }
  formView(t) {
    const f=this.form,screen=this.screen,rows=[],actions=[];
    if (["status","delete"].includes(screen)) rows.push(this.section("対象",this.text(f.entry.record.objective ?? f.entry.record.name,t),t));
    const latest=f.entry && entityMap(this.snapshot).get(f.entry.record.id)?.entry;
    const stale=latest && latest.revision!==f.entry.revision;
    if (stale) rows.push(this.section("更新があります",h_flex().items_center().gap(6)
      .child(this.text("他の操作で更新されました。再読込してから編集してください。",t))
      .child(this.button("form-reload","refresh","最新の内容を読み直す",cx=>this.buildForm(screen,f.kind,latest,cx),t)),t));
    const choices=(label,field,values,width=100)=>this.section(label,h_flex().gap(4).flex_wrap()
      .children(values.map(([value,label])=>this.tab(field+"-"+value,label,cx=>{f[field]=value;f.request=null;cx.notify();},t,f[field]===value,width))),t);
    if (screen==="settings") {
      rows.push(choices("接続","mode",[["standard","標準（自動）"],["custom","カスタム"]]));
      rows.push(choices("テーマ","theme",[["system","Herdrに従う"],["light","ライト"],["dark","ダーク"]]));
      rows.push(choices("日時の表示タイムゾーン","timeZone",Object.entries(TIME_ZONES),156));
      rows.push(this.text("標準接続はCoreを自動で準備します。カスタム接続は指定した実行ファイルとプロファイルを使います。",t));
    }
    const taskPurge=screen==="delete" && f.kind==="task";
    if (screen==="delete") rows.push(this.section(taskPurge ? "削除の確認" : "論理削除",this.text(taskPurge
      ? "このTaskと配下のすべてのTicket・Job・Runを削除します。元には戻せません。要約履歴とProjectのKnowledgeは残ります。他Taskから参照中の場合は削除できません。"
      : "配下を含む作業を完了または中止してから削除してください。履歴と依存参照は保持されます。",t),t));
    if (screen==="status") {
      rows.push(choices("状態","status",Object.entries(STATUS).filter(([id])=>JOB_COLORS[id])));
      for (const [key,label] of [["release","保留を解除"],["resolved","待機・障害の原因を解消済み"],["criteria_met","完了条件を満たした（結果の記入が必要）"]])
        rows.push(this.tab("flag-"+key,(f[key] ? "✓ " : "")+label,cx=>{f[key]=!f[key];f.request=null;cx.notify();},t,f[key],310));
    }
    if (f.kind==="ticket" && screen==="create") {
      rows.push(choices("所属Task（1つ）","task",(this.snapshot?.tasks ?? []).filter(item=>!TERMINAL.has(item.task.record.status)).map(item=>[item.task.record.id,item.task.record.objective]),156));
      rows.push(this.text("目標・Jobの構成と順序は作成後に固定されます。IDは保存時に自動発行します。",t));
    }
    for (const field of f.fields) {
      if (screen==="settings" && f.mode!=="custom" && ["command","args","profile"].includes(field.name)) continue;
      rows.push(this.fieldInput(field,t));
    }
    if (screen==="settings" && f.mode==="custom") rows.push(this.tab("auto-start",f.autoStart ? "✓ Coreを自動起動" : "Coreを自動起動",cx=>{f.autoStart=!f.autoStart;cx.notify();},t,f.autoStart,160));
    if (f.kind==="ticket" && ["create","edit"].includes(screen) && !f.entry?.started) {
      const dependencies=tickets(this.snapshot).filter(item=>item.ticket.record.id!==f.entry?.record.id);
      rows.push(this.section("前提Ticket（複数選択）",h_flex().gap(4).flex_wrap().children(dependencies.map(item=>{
        const id=item.ticket.record.id;return this.tab("depends-"+id,item.ticket.record.objective,cx=>{
          if (f.depends.has(id)) f.depends.delete(id);else f.depends.add(id);f.request=null;cx.notify();
        },t,f.depends.has(id),156);
      })),t));
    }
    for (let index=0;index<f.jobs.length;index++) {
      const job=f.jobs[index];
      rows.push(this.section("Job",v_flex().gap(6)
        .child(h_flex().justify_end().child(this.button("remove-job-"+index,"trash","Jobを除く",cx=>{
          for (const field of job.fields) {field.state.release();this.inputs=this.inputs.filter(input=>input!==field.state);}
          f.jobs.splice(index,1);f.request=null;cx.notify();
        },t,false,f.jobs.length===1)))
        .children(job.fields.map(field=>this.fieldInput(field,t))),t));
    }
    if (f.kind==="ticket" && screen==="create") rows.push(this.button("add-job","plus","Jobを追加",cx=>this.addJob(cx),t));
    if (this.detailRef) actions.push(this.button("form-back","back","詳細に戻る",cx=>{this.screen="detail";this.releaseInputs();cx.notify();},t));
    if (taskPurge) {
      actions.push(this.tab("delete-cancel","キャンセル",()=>closeOverlay(this.config.overlay),t,false,96).disabled(this.busy));
      actions.push(this.tab("delete-confirm","削除する",cx=>this.submit(cx),t,false,96).text_color(t.ansi1)
        .disabled(this.busy || Boolean(stale) || !canPurgeTask(this.snapshot,f.entry)));
    } else actions.push(this.button("form-save",screen==="delete" ? "trash" : "save",screen==="delete" ? "論理削除を確定" : "保存",cx=>this.submit(cx),t,false,this.busy || Boolean(stale)));
    const title=screen==="settings" ? "設定" : (KIND_NAMES[f.kind] ?? "")+" · "+(taskPurge ? "削除" : {create:"作成",edit:"編集",delete:"論理削除",status:"状態変更"}[screen] ?? "");
    return this.modal(title,f.entry?.record.status,this.scroll("form-fields",rows,t),actions,t);
  }
  knowledge(t) {
    const rows=(this.snapshot?.knowledge ?? []).map(entry=>this.row("knowledge-"+entry.record.id,entry.record.content,entry.record.status,
      cx=>this.openRecord("knowledge",entry.record.id,cx),t));
    return this.modal("Project Knowledge",null,this.scroll("knowledge-list",rows,t),[
      this.button("knowledge-add","plus","Knowledgeを作成",cx=>this.buildForm("create","knowledge",null,cx),t)],t);
  }
  render(cx) {
    const t=this.colors(cx);
    if (this.screen==="pane-header") return this.paneHeader(t);
    if (this.screen==="pane-menu") return this.paneMenuView(t);
    const content=this.content(cx);
    if (!this.config.panel && !this.config.overlay && !this.config.launcher && !this.screen) {
      return content.on_mouse_down("right",(_event,cx)=>{
        cx.stop_propagation();this.paneMenu(paneTarget(this.config,focused(),panes()));
      });
    }
    return content;
  }
  content(cx) {
    const t=this.colors(cx);
    if (this.config.launcher) return this.panelToggle(cx);
    if (this.screen==="placement") return this.placementView();
    if (["settings","create","edit","delete","status"].includes(this.screen)) return this.formView(t);
    if (this.screen==="knowledge") return this.knowledge(t);
    if (this.detailRef) return this.details(t);
    const state=this.state();
    return v_flex().size_full().min_w(0).min_h(0).bg(t.background).text_color(t.foreground)
      .child(h_flex().w_full().h(34).flex_none().px(10).gap(4).items_center().bg(t.surface)
        .child(image(t.dark ? "mods/ttj/assets/app-icon.png" : "mods/ttj/assets/app-icon-light.png").size(28).flex_none().accessibility_label("TTJ"))
        .child(div().flex_1())
        .when(state.view!=="timeline",el=>el.child(this.button("work-only","filter",
          state.workOnly ? "すべてのTask・Ticketを表示" : "進行対象までの経路を表示（終了・待機の末尾と保留branchを省略）",
          cx=>this.choose("workOnly",!state.workOnly,cx),t,state.workOnly,!this.project)))
        .child(this.button("project-new","plus","Projectを作成",()=>this.overlay("create","project"),t))
        .child(this.button("project-details","folder","Projectの詳細",cx=>this.openRecord("project",this.project,cx),t,false,!this.project))
        .child(this.button("project-knowledge","book","Project Knowledge",()=>this.overlay("knowledge"),t,false,!this.project))
        .child(this.button("settings","settings","設定",()=>this.overlay("settings"),t))
        .when(Boolean(this.config.panel),el=>el.child(this.button("panel-close","close","TTJを閉じる",()=>run("layout.hide",{id:this.config.panel}),t))))
      .child(h_flex().id("project-tabs").w_full().h(30).flex_none().px(8).gap(4).items_center().overflow_x_scrollbar()
        .children(this.projects.map(entry=>this.tab("pj-"+entry.record.id,entry.record.name,cx=>this.refresh(cx,entry.record.id),t,this.project===entry.record.id)))
        .when(!this.projects.length,el=>el.child(div().text_size(10).text_color(t.muted).child(this.busy ? "読み込み中…" : "＋からProjectを作成"))))
      .child(h_flex().w_full().h(32).flex_none().px(8).gap(4).items_center().bg(t.surface)
        .children(VIEWS.map(([id,label])=>this.button("view-"+id,id,label,cx=>this.choose("view",id,cx),t,state.view===id)))
        .when(state.view==="list",el=>el.children([["task","Task"],["ticket","Ticket"]].map(([id,label])=>this.tab("list-"+id,label,cx=>this.choose("list",id,cx),t,state.list===id,62))))
        .child(div().flex_1())
        .when(state.view==="tree",el=>el
          .child(this.button("zoom-out","minus","縮小",cx=>this.zoom(1/1.2,cx),t))
          .child(this.button("zoom-reset","reset","表示をリセット",cx=>{Object.assign(state,{zoom:1,x:0,y:0});this.saveView();cx.notify();},t))
          .child(this.button("zoom-in","plus","拡大",cx=>this.zoom(1.2,cx),t)))
        .child(this.button("task-new","task","Taskを作成",()=>this.overlay("create","task"),t,false,!this.project))
        .child(this.button("ticket-new","ticket","Ticketを作成",()=>this.overlay("create","ticket"),t,false,!this.snapshot?.tasks.some(item=>!TERMINAL.has(item.task.record.status)))))
      .when(Boolean(this.error),el=>el.child(h_flex().w_full().flex_none().p(8).gap(6).items_center()
        .child(div().flex_1().text_size(11).text_color(t.ansi1).child(this.error))
        .child(this.button("retry","refresh","再接続",cx=>this.refresh(cx),t))))
      .child(state.view==="tree" ? this.tree(t) : state.view==="list" ? this.list(t) : this.events(t))
      .child(this.legend(t));
  }
}
