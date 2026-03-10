import { useState, useRef, useEffect, useCallback } from "react";
import { projects as projectsApi, staging as stagingApi, ideas as ideasApi, sessions as sessionsApi, comments as commentsApi, search as searchApi, ai as aiApi, areas as areasApi, goals as goalsApi, templates as templatesApi, tags as tagsApi, links as linksApi, settings as settingsApi, token } from "./api.js";

// ============================================================
// THE BRAIN v6 — Wired Edition
// Full persistence via TiDB/MySQL + Netlify Functions
// ============================================================

const C = {
  bg:"#070b14", surface:"#0a0f1e", border:"#0f1e3a",
  blue:"#1a4fd6", blue2:"#3b82f6", green:"#10b981",
  amber:"#f59e0b", red:"#ef4444", purple:"#6366f1",
  text:"#cbd5e1", muted:"#475569", dim:"#334155",
  mono:"'JetBrains Mono','Fira Code','Courier New',monospace",
};
const S = {
  root:  {fontFamily:C.mono,background:C.bg,color:C.text,minHeight:"100vh"},
  card:  (hi,col)=>({background:C.surface,border:`1px solid ${hi?(col||C.blue):C.border}`,borderRadius:8,padding:"14px 18px",marginBottom:10,boxShadow:hi?`0 0 18px ${col||C.blue}18`:"none"}),
  input: {background:"#0d1424",border:`1px solid ${C.border}`,borderRadius:6,color:"#e2e8f0",fontFamily:C.mono,fontSize:12,padding:"7px 11px",outline:"none",width:"100%",boxSizing:"border-box"},
  sel:   {background:"#0d1424",border:`1px solid ${C.border}`,borderRadius:6,color:"#e2e8f0",fontFamily:C.mono,fontSize:12,padding:"7px 11px",outline:"none",width:"100%",boxSizing:"border-box"},
  btn:   (v="primary",c)=>({background:v==="primary"?(c||C.blue):v==="success"?"rgba(16,185,129,0.15)":v==="danger"?"rgba(239,68,68,0.15)":"transparent",border:v==="ghost"?`1px solid ${C.border}`:v==="success"?"1px solid #10b98140":v==="danger"?"1px solid #ef444440":"none",color:v==="success"?C.green:v==="danger"?C.red:"#e2e8f0",borderRadius:5,padding:"5px 12px",fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",cursor:"pointer",fontFamily:C.mono,whiteSpace:"nowrap"}),
  tab:   (a,c=C.blue2)=>({background:"none",border:"none",cursor:"pointer",fontFamily:C.mono,fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",padding:"7px 13px",color:a?c:C.dim,borderBottom:a?`2px solid ${c}`:"2px solid transparent"}),
  badge: (c=C.blue2)=>({fontSize:9,padding:"2px 6px",borderRadius:3,background:`${c}18`,color:c,border:`1px solid ${c}35`,letterSpacing:"0.09em",fontWeight:700,whiteSpace:"nowrap"}),
  label: (c=C.blue)=>({fontSize:9,color:c,textTransform:"uppercase",letterSpacing:"0.14em",marginBottom:6,display:"block"}),
};

// ── SMALL COMPONENTS ─────────────────────────────────────────
const AreaPill=({area,active,onClick})=> <button onClick={onClick} style={{...S.btn(active?"primary":"ghost"),background:active?area.color:C.surface,border:active?`1px solid ${area.color}`:`1px solid ${C.border}`,color:active?"#fff":C.text,fontSize:9,display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:12}}>{area.icon}</span> {area.name}</button>;
const TagPill=({tag,onRemove})=><span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:9,padding:"2px 6px",borderRadius:10,background:`${tag.color}22`,color:tag.color,border:`1px solid ${tag.color}55`,letterSpacing:"0.06em",whiteSpace:"nowrap"}}>{tag.name}{onRemove&&<span onClick={e=>{e.stopPropagation();onRemove(tag);}} style={{cursor:"pointer",marginLeft:1,opacity:0.7,fontWeight:700}}>×</span>}</span>;
const Dots=({n=0,max=5,size=5})=><div style={{display:"flex",gap:3}}>{Array.from({length:max}).map((_,i)=><div key={i} style={{width:size,height:size,borderRadius:"50%",background:i<n?C.blue2:C.border}}/>)}</div>;
const HealthBar=({score})=>{const col=score>70?C.green:score>40?C.amber:C.red;return <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:60,height:4,background:C.border,borderRadius:2,overflow:"hidden"}}><div style={{width:`${score}%`,height:"100%",background:col,borderRadius:2}}/></div><span style={{fontSize:9,color:col,fontWeight:700}}>{score}</span></div>;};
const STATUS_MAP={active:{l:"ACTIVE",c:C.green},stalled:{l:"STALLED",c:C.amber},paused:{l:"PAUSED",c:C.purple},done:{l:"DONE",c:C.blue2},idea:{l:"IDEA",c:"#94a3b8"}};
const BadgeStatus=({status})=>{const m=STATUS_MAP[status]||STATUS_MAP.idea;return <span style={S.badge(m.c)}>{m.l}</span>;};
const Modal=({title,onClose,children,width=400})=>(
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:24,width,maxWidth:"95vw",maxHeight:"90vh",overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <span style={{fontSize:12,fontWeight:700,color:"#f1f5f9"}}>{title}</span>
        <button style={{...S.btn("ghost"),padding:"2px 8px"}} onClick={onClose}>✕</button>
      </div>
      {children}
    </div>
  </div>
);

// Inline toast — replaces alert() for save confirmations
const Toast=({msg,onDone})=>{
  useEffect(()=>{const t=setTimeout(onDone,2200);return()=>clearTimeout(t);},[]);
  return <div style={{position:"fixed",bottom:24,right:24,background:C.surface,border:`1px solid ${C.green}40`,borderRadius:8,padding:"10px 18px",fontSize:11,color:C.green,zIndex:9999,boxShadow:`0 4px 24px rgba(0,0,0,0.4)`}}>{msg}</div>;
};

// ── CONSTANTS ─────────────────────────────────────────────────
const BUIDL_VERSION = "1.0";
const STANDARD_FOLDERS = [
  {id:"content-assets",    icon:"📚",label:"Content Assets",    desc:"Guides, blogs, threads, tutorials"},
  {id:"project-artifacts", icon:"📦",label:"Project Artifacts", desc:"Feature lists, roadmaps, personas"},
  {id:"design-assets",     icon:"🎨",label:"Design Assets",     desc:"Logos, brand kits, style guides"},
  {id:"code-modules",      icon:"🛠", label:"Code Modules",      desc:"Components, contracts, scripts"},
  {id:"marketing",         icon:"📣",label:"Marketing",         desc:"Campaigns, press kits, strategy"},
  {id:"analytics",         icon:"📈",label:"Analytics",         desc:"Tracking plans, KPIs, data"},
  {id:"infrastructure",    icon:"⚙️",label:"Infrastructure",    desc:"Hosting, deploy configs"},
  {id:"qa",                icon:"📋",label:"QA",                desc:"Test plans, checklists"},
  {id:"support",           icon:"🤝",label:"Support",           desc:"FAQs, community docs"},
  {id:"legal",             icon:"⚖️",label:"Legal",             desc:"Privacy, ToS, licensing"},
  {id:"staging",           icon:"🌀",label:"Staging",           desc:"Raw inputs — unreviewed"},
  {id:"system",            icon:"📂",label:"System",            desc:"DEVLOG, SYSTEM_INDEX, meta"},
];
const STANDARD_FOLDER_IDS = new Set(STANDARD_FOLDERS.map(f=>f.id));
const ITEM_TAGS = ["IDEA_","SKETCH_","RND_","REWRITE_","PROMPT_","FINAL_","DRAFT_","CODE_"];
const REVIEW_STATUSES = {"in-review":{label:"IN REVIEW",color:C.amber,icon:"🔄"},"approved":{label:"APPROVED",color:C.green,icon:"✅"},"rejected":{label:"REJECTED",color:C.red,icon:"❌"},"deferred":{label:"DEFERRED",color:C.purple,icon:"⏳"}};
const THAILAND_TARGET = 3000;
const BUIDL_PHASES = ["BOOTSTRAP","UNLEASH","INNOVATE","DECENTRALIZE","LEARN","SHIP"];

// ── MANIFEST + PROJECT FACTORY ────────────────────────────────
const makeManifest = (p) => ({
  buidl_version:BUIDL_VERSION, id:p.id, name:p.name, emoji:p.emoji||"📁",
  phase:p.phase||"BOOTSTRAP", status:p.status||"active", priority:p.priority||1,
  revenue_ready:p.revenueReady||false, income_target:p.incomeTarget||0,
  momentum:p.momentum||3, last_touched:p.lastTouched||new Date().toISOString().slice(0,7),
  desc:p.desc||"", next_action:p.nextAction||"", blockers:p.blockers||[],
  tags:p.tags||[], skills:p.skills||["dev","strategy"],
  custom_folders:(p.customFolders||[]).map(f=>({id:f.id,label:f.label,icon:f.icon||"📁",desc:f.desc||""})),
  integrations:p.integrations||{}, created:p.created||new Date().toISOString(),
  exported:new Date().toISOString(),
});

const calcHealth = (p) => {
  const now=new Date(), last=new Date((p.lastTouched||"2025-01")+"-01");
  const days=Math.floor((now-last)/(1000*60*60*24));
  let s=100;
  s-=Math.min(40,days*0.5); s-=(p.blockers||[]).length*8;
  s-=(5-(p.momentum||3))*6;
  if(p.status==="paused") s-=15; if(p.status==="stalled") s-=20;
  return Math.max(0,Math.round(s));
};

const makeDefaultFiles = (name, templateConfig=null) => {
  const folders = templateConfig?.folders || STANDARD_FOLDERS.map(f=>f.id);
  const showFolder = (id) => folders.includes(id);

  const files = {
    "PROJECT_OVERVIEW.md":`# ${name}\n\n## What is this?\n\n> One sentence description here.\n\n## Problem\n\n## Solution\n\n## Target User\n\n## Revenue Model\n\n## Current Status\n\n## Next Milestone\n`,
    "DEVLOG.md":`# Dev Log — ${name}\n\n## ${new Date().toISOString().slice(0,10)}\n\n- Project initialised\n`,
    "TASKS.md":`# Tasks — ${name}\n\n## In Progress\n- [ ] Define MVP scope\n\n## Backlog\n- [ ] Set up repo\n\n## Done\n`,
    "SYSTEM_INDEX.md":`# System Index — ${name}\n\n## Folders\n${STANDARD_FOLDERS.filter(f=>folders.includes(f.id)).map(f=>`- **${f.label}**: ${f.desc}`).join("\n")}\n`,
    "system/agent.ignore":`# agent.ignore\nlegal/\ninfrastructure/\nsystem/agent.ignore\nmanifest.json\n`,
    "system/SKILL.md":`# Project Skill Overrides — ${name}\n\n## Dev Agent Overrides\n# - Custom rules here\n`,
  };

  if (showFolder("marketing")) files["CONTENT_CALENDAR.md"] = `# Content Calendar — ${name}\n\n| Date | Platform | Type | Topic | Status |\n|------|----------|------|-------|--------|\n`;
  if (showFolder("staging")) {
      files["REVIEW_QUEUE.md"] = `# Review Queue — ${name}\n\n| Item | Tag | Added | Status | Notes |\n|------|-----|-------|--------|-------|\n`;
      files["staging/.gitkeep"] = "";
  }

  return files;
};

  const makeProject = (id,name,emoji,phase,status,priority,revenueReady,desc,nextAction,blockers,tags,momentum,lastTouched,incomeTarget,skills=[],customFolders=[], templateConfig=null) => {
  const files={...makeDefaultFiles(name, templateConfig),"manifest.json":JSON.stringify(makeManifest({id,name,emoji,phase,status,priority,revenueReady,incomeTarget,momentum,lastTouched,desc,nextAction,blockers,tags,skills,customFolders}),null,2)};

  if (templateConfig?.folders) {
      templateConfig.folders.forEach(fId => {
          files[`${fId}/.gitkeep`] = "";
      });
  } else {
      customFolders.forEach(f=>{files[`${f.id}/.gitkeep`]="";});
  }

  const p={id,name,emoji,phase,status,priority,revenueReady,desc,nextAction,blockers,tags,momentum,lastTouched,incomeTarget,skills:skills.length?skills:["dev","strategy"],customFolders,integrations:{},files,activeFile:"PROJECT_OVERVIEW.md",created:new Date().toISOString()};
  p.health=calcHealth(p); return p;
};

// ── MARKDOWN + GANTT ──────────────────────────────────────────
const renderMd=(md="")=>{if(!md)return"";return md.replace(/^### (.+)$/gm,"<h3 style='color:#e2e8f0;font-size:13px;margin:12px 0 6px'>$1</h3>").replace(/^## (.+)$/gm,"<h2 style='color:#f1f5f9;font-size:15px;margin:16px 0 8px;border-bottom:1px solid #0f1e3a;padding-bottom:4px'>$1</h2>").replace(/^# (.+)$/gm,"<h1 style='color:#f1f5f9;font-size:18px;margin:0 0 16px;font-weight:700'>$1</h1>").replace(/\*\*(.+?)\*\*/g,"<strong style='color:#e2e8f0'>$1</strong>").replace(/`([^`]+)`/g,"<code style='background:#0d1424;border:1px solid #1e293b;padding:1px 5px;border-radius:3px;font-size:11px;color:#10b981'>$1</code>").replace(/^- \[x\] (.+)$/gm,"<div style='display:flex;gap:6px;padding:2px 0'><span style='color:#10b981'>✅</span><span>$1</span></div>").replace(/^- \[ \] (.+)$/gm,"<div style='display:flex;gap:6px;padding:2px 0'><span style='color:#334155'>⬜</span><span style='color:#94a3b8'>$1</span></div>").replace(/^- (.+)$/gm,"<div style='display:flex;gap:6px;padding:2px 0'><span style='color:#1a4fd6'>·</span><span>$1</span></div>").replace(/^\| (.+) \|$/gm,row=>{const cells=row.slice(2,-2).split(" | ");if(cells.every(c=>c.match(/^[-:]+$/)))return"";return`<div style='display:flex;border-bottom:1px solid #0f1e3a'>${cells.map(c=>`<div style='flex:1;padding:4px 8px;font-size:10px;color:#94a3b8'>${c}</div>`).join("")}</div>`;}).replace(/^> (.+)$/gm,"<blockquote style='border-left:3px solid #1a4fd6;margin:8px 0;padding:6px 12px;color:#94a3b8;font-style:italic'>$1</blockquote>").replace(/\n\n/g,"<br/><br/>").replace(/\n/g,"<br/>");};
const GanttChart=({tasks})=>{const rows=tasks.filter(t=>t.start&&t.end);if(!rows.length)return<div style={{color:C.muted,fontSize:10,padding:"12px 0"}}>Format: <code style={{color:C.green}}>- [ ] Task 2025-01-01 → 2025-01-14</code></div>;const allD=rows.flatMap(r=>[new Date(r.start),new Date(r.end)]);const minD=new Date(Math.min(...allD));const maxD=new Date(Math.max(...allD));const range=maxD-minD||1;return<div style={{overflowX:"auto"}}>{rows.map((r,i)=>{const left=((new Date(r.start)-minD)/range)*100;const width=((new Date(r.end)-new Date(r.start))/range)*100;return<div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><div style={{width:140,fontSize:10,color:C.text,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.label}</div><div style={{flex:1,height:16,background:C.border,borderRadius:3,position:"relative",minWidth:200}}><div style={{position:"absolute",left:`${left}%`,width:`${Math.max(width,2)}%`,height:"100%",background:r.done?C.green:C.blue,borderRadius:3,opacity:0.85}}/></div></div>;})} </div>;};
const parseTasks=(md)=>{const rows=[];md?.split("\n").forEach(line=>{const m=line.match(/[-*]\s+\[(.)\]\s+(.+?)\s+(\d{4}-\d{2}-\d{2})\s*(?:→|-|to)\s*(\d{4}-\d{2}-\d{2})/);if(m)rows.push({done:m[1]==="x",label:m[2],start:m[3],end:m[4]});});return rows;};

// ── FILE TREE ─────────────────────────────────────────────────
const FileTree=({files,activeFile,onSelect,onNewFile,onDelete,customFolders=[]})=>{
  const [expanded,setExpanded]=useState(new Set(["staging","system","content-assets","code-modules"]));
  const tree={};
  Object.keys(files).forEach(p=>{const parts=p.split("/");let node=tree;parts.forEach((part,i)=>{if(i===parts.length-1){node[part]={_file:p};}else{node[part]=node[part]||{};}node=node[part];});});
  const allFolders=[...STANDARD_FOLDERS,...customFolders];
  const getFolderMeta=id=>allFolders.find(f=>f.id===id);
  const renderNode=(node,depth=0,prefix="")=>Object.entries(node).filter(([k])=>!k.startsWith("_")).map(([key,val])=>{
    const fullPath=prefix?`${prefix}/${key}`:key;
    const isDir=!val._file, isActive=val._file===activeFile, isOpen=expanded.has(fullPath);
    const ext=key.split(".").pop();
    const folderMeta=isDir?getFolderMeta(key):null;
    const icon=isDir?(folderMeta?.icon||(isOpen?"📂":"📁")):ext==="md"?"📝":ext==="json"?"🔧":ext==="js"?"⚡":ext==="py"?"🐍":ext==="sol"?"💎":"📄";
    if(key===".gitkeep")return null;
    return <div key={fullPath}>
      <div onClick={()=>{if(isDir){setExpanded(e=>{const n=new Set(e);n.has(fullPath)?n.delete(fullPath):n.add(fullPath);return n;});}else onSelect(val._file);}}
        style={{display:"flex",alignItems:"center",gap:5,padding:"3px 6px",paddingLeft:8+depth*14,cursor:"pointer",borderRadius:4,background:isActive?"#1a4fd620":"transparent",color:isActive?C.blue2:C.text,fontSize:11}}
        onMouseEnter={e=>!isActive&&(e.currentTarget.style.background="#ffffff08")}
        onMouseLeave={e=>!isActive&&(e.currentTarget.style.background="transparent")}>
        <span style={{fontSize:12}}>{icon}</span>
        <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{key}</span>
        {isDir&&folderMeta&&!STANDARD_FOLDER_IDS.has(key)&&<span style={S.badge(C.purple)}>custom</span>}
        {!isDir&&val._file?.startsWith("staging/")&&<span onClick={e=>{e.stopPropagation();onDelete(val._file);}} style={{fontSize:9,color:C.red,opacity:0,cursor:"pointer"}} onMouseEnter={e=>{e.stopPropagation();e.currentTarget.style.opacity=1;}} onMouseLeave={e=>e.currentTarget.style.opacity=0}>✕</span>}
      </div>
      {isDir&&isOpen&&<div>{renderNode(val,depth+1,fullPath)}</div>}
    </div>;
  });
  return <div style={{height:"100%",overflowY:"auto"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px 6px",borderBottom:`1px solid ${C.border}`}}>
      <span style={{fontSize:9,color:C.blue,letterSpacing:"0.12em",textTransform:"uppercase"}}>Files</span>
      <button style={{...S.btn("ghost"),padding:"2px 6px",fontSize:9}} onClick={onNewFile}>+ File</button>
    </div>
    <div style={{padding:"4px 2px"}}>{renderNode(tree)}</div>
  </div>;
};

// ── MARKDOWN EDITOR ───────────────────────────────────────────
const MarkdownEditor=({path,content,onChange,onSave,saving})=>{
  const [mode,setMode]=useState("edit");
  const [val,setVal]=useState(content);
  const [dirty,setDirty]=useState(false);
  const timerRef=useRef(null);

  useEffect(()=> {
    setVal(content);
    setDirty(false);
  },[content,path]);

  // Debounced auto-save
  useEffect(() => {
    if (!dirty) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSave(path, val);
      setDirty(false);
    }, 2000);
    return () => clearTimeout(timerRef.current);
  }, [val, dirty, path, onSave]);

  const isJson=path?.endsWith(".json");
  const isReadonly=path==="system/agent.ignore"||path==="manifest.json";
  return <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 12px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:10,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:300}}>{path}</span>
        {isReadonly&&<span style={S.badge(C.amber)}>READONLY</span>}
        {path==="manifest.json"&&<span style={S.badge(C.purple)}>MANIFEST</span>}
      </div>
      <div style={{display:"flex",gap:4,flexShrink:0,alignItems:"center"}}>
        {dirty && <span style={{fontSize:9,color:C.amber,marginRight:8}}>Unsaved changes...</span>}
        {!isJson&&!isReadonly&&<><button style={S.tab(mode==="edit","#10b981")} onClick={()=>setMode("edit")}>Edit</button><button style={S.tab(mode==="preview","#10b981")} onClick={()=>setMode("preview")}>Preview</button></>}
        {!isReadonly&&<button style={{...S.btn("success"),padding:"4px 10px",opacity:saving?0.6:1}} onClick={()=>{onSave(path,val);setDirty(false);}} disabled={saving}>{saving?"Saving…":"Save"}</button>}
      </div>
    </div>
    {mode==="edit"||isJson
      ?<textarea style={{...S.input,flex:1,resize:"none",border:"none",borderRadius:0,fontSize:isJson?11:12,lineHeight:1.7,padding:"14px 16px",background:"#050810"}} value={val} onChange={e=>{setVal(e.target.value);onChange(e.target.value);setDirty(true);}} readOnly={isReadonly} spellCheck={false}/>
      :<div style={{flex:1,overflowY:"auto",padding:"14px 20px",background:"#050810",fontSize:12,lineHeight:1.8,color:C.text}} dangerouslySetInnerHTML={{__html:renderMd(val)}}/>}
  </div>;
};

// ── SKILLS + WORKFLOWS ────────────────────────────────────────
const SKILLS={
  dev:{id:"dev",icon:"🛠",label:"Dev Agent",description:"Code, debug, deploy",sop:["Read PROJECT_OVERVIEW.md and DEVLOG.md","Check code-modules/ for existing work","Never modify manifest.json or agent.ignore","Update DEVLOG.md after each change","Flag blockers in REVIEW_QUEUE.md"],permissions:["read:all","write:code-modules","write:devlog"],ignore:["legal/","design-assets/","manifest.json"],prompt_prefix:"Senior dev. Read context JSON. Check code-modules/ for existing work. Ask before deleting. Commit frequently."},
  content:{id:"content",icon:"✍️",label:"Content Agent",description:"Write, draft, social, docs",sop:["Read brand-voice guide first","All drafts → /staging with DRAFT_ prefix","Never publish directly","Match tone: builder, authentic, anti-corporate"],permissions:["read:all","write:content-assets","write:staging"],ignore:["code-modules/","legal/"],prompt_prefix:"Content specialist. Brand voice: authentic, builder-first. All drafts to staging first."},
  strategy:{id:"strategy",icon:"🎯",label:"Strategy Agent",description:"Planning, revenue, prioritisation",sop:["Ground every rec in revenue vs effort","Thailand £3000/mo is north star","No new projects until P1–P3 have revenue","Output structured action items"],permissions:["read:all","write:project-artifacts"],ignore:["code-modules/","staging/"],prompt_prefix:"Strategic advisor. Every recommendation maps to £3000/mo Thailand goal. Prioritise ruthlessly. No fluff."},
  design:{id:"design",icon:"🎨",label:"Design Agent",description:"UI/UX, branding, visual",sop:["Reference brand guide first","Bob style: dark #0a0a0f, blue #1a4fd6, mono","BUIDL logo locked — do not modify","All assets → /staging with SKETCH_ prefix"],permissions:["read:all","write:design-assets","write:staging"],ignore:["code-modules/","legal/"],prompt_prefix:"Visual designer. Dark minimalist, monospace, nearly kawaii. All output to staging first."},
  research:{id:"research",icon:"🔬",label:"Research Agent",description:"Market research, competitor analysis",sop:["All findings → project-artifacts/ as markdown","Always cite sources","Map findings to project decisions","Flag contradictions with current assumptions"],permissions:["read:all","write:project-artifacts"],ignore:["staging/"],prompt_prefix:"Research analyst. Cite sources. Map insights to decisions. Flag contradictions."},
};
const WORKFLOWS=[
  {id:"product-launch",icon:"🚀",label:"Product Launch",steps:[{id:1,label:"Final build check",agent:"dev",sop:"Verify features, no errors, mobile responsive"},{id:2,label:"Security audit",agent:"dev",sop:"Check env vars, HTTPS, contracts"},{id:3,label:"Launch assets",agent:"design",sop:"Screenshots, banner, OG image → staged"},{id:4,label:"Launch copy",agent:"content",sop:"Thread, email, description → drafted"},{id:5,label:"Deploy",agent:"dev",sop:"Netlify/Vercel, verify live URL"},{id:6,label:"Post thread",agent:"content",sop:"Publish, tag communities"},{id:7,label:"Monitor",agent:"dev",sop:"Analytics, error logs, 48h feedback"}]},
  {id:"content-sprint",icon:"✍️",label:"Content Sprint",steps:[{id:1,label:"Pick angle",agent:"strategy",sop:"Review CONTENT_CALENDAR, find gap"},{id:2,label:"Draft pieces",agent:"content",sop:"Thread + blog → /staging"},{id:3,label:"Design assets",agent:"design",sop:"Visuals, SKETCH_ prefix"},{id:4,label:"Review",agent:"human",sop:"Human approves or sends back"},{id:5,label:"Publish",agent:"content",sop:"Schedule, update calendar"}]},
  {id:"idea-to-brief",icon:"💡",label:"Idea → Brief",steps:[{id:1,label:"Capture",agent:"human",sop:"Add to idea bank. Title + one sentence."},{id:2,label:"Validate",agent:"strategy",sop:"Score: revenue, effort, goal alignment"},{id:3,label:"Research",agent:"research",sop:"3 competitors, gap, audience"},{id:4,label:"MVP scope",agent:"strategy",sop:"5 must-haves max. Cut rest."},{id:5,label:"Dev brief",agent:"dev",sop:"Stack, components, timeline"},{id:6,label:"Wireframes",agent:"design",sop:"Core screens, SKETCH_ prefix"}]},
  {id:"weekly-review",icon:"📊",label:"Weekly Review",steps:[{id:1,label:"Health check",agent:"human",sop:"Honest momentum 1-5 each project"},{id:2,label:"Review staging",agent:"human",sop:"Approve, defer or kill all items"},{id:3,label:"AI review",agent:"strategy",sop:"Full analysis, bottlenecks"},{id:4,label:"Update devlogs",agent:"human",sop:"Log entry for each active project"},{id:5,label:"Set focus",agent:"human",sop:"Pick #1, define next action"},{id:6,label:"Build post",agent:"content",sop:"Honest progress update"}]},
];
const BOOTSTRAP_STEPS=[{id:"brief",icon:"📋",label:"Bootstrap Brief",agent:null,desc:"You fill this in. 10 mins. Everything else derives from it."},{id:"strategy",icon:"🎯",label:"Strategy Agent",agent:"strategy",desc:"Reads brief → validates scope → outputs MVP feature list + revenue rationale."},{id:"dev",icon:"🛠",label:"Dev Agent",agent:"dev",desc:"Reads strategy output → outputs tech stack, component list, Bolt-ready one-shot prompt."},{id:"design",icon:"🎨",label:"Design Agent",agent:"design",desc:"Reads dev brief → outputs UI spec, style tokens, asset list → /staging."},{id:"content",icon:"✍️",label:"Content Agent",agent:"content",desc:"Reads all above → outputs launch copy, onboarding doc, first thread draft → /staging."},{id:"review",icon:"👤",label:"Human Review",agent:null,desc:"You review staging items from all agents. Approve, defer or kill. Build begins."}];

// Bootstrap Wizard (same as before — no persistence changes needed here)
const BootstrapWizard=({project,onComplete,onClose})=>{
  const [step,setStep]=useState(0);
  const [brief,setBrief]=useState({name:project?.name||"",problem:"",solution:"",targetUser:"",revenueModel:"",mvpFeatures:["","","","",""],techStack:"",designStyle:"",contentTone:"Builder-first, authentic, anti-corporate",agentRules:"",customFolders:["","",""],selectedAgents:["strategy","dev"]});
  const WIZARD_STEPS=[{id:"core",label:"Core Idea",icon:"💡"},{id:"scope",label:"MVP Scope",icon:"🎯"},{id:"tech",label:"Tech & Design",icon:"🛠"},{id:"agents",label:"Agent Team",icon:"🤖"},{id:"review",label:"Review & Generate",icon:"✅"}];
  const toggleAgent=id=>setBrief(b=>({...b,selectedAgents:b.selectedAgents.includes(id)?b.selectedAgents.filter(a=>a!==id):[...b.selectedAgents,id]}));
  const setFeature=(i,v)=>setBrief(b=>{const f=[...b.mvpFeatures];f[i]=v;return{...b,mvpFeatures:f};});
  const Row=({label,children,hint})=><div style={{marginBottom:12}}><span style={S.label()}>{label}</span>{hint&&<div style={{fontSize:8,color:C.dim,marginBottom:4}}>{hint}</div>}{children}</div>;
  const canProceed=[brief.problem.trim()&&brief.solution.trim()&&brief.targetUser.trim(),brief.revenueModel.trim()&&brief.mvpFeatures.filter(Boolean).length>=1,true,brief.selectedAgents.length>=1,true][step];
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div style={{background:C.surface,border:`1px solid ${C.blue}`,borderRadius:12,width:640,maxWidth:"96vw",maxHeight:"92vh",overflowY:"auto",boxShadow:`0 0 40px ${C.blue}20`}}>
      <div style={{background:"#0a1628",borderBottom:`1px solid ${C.border}`,padding:"14px 20px",borderRadius:"12px 12px 0 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div><div style={{fontSize:9,color:C.blue,letterSpacing:"0.18em",textTransform:"uppercase"}}>Agent Bootstrap Protocol</div><div style={{fontSize:14,fontWeight:700,color:"#f1f5f9"}}>{project?.emoji} {project?.name}</div></div>
          <button style={{...S.btn("ghost"),padding:"3px 9px"}} onClick={onClose}>✕</button>
        </div>
        <div style={{display:"flex"}}>{WIZARD_STEPS.map((s,i)=><div key={s.id} onClick={()=>i<step&&setStep(i)} style={{flex:1,textAlign:"center",padding:"5px 4px",cursor:i<step?"pointer":"default",borderBottom:`2px solid ${i===step?C.blue:i<step?C.green:C.border}`,fontSize:9,color:i===step?C.blue:i<step?C.green:C.dim}}>{s.icon} {s.label}</div>)}</div>
      </div>
      <div style={{padding:"20px 24px"}}>
        {step===0&&<div>
          <div style={{fontSize:11,color:C.muted,marginBottom:16,lineHeight:1.7}}>This brief is the source of truth. Every agent will read it before starting.</div>
          <Row label="Problem — what pain does this solve?"><textarea style={{...S.input,height:64,resize:"vertical"}} placeholder="e.g. Solo builders have no structured system..." value={brief.problem} onChange={e=>setBrief(b=>({...b,problem:e.target.value}))}/></Row>
          <Row label="Solution — what does this do?"><textarea style={{...S.input,height:64,resize:"vertical"}} placeholder="e.g. A project OS that scaffolds AI agent workflows..." value={brief.solution} onChange={e=>setBrief(b=>({...b,solution:e.target.value}))}/></Row>
          <Row label="Target User"><input style={S.input} placeholder="e.g. Bootstrap Web3 solo founders..." value={brief.targetUser} onChange={e=>setBrief(b=>({...b,targetUser:e.target.value}))}/></Row>
          <Row label="Revenue Model"><input style={S.input} placeholder="e.g. $9/mo SaaS, freemium + pro tier..." value={brief.revenueModel} onChange={e=>setBrief(b=>({...b,revenueModel:e.target.value}))}/></Row>
        </div>}
        {step===1&&<div>
          <div style={{fontSize:11,color:C.muted,marginBottom:16,lineHeight:1.7}}>5 features maximum. If you can't ship all 5 in 2 weeks solo, cut more.</div>
          <Row label="MVP Features">{brief.mvpFeatures.map((f,i)=><div key={i} style={{display:"flex",gap:6,marginBottom:6,alignItems:"center"}}><span style={{fontSize:10,color:C.dim,width:16,flexShrink:0}}>{i+1}.</span><input style={S.input} placeholder={i===0?"e.g. User can create a project and fill the Bootstrap Brief":"Optional feature..."} value={f} onChange={e=>setFeature(i,e.target.value)}/></div>)}</Row>
          <Row label="Custom Folders?" hint="Beyond the standard 12. Leave blank if unsure.">{["","",""].map((_,i)=><input key={i} style={{...S.input,marginBottom:6}} placeholder={`Custom folder ${i+1}...`} value={brief.customFolders[i]||""} onChange={e=>{const f=[...brief.customFolders];f[i]=e.target.value;setBrief(b=>({...b,customFolders:f}));}}/>)}</Row>
        </div>}
        {step===2&&<div>
          <Row label="Tech Stack"><input style={S.input} placeholder="e.g. React + Vite + Tailwind..." value={brief.techStack} onChange={e=>setBrief(b=>({...b,techStack:e.target.value}))}/></Row>
          <Row label="Design Style"><input style={S.input} placeholder="e.g. Dark minimalist, monospace..." value={brief.designStyle} onChange={e=>setBrief(b=>({...b,designStyle:e.target.value}))}/></Row>
          <Row label="Content Tone"><input style={S.input} value={brief.contentTone} onChange={e=>setBrief(b=>({...b,contentTone:e.target.value}))}/></Row>
          <Row label="Agent Rules"><textarea style={{...S.input,height:64,resize:"vertical"}} placeholder="e.g. Never use Next.js..." value={brief.agentRules} onChange={e=>setBrief(b=>({...b,agentRules:e.target.value}))}/></Row>
        </div>}
        {step===3&&<div>
          {Object.values({strategy:{id:"strategy",icon:"🎯",label:"Strategy Agent",desc:"Validates scope, revenue rationale. Always first."},dev:{id:"dev",icon:"🛠",label:"Dev Agent",desc:"Tech stack, Bolt one-shot prompt."},design:{id:"design",icon:"🎨",label:"Design Agent",desc:"UI spec, style tokens."},content:{id:"content",icon:"✍️",label:"Content Agent",desc:"Launch copy, thread drafts."},research:{id:"research",icon:"🔬",label:"Research Agent",desc:"Market research, competitors."}}).map(sk=><div key={sk.id} onClick={()=>toggleAgent(sk.id)} style={{display:"flex",gap:12,alignItems:"flex-start",padding:"10px 12px",marginBottom:6,background:brief.selectedAgents.includes(sk.id)?"rgba(26,79,214,0.1)":C.bg,border:`1px solid ${brief.selectedAgents.includes(sk.id)?C.blue:C.border}`,borderRadius:6,cursor:"pointer"}}>
            <div style={{width:18,height:18,borderRadius:3,background:brief.selectedAgents.includes(sk.id)?C.blue:C.border,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>{brief.selectedAgents.includes(sk.id)?"✓":""}</div>
            <div><div style={{fontSize:11,color:"#e2e8f0",fontWeight:600}}>{sk.icon} {sk.label}</div><div style={{fontSize:9,color:C.muted,marginTop:2}}>{sk.desc}</div></div>
            {sk.id==="strategy"&&<span style={{...S.badge(C.amber),marginLeft:"auto",flexShrink:0}}>ALWAYS FIRST</span>}
          </div>)}
        </div>}
        {step===4&&<div>
          <div style={{fontSize:11,color:C.muted,marginBottom:16,lineHeight:1.7}}>These files will be generated and saved to your project in the database.</div>
          {["project-artifacts/BOOTSTRAP_BRIEF.md","project-artifacts/STRATEGY_PROMPT.md","project-artifacts/DEV_PROMPT.md","system/SKILL.md","system/AGENT_ONBOARDING.md"].map(f=><div key={f} style={{display:"flex",gap:10,padding:"6px 0",borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:9,color:C.green}}>✓</span><div style={{fontSize:10,color:"#e2e8f0",fontFamily:C.mono}}>{f}</div></div>)}
        </div>}
        <div style={{display:"flex",justifyContent:"space-between",marginTop:20}}>
          <button style={S.btn("ghost")} onClick={()=>step>0?setStep(s=>s-1):onClose()}>{step>0?"← Back":"Cancel"}</button>
          {step<4?<button style={{...S.btn("primary"),opacity:canProceed?1:0.5}} onClick={()=>canProceed&&setStep(s=>s+1)}>Next →</button>
            :<button style={S.btn("primary")} onClick={()=>onComplete(brief)}>🚀 Generate & Save Bootstrap Files</button>}
        </div>
      </div>
    </div>
  </div>;
};

// ── EXPORT UTILITIES ──────────────────────────────────────────
const buildZipExport=(project)=>{
  const manifest=makeManifest(project);
  let out=`BUIDL_EXPORT_V1\nMANIFEST_START\n${JSON.stringify(manifest,null,2)}\nMANIFEST_END\nFILES_START\n`;
  Object.entries(project.files||{}).forEach(([path,content])=>{out+=`FILE_START:${path}\n${content||""}\nFILE_END:${path}\n`;});
  out+=`FILES_END\n`; return out;
};

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT — accepts props from App.jsx (auth gate)
// ══════════════════════════════════════════════════════════════
export default function TheBrain({ user, initialProjects=[], initialStaging=[], initialIdeas=[], initialAreas=[], initialGoals=[], initialTemplates=[], initialTags=[], initialEntityTags=[], onLogout }) {

  // ── STATE ──────────────────────────────────────────────────
  const [projects,setProjects]       = useState(initialProjects.map(p=>({...p,health:calcHealth(p)})));
  const [staging,setStaging]         = useState(initialStaging);
  const [ideas,setIdeas]             = useState(initialIdeas);
  const [areas,setAreas]             = useState(initialAreas);
  const [goals,setGoals]             = useState(initialGoals || []);
  const [templates,setTemplates]     = useState(initialTemplates || []);
  const [userTags,setUserTags]       = useState(initialTags || []);
  // entityTags: flat array of {id,tag_id,entity_type,entity_id,name,color,category}
  const [entityTags,setEntityTags]   = useState(initialEntityTags || []);
  const [tagInput,setTagInput]       = useState({}); // {[entityKey]: inputValue}
  const [selectedTagId,setSelectedTagId] = useState(null); // for Tags brain tab
  const [userSettings,setUserSettings]   = useState({font:"JetBrains Mono",fontSize:11});
  const [settingsForm,setSettingsForm]   = useState({font:"JetBrains Mono",fontSize:11});

  // Hub links
  const [hubLinks,setHubLinks]       = useState([]);
  const [newLinkForm,setNewLinkForm] = useState({targetType:"project",targetId:"",relationship:"related"});

  // UI navigation
  const [view,setView]               = useState("brain");
  const [mainTab,setMainTab]         = useState("command");
  const [hubId,setHubId]             = useState(null);
  const [hubTab,setHubTab]           = useState("editor");
  const [focusId,setFocusId]         = useState(initialProjects[0]?.id || null);

  // Session timer
  const [sessionActive,setSessionOn] = useState(false);
  const [sessionSecs,setSessionSecs] = useState(0);
  const [sessionLog,setSessionLog]   = useState("");
  const [templateId, setTemplateId] = useState("");
  const timerRef                     = useRef(null);
  const sessionStart                 = useRef(null);

  // AI coach
  const [aiOut,setAiOut]   = useState("");
  const [aiLoad,setAiLoad] = useState(false);
  const [aiIn,setAiIn]     = useState("");
  const aiRef              = useRef(null);

  // UI misc
  const [copied,setCopied]           = useState(false);
  const [activeSkill,setActiveSkill] = useState("dev");
  const [briefProj,setBriefProj]     = useState(initialProjects[0]?.id || "");
  const [activeWF,setActiveWF]       = useState(null);
  const [wfProj,setWfProj]           = useState(initialProjects[0]?.id || "");
  const [newIdea,setNewIdea]         = useState("");
  const [newStaging,setNewStaging]   = useState({name:"",tag:"IDEA_",project:initialProjects[0]?.id||"",notes:""});
  const [newGoalForm,setNewGoalForm] = useState({title:"",target_amount:3000,currency:"GBP",timeframe:"monthly",category:"income"});
  const [activeGoalId,setActiveGoalId] = useState(initialGoals?.[0]?.id || null);
  const [showInt,setShowInt]         = useState(null);
  const [dragOver,setDragOver]       = useState(false);
  const [searchQ,setSearchQ]         = useState("");
  const [searchRes,setSearchRes]     = useState([]);
  const [showSearch,setShowSearch]   = useState(false);
  const [comments,setComments]       = useState({});
  const [newComment,setNewComment]   = useState("");

  // Modals
  const [modal,setModal]                     = useState(null);
  const [bootstrapWizardId,setBootstrapWiz]  = useState(null);
  const [newProjForm,setNewProjForm]         = useState({name:"",emoji:"📁",phase:"BOOTSTRAP",desc:"",areaId:"",incomeTarget:0,templateId:""});
  const [newFileName,setNewFileName]         = useState("");
  const [newFileFolder,setNewFileFolder]     = useState("staging");
  const [customFolderForm,setCFForm]         = useState({id:"",label:"",icon:"📁",desc:""});
  const [importText,setImportText]           = useState("");
  const [importError,setImportError]         = useState("");
  const [renameValue,setRenameValue]         = useState("");

  // Persistence state
  const [saving,setSaving]   = useState(false);   // file save indicator
  const [toast,setToast]     = useState(null);    // {msg} or null
  const [loadingFiles,setLoadingFiles] = useState(false);  // hub file loading
  const [commentsLoading, setCommentsLoading] = useState(false); // comments loading indicator

  const showToast = (msg) => setToast({msg});

  // ── TAG HELPERS ───────────────────────────────────────────
  const getEntityTags = (type, id) =>
    entityTags.filter(et => et.entity_type === type && String(et.entity_id) === String(id));

  const attachTag = async (entityType, entityId, tagName, color="#3b82f6") => {
    try {
      const res = await tagsApi.attachByName(tagName.trim(), entityType, entityId, color);
      setEntityTags(prev => [...prev.filter(et => !(et.tag_id===res.tag_id&&et.entity_type===entityType&&String(et.entity_id)===String(entityId))), res]);
      setUserTags(prev => prev.find(t=>t.id===res.tag_id) ? prev : [...prev, {id:res.tag_id,name:res.name,color:res.color}]);
    } catch(e) { showToast("Failed to attach tag"); }
  };

  const detachTag = async (entityType, entityId, tagId) => {
    try {
      await tagsApi.detach(tagId, entityType, entityId);
      setEntityTags(prev => prev.filter(et => !(et.tag_id===tagId&&et.entity_type===entityType&&String(et.entity_id)===String(entityId))));
    } catch(e) { showToast("Failed to remove tag"); }
  };

  const QuickTagRow = ({entityType, entityId}) => {
    const key = `${entityType}:${entityId}`;
    const tags = getEntityTags(entityType, entityId);
    const inputVal = tagInput[key] || "";
    const suggestions = inputVal.length >= 1
      ? userTags.filter(t => t.name.toLowerCase().includes(inputVal.toLowerCase()) && !tags.find(et=>et.tag_id===t.id))
      : [];
    return (
      <div style={{display:"flex",flexWrap:"wrap",gap:3,alignItems:"center",marginTop:4}}>
        {tags.map(t=><TagPill key={t.id} tag={t} onRemove={()=>detachTag(entityType,entityId,t.tag_id)}/>)}
        <div style={{position:"relative",display:"inline-flex"}}>
          <input
            style={{...S.input,width:90,padding:"1px 5px",fontSize:9,height:18}}
            placeholder="+ tag"
            value={inputVal}
            onChange={e=>setTagInput(prev=>({...prev,[key]:e.target.value}))}
            onKeyDown={e=>{
              if(e.key==="Enter"&&inputVal.trim()){
                attachTag(entityType,entityId,inputVal.trim());
                setTagInput(prev=>({...prev,[key]:""}));
                e.preventDefault();
              }
            }}
          />
          {suggestions.length>0&&(
            <div style={{position:"absolute",top:20,left:0,zIndex:50,background:C.surface,border:`1px solid ${C.border}`,borderRadius:4,minWidth:120}}>
              {suggestions.slice(0,5).map(t=>(
                <div key={t.id} style={{padding:"3px 8px",fontSize:9,cursor:"pointer",color:t.color}}
                  onMouseDown={e=>{e.preventDefault();attachTag(entityType,entityId,t.name,t.color);setTagInput(prev=>({...prev,[key]:""}))}}>
                  {t.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── SEED DEFAULTS — called if areas, goals or templates are empty ─────────────
  useEffect(() => {
    if (areas.length === 0 && user) {
      const defaults = [
        { name: "Business / Revenue", color: "#1a4fd6", icon: "💼", description: "Revenue generating projects", sort_order: 1 },
        { name: "Health / Body", color: "#10b981", icon: "🏋️", description: "Physical health and training", sort_order: 2 },
        { name: "Relationships", color: "#ec4899", icon: "❤️", description: "Friends, family, and networking", sort_order: 3 },
        { name: "Creative / Learning", color: "#8b5cf6", icon: "🎨", description: "Skill building and side projects", sort_order: 4 },
        { name: "Personal / Admin", color: "#64748b", icon: "🏠", description: "Life maintenance and logistics", sort_order: 5 },
      ];
      Promise.all(defaults.map(d => areasApi.create(d))).then(() => {
        areasApi.list().then(data => setAreas(data.areas || []));
      });
    }
    if (goals.length === 0 && user) {
        const defaultGoal = { title: "Bootstrap → Thailand", target_amount: 3000, currency: "GBP", category: "income" };
        goalsApi.create(defaultGoal).then(() => {
            goalsApi.list().then(data => {
                setGoals(data.goals || []);
                if (data.goals?.length) setActiveGoalId(data.goals[0].id);
            });
        });
    }
    if (templates.length === 0 && user) {
      const defaults = [
        { name: "BUIDL Framework", icon: "🚀", category: "software", description: "The core BUIDL framework with all phases and standard folders.", config: { phases: ["BOOTSTRAP","UNLEASH","INNOVATE","DECENTRALIZE","LEARN","SHIP"], folders: STANDARD_FOLDERS.map(f=>f.id) }, is_system: true },
        { name: "Software Project", icon: "🛠", category: "software", description: "Code-focused project with planning, dev, and testing phases.", config: { phases: ["PLANNING", "DEVELOPMENT", "TESTING", "DEPLOYED"], folders: ["code-modules", "project-artifacts", "qa", "infrastructure", "system"] }, is_system: true },
        { name: "Content Project", icon: "✍️", category: "creative", description: "Content creation workflow from research to publishing.", config: { phases: ["RESEARCH", "DRAFTING", "REVIEW", "PUBLISHED"], folders: ["content-assets", "design-assets", "marketing", "system"] }, is_system: true },
        { name: "Blank", icon: "📄", category: "custom", description: "A minimal starting point with only core files.", config: { phases: [], folders: ["system"] }, is_system: true }
      ];
      Promise.all(defaults.map(d => templatesApi.create(d))).then(() => {
        templatesApi.list().then(data => setTemplates(data.templates || []));
      });
    }
  }, [areas.length, goals.length, templates.length, user]);

  // ── DERIVED ────────────────────────────────────────────────
  const hub          = projects.find(p=>p.id===hubId);
  const focusP       = projects.find(p=>p.id===focusId);
  const activeGoal = goals.find(g => g.id === (activeGoalId || (goals.length ? goals[0].id : null)));
  const totalIncome = activeGoal ? activeGoal.current_amount : projects.reduce((s,p)=>s+(p.incomeTarget||0),0);
  const atRisk       = projects.filter(p=>p.health<50).length;
  const inReview     = staging.filter(s=>s.status==="in-review").length;
  const hubAllFolders= hub?[...STANDARD_FOLDERS,...(hub.customFolders||[])]:STANDARD_FOLDERS;

  // Area health logic
  const areaStats = areas.map(a => {
    const areaProjects = projects.filter(p => p.areaId === a.id);
    const health = areaProjects.length ? Math.round(areaProjects.reduce((s,p)=>s+p.health,0)/areaProjects.length) : 100;
    return { ...a, health, projectCount: areaProjects.length };
  });

  const [activeAreaFilter, setActiveAreaFilter] = useState(null);
  const filteredProjects = activeAreaFilter ? projects.filter(p => p.areaId === activeAreaFilter) : projects;

  // ── SESSION TIMER ──────────────────────────────────────────
  useEffect(()=>{
    if(sessionActive){
      sessionStart.current=new Date();
      timerRef.current=setInterval(()=>setSessionSecs(s=>s+1),1000);

      const handleBeforeUnload = (e) => {
        // We can't await endSession() here, but we can try to fire a beacon or sync request if we were using a different API pattern.
        // For now, we'll just log that we should save. In a real environment, we'd use navigator.sendBeacon.
        const dur = Math.floor((new Date() - sessionStart.current) / 1000);
        const data = JSON.stringify({
          project_id: focusId,
          duration_s: dur,
          log: "(Auto-saved on tab close)",
          started_at: sessionStart.current?.toISOString(),
          ended_at: new Date().toISOString()
        });
        // Try beacon if API supported it without complex auth headers,
        // but our API needs Bearer token which beacon doesn't support well.
        // So we just add the standard listener to prompt user.
        e.preventDefault();
        e.returnValue = '';
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        clearInterval(timerRef.current);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    } else {
      clearInterval(timerRef.current);
    }
  },[sessionActive, focusId]);
  const fmtTime=s=>`${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  // ── COMMENTS LOADER — fetch from DB when hub or active file changes ──
  useEffect(() => {
    if (!hubId || !hub?.activeFile) return;
    const filePath = hub.activeFile;
    const commKey = `${hubId}:${filePath}`;
    setCommentsLoading(true);
    commentsApi.list(hubId, filePath)
      .then(({ comments: rows }) => {
        const mapped = (rows || []).map(r => ({
          id: r.id,
          text: r.text,
          date: r.created_at ? r.created_at.toString().slice(0, 10) : "",
          resolved: !!r.resolved,
        }));
        setComments(prev => ({ ...prev, [commKey]: mapped }));
      })
      .catch(() => { /* silently ignore — existing UI still works */ })
      .finally(() => setCommentsLoading(false));
  }, [hubId, hub?.activeFile]);

  // ── HUB LINKS — reload when hub changes ─────────────────────
  useEffect(() => {
    if (!hubId) return;
    linksApi.query('project', hubId)
      .then(d => setHubLinks(d.links || []))
      .catch(() => {});
  }, [hubId]);

  // ── USER SETTINGS — load once on login ──────────────────────
  useEffect(() => {
    if (!user) return;
    settingsApi.get()
      .then(d => {
        if (d.settings && Object.keys(d.settings).length) {
          setUserSettings(s => ({...s, ...d.settings}));
          setSettingsForm(s => ({...s, ...d.settings}));
        }
      })
      .catch(() => {});
  }, [user?.id]);

  // ── NAVIGATION — lazy-loads files on first hub open ────────
  const openHub = async (id, file) => {
    const proj = projects.find(p => p.id === id);
    const targetFile = file || proj?.activeFile || "PROJECT_OVERVIEW.md";

    setHubId(id);
    setView("hub");
    setHubTab("editor");

    // If files haven't been loaded yet, fetch from API
    if (!proj?.files) {
      setLoadingFiles(true);
      try {
        const res = await projectsApi.get(id);
        const loaded = res.project;
        setProjects(prev => prev.map(p => p.id === id ? {
          ...p,
          files: loaded.files || {},
          customFolders: loaded.customFolders || p.customFolders || [],
          activeFile: targetFile,
        } : p));
      } catch (e) {
        showToast("⚠ Failed to load project files");
      } finally {
        setLoadingFiles(false);
      }
    } else {
      // Files already loaded — just switch active file
      setProjects(prev => prev.map(p => p.id === id ? { ...p, activeFile: targetFile } : p));
      projectsApi.setActiveFile(id, targetFile).catch(() => {});
    }
  };

  // ── FILE OPS — optimistic + persisted ─────────────────────
  const saveFile = useCallback(async (projId, path, content) => {
    // Optimistic update
    setProjects(prev => prev.map(p => p.id === projId ? { ...p, files: { ...p.files, [path]: content } } : p));
    setSaving(true);
    try {
      await projectsApi.saveFile(projId, path, content);
      showToast("✓ Saved");
    } catch (e) {
      showToast("⚠ Save failed — check connection");
    } finally { setSaving(false); }
  }, []);

  const handleHubSave = useCallback((path, content) => {
    if (hubId) saveFile(hubId, path, content);
  }, [hubId, saveFile]);

  const createFile=async(projId,folder,name)=>{
    if(!name.trim())return;
    const path=folder?`${folder}/${name}`:name;
    const ext=name.split(".").pop();
    const def=ext==="md"?`# ${name.replace(".md","")}\n\n`:ext==="json"?"{}\n":"";
    // Optimistic
    setProjects(prev=>prev.map(p=>p.id===projId?{...p,files:{...p.files,[path]:def},activeFile:path}:p));
    setModal(null);setNewFileName("");
    // Persist
    await projectsApi.saveFile(projId,path,def).catch(()=>{});
    await projectsApi.setActiveFile(projId,path).catch(()=>{});
  };

  const deleteFile=async(projId,path)=>{
    setProjects(prev=>prev.map(p=>{if(p.id!==projId)return p;const f={...p.files};delete f[path];return{...p,files:f,activeFile:p.activeFile===path?"PROJECT_OVERVIEW.md":p.activeFile};}));
    await projectsApi.deleteFile(projId,path).catch(()=>{});
  };

  const addCustomFolder=async(projId,folder)=>{
    setProjects(prev=>prev.map(p=>{
      if(p.id!==projId)return p;
      const cfs=[...(p.customFolders||[]),folder];
      const files={...p.files,[`${folder.id}/.gitkeep`]:""};
      const manifest=makeManifest({...p,customFolders:cfs});
      files["manifest.json"]=JSON.stringify(manifest,null,2);
      return{...p,customFolders:cfs,files};
    }));
    setModal(null);setCFForm({id:"",label:"",icon:"📁",desc:""});
    // Persist folder + gitkeep + manifest
    await projectsApi.addFolder(projId,folder).catch(()=>{});
    await projectsApi.saveFile(projId,`${folder.id}/.gitkeep`,"").catch(()=>{});
  };

  // ── PROJECT CRUD — persisted ───────────────────────────────
  const createProject=async(form)=>{
    const id=form.name.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"")+"-"+Date.now().toString(36);
    const template = templates.find(t=>t.id===form.templateId);
    const phase = template?.config?.phases?.[0] || form.phase || "BOOTSTRAP";

    const proj=makeProject(id,form.name,form.emoji,phase,"active",projects.length+1,false,form.desc,"Run Bootstrap Protocol → define scope with agents",[],["new"],3,new Date().toISOString().slice(0,7),form.incomeTarget||0,["dev","strategy"],[], template?.config);
    proj.areaId = form.areaId || null;
    // Optimistic
    setProjects(prev=>[...prev,proj]);
    setFocusId(id);setModal(null);
    setNewProjForm({name:"",emoji:"📁",phase:"BOOTSTRAP",desc:""});
    // Persist — create project then all default files
    try{
      await projectsApi.create(proj);
      for(const [path,content] of Object.entries(proj.files)){
        await projectsApi.saveFile(id,path,content);
      }
      showToast("✓ Project created");
      setBootstrapWiz(id);
    }catch(e){showToast("⚠ Failed to save project to database");}
  };

  const updateProject=async(projId,updates)=>{
    setProjects(prev=>prev.map(p=>p.id===projId?{...p,...updates,health:calcHealth({...p,...updates})}:p));
    await projectsApi.update(projId,updates).catch(()=>{});
  };

  const renameProject=async(projId,newName)=>{
    let updatedFiles = {};
    setProjects(prev=>{
      const newProjects = prev.map(p=>{
        if(p.id!==projId)return p;
        const files={...p.files};
        if(files["PROJECT_OVERVIEW.md"])files["PROJECT_OVERVIEW.md"]=files["PROJECT_OVERVIEW.md"].replace(/^# .+$/m,`# ${newName}`);
        const manifest=makeManifest({...p,name:newName});
        files["manifest.json"]=JSON.stringify(manifest,null,2);
        updatedFiles = files; // capture for re-save
        return{...p,name:newName,files};
      });
      return newProjects;
    });
    setModal(null);
    await projectsApi.update(projId,{name:newName}).catch(()=>{});
    // Re-save overview + manifest
    if(updatedFiles["PROJECT_OVERVIEW.md"]){
      await projectsApi.saveFile(projId,"PROJECT_OVERVIEW.md",updatedFiles["PROJECT_OVERVIEW.md"]).catch(()=>{});
    }
    if(updatedFiles["manifest.json"]){
      await projectsApi.saveFile(projId,"manifest.json",updatedFiles["manifest.json"]).catch(()=>{});
    }
  };

  const deleteProject=async(projId)=>{
    setProjects(prev=>prev.filter(p=>p.id!==projId));
    setStaging(prev=>prev.filter(s=>s.project!==projId));
    if(hubId===projId){setView("brain");setHubId(null);}
    if(focusId===projId){const rem=projects.filter(p=>p.id!==projId);if(rem.length)setFocusId(rem[0].id);}
    setModal(null);
    await projectsApi.delete(projId).catch(()=>{});
  };

  const completeBootstrap=async(projId,brief)=>{
    const proj=projects.find(p=>p.id===projId);
    if(!proj){
      showToast("⚠ Error: Project not found. Refresh and try again.");
      return;
    }
    const today=new Date().toISOString().slice(0,10);
    const newCustomFolders=(brief.customFolders||[]).filter(Boolean).map(f=>({id:f.toLowerCase().replace(/\s+/g,"-"),label:f,icon:"📁",desc:"Custom folder from Bootstrap Brief"}));

    // Build the bootstrap files
    const bootstrapFiles={
      "project-artifacts/BOOTSTRAP_BRIEF.md":`# Bootstrap Brief — ${brief.name||""}\nGenerated: ${today}\n\n## Problem\n${brief.problem||""}\n\n## Solution\n${brief.solution||""}\n\n## Target User\n${brief.targetUser||""}\n\n## Revenue Model\n${brief.revenueModel||""}\n\n## MVP Features\n${(brief.mvpFeatures||[]).filter(Boolean).map((f,i)=>`${i+1}. ${f}`).join("\n")||"- TBD"}\n\n## Tech Stack\n${brief.techStack||"Open"}\n\n## Design Style\n${brief.designStyle||"Open"}\n\n## Agent Rules\n${brief.agentRules||"None"}\n`,
      "project-artifacts/STRATEGY_PROMPT.md":`# Strategy Agent — Project Brief\nDate: ${today}\n\nRead project-artifacts/BOOTSTRAP_BRIEF.md then produce:\n1. Scope Validation\n2. Prioritised Feature List\n3. Revenue Rationale\n4. Risk Register\n\nSave output to: project-artifacts/STRATEGY_OUTPUT.md\nUpdate: DEVLOG.md\n`,
      "project-artifacts/DEV_PROMPT.md":`# Dev Agent — Technical Brief\nDate: ${today}\n\nRead BOOTSTRAP_BRIEF.md and STRATEGY_OUTPUT.md then produce:\n1. Tech Stack Decision\n2. Component Architecture\n3. Bolt One-Shot Prompt\n4. Deployment Plan\n\nSave to: code-modules/DEV_BRIEF.md\nUpdate: DEVLOG.md\n`,
      "system/SKILL.md":`# SKILL.md — Project Overrides\nGenerated: ${today}\n\n## Dev\n${brief.techStack?`- Stack: ${brief.techStack}`:""}\n\n## Design\n${brief.designStyle?`- Style: ${brief.designStyle}`:""}\n\n## Content\n- Tone: ${brief.contentTone||"Builder-first"}\n\n## Rules\n${brief.agentRules||"None"}\n`,
      "system/AGENT_ONBOARDING.md":`# Agent Onboarding\nGenerated: ${today}\n\n1. Read manifest.json\n2. Read project-artifacts/BOOTSTRAP_BRIEF.md\n3. Read system/SKILL.md\n4. Read DEVLOG.md\n5. Do your work → save to correct folder → update DEVLOG\n\n## Agent Team\n${(brief.selectedAgents||[]).join(", ")}\n`,
    };

    // Optimistic update
    setProjects(prev=>prev.map(p=>{
      if(p.id!==projId)return p;
      const allCustom=[...(p.customFolders||[]),...newCustomFolders];
      const folderKeeps={};newCustomFolders.forEach(f=>{folderKeeps[`${f.id}/.gitkeep`]="";});
      const allFiles={...(p.files||{}),...bootstrapFiles,...folderKeeps};
      const updated={...p,customFolders:allCustom,skills:brief.selectedAgents,nextAction:"Step 1: Copy STRATEGY_PROMPT.md → paste into Claude → run strategy agent",files:allFiles};
      updated.files["manifest.json"]=JSON.stringify(makeManifest(updated),null,2);
      updated.files["PROJECT_OVERVIEW.md"]=`# ${p.name}\n\n## One-Liner\n${brief.solution||""}\n\n## Problem\n${brief.problem||""}\n\n## Agent Team\n${(brief.selectedAgents||[]).join(", ")}\n\n## Bootstrap Status\n- [x] Brief written\n- [ ] Strategy Agent run\n- [ ] Dev Agent run\n`;
      return updated;
    }));
    setBootstrapWiz(null);
    openHub(projId,"project-artifacts/BOOTSTRAP_BRIEF.md");

    // Persist everything
    try{
      const proj=projects.find(p=>p.id===projId);
      await projectsApi.update(projId,{skills:brief.selectedAgents,nextAction:"Run Strategy Agent"});
      for(const [path,content] of Object.entries(bootstrapFiles)){
        await projectsApi.saveFile(projId,path,content);
      }
      for(const f of newCustomFolders){
        await projectsApi.addFolder(projId,f);
        await projectsApi.saveFile(projId,`${f.id}/.gitkeep`,"");
      }
      // Add staging reminder
      const s={id:`bs-${Date.now()}`,project_id:projId,name:"Bootstrap complete — run Strategy Agent next",tag:"DRAFT_",status:"in-review",notes:"Copy STRATEGY_PROMPT.md → paste into Claude → save output as STRATEGY_OUTPUT.md",added:new Date().toISOString().slice(0,7)};
      const res=await stagingApi.create(s);
      setStaging(prev=>[...prev,{...s,id:res.id||s.id,project:projId}]);
      showToast("✓ Bootstrap files saved");
    }catch(e){showToast("⚠ Bootstrap saved locally — DB sync failed");}
  };

  // ── STAGING OPS — persisted ────────────────────────────────
  const addStaging=async(item)=>{
    const tmp={...item,id:`tmp-${Date.now()}`,status:"in-review",added:new Date().toISOString().slice(0,7)};
    setStaging(prev=>[...prev,tmp]);
    try{
      const res=await stagingApi.create({...item,project_id:item.project});
      setStaging(prev=>prev.map(s=>s.id===tmp.id?{...s,id:res.id}:s));
    }catch{showToast("⚠ Staging save failed");}
  };

  const updateStagingStatus=async(id,status)=>{
    setStaging(prev=>prev.map(s=>s.id===id?{...s,status}:s));
    await stagingApi.update(id,{status}).catch(()=>{});
  };

  // ── IDEAS OPS — persisted ──────────────────────────────────
  const addIdea=async(title)=>{
    if(!title.trim())return;
    const tmp={id:`tmp-${Date.now()}`,title:title.trim(),score:5,tags:["new"],added:new Date().toISOString().slice(0,7)};
    setIdeas(prev=>[...prev,tmp]);
    setNewIdea("");
    try{
      const res=await ideasApi.create({title:title.trim(),score:5,tags:["new"]});
      setIdeas(prev=>prev.map(i=>i.id===tmp.id?{...i,id:res.id}:i));
    }catch{showToast("⚠ Idea save failed");}
  };

  // ── SESSION END — persisted ────────────────────────────────
  const endSession=async()=>{
    const dur=sessionSecs, log=sessionLog;
    if(log.trim()){
      // Save to devlog file
      const entry=`\n## ${new Date().toISOString().slice(0,10)} — ${fmtTime(dur)}\n\n${log}\n`;
      const proj=projects.find(p=>p.id===focusId);
      if(proj){
        const current=(proj.files||{})["DEVLOG.md"]||"";
        await saveFile(focusId,"DEVLOG.md",current+entry);
      }
    }
    // Log session to DB
    await sessionsApi.create({project_id:focusId,duration_s:dur,log,started_at:sessionStart.current?.toISOString(),ended_at:new Date().toISOString()}).catch(()=>{});
    setSessionOn(false);setSessionSecs(0);setSessionLog("");
  };

  // ── DRAG & DROP ────────────────────────────────────────────
  const handleDrop=useCallback((e,projId)=>{
    e.preventDefault();setDragOver(false);
    Array.from(e.dataTransfer.files).forEach(file=>{
      const reader=new FileReader();
      reader.onload=async(ev)=>{
        const content=ev.target.result;
        const path=`staging/${file.name}`;
        setProjects(prev=>prev.map(p=>p.id===projId?{...p,files:{...(p.files||{}),[path]:content}}:p));
        const s={name:file.name,tag:"DRAFT_",project:projId,notes:`Uploaded ${new Date().toISOString().slice(0,10)}`};
        await addStaging(s);
        await projectsApi.saveFile(projId,path,content).catch(()=>{});
      };
      if(file.type.startsWith("text")||["md","json","js","ts","py","sol","txt","css","html"].some(e=>file.name.endsWith("."+e)))reader.readAsText(file);
      else reader.readAsDataURL(file);
    });
  },[]);

  // ── EXPORT (local download — no API change needed) ─────────
  const exportProject=(projId)=>{
    const proj=projects.find(p=>p.id===projId);if(!proj)return;
    const content=buildZipExport({...proj,files:{...(proj.files||{}),"manifest.json":JSON.stringify(makeManifest(proj),null,2)}});
    const blob=new Blob([content],{type:"text/plain"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=`${proj.id}-buidl-export.txt`;a.click();
    URL.revokeObjectURL(url);
  };

  // ── SEARCH — uses DB full-text search ──────────────────────
  const runSearch=async(q)=>{
    if(!q.trim()){setSearchRes([]);return;}
    try{
      const{results}=await searchApi.query(q);
      setSearchRes((results||[]).map(r=>({projId:r.project_id,projName:r.project_name,emoji:r.emoji,path:r.path,excerpt:r.excerpt||""})));
    }catch{
      // Fallback to in-memory search
      const res=[];
      projects.forEach(p=>Object.entries(p.files||{}).forEach(([path,content])=>{
        if(typeof content==="string"&&content.toLowerCase().includes(q.toLowerCase())){
          const idx=content.toLowerCase().indexOf(q.toLowerCase());
          res.push({projId:p.id,projName:p.name,emoji:p.emoji,path,excerpt:content.slice(Math.max(0,idx-30),idx+60)});
        }
      }));
      setSearchRes(res.slice(0,15));
    }
  };

  // ── CONTEXT + BRIEFINGS + AI ───────────────────────────────
  const buildCtx=(projId=null)=>JSON.stringify({
    agent_context:"THE BRAIN v6 — Wired Edition",generated:new Date().toISOString(),
    operator:{name:user?.name||"Builder",email:user?.email,goal:user?.goal||"Bootstrap → Thailand",monthly_target:user?.monthly_target||THAILAND_TARGET},
    today_focus:focusId,
    projects:(projId?projects.filter(p=>p.id===projId):projects).map(p=>({id:p.id,name:p.name,phase:p.phase,status:p.status,priority:p.priority,revenue_ready:p.revenueReady,health:p.health,momentum:p.momentum,next_action:p.nextAction,blockers:p.blockers,tags:p.tags,income_target:p.incomeTarget,skills:p.skills,staging_pending:staging.filter(s=>s.project===p.id&&s.status==="in-review").length})),
    global_staging:staging,ideas:ideas.map(i=>({title:i.title,score:i.score})),
  },null,2);

  const buildBrief=(skillId,projId)=>{const sk=SKILLS[skillId];const proj=projects.find(p=>p.id===projId);if(!sk||!proj)return"";return`# ${sk.icon} ${sk.label} Briefing — ${proj.emoji} ${proj.name}\n\n## Role\n${sk.description}\n\n## Project\n- **${proj.name}** (${proj.phase}, Priority #${proj.priority})\n- Status: ${proj.status} | Health: ${proj.health}/100\n- Next: ${proj.nextAction}\n- Blockers: ${proj.blockers?.join(", ")||"None"}\n\n## Prompt Prefix\n> ${sk.prompt_prefix}\n\n## SOP\n${sk.sop.map((s,i)=>`${i+1}. ${s}`).join("\n")}\n\n## Permissions\n✅ ${sk.permissions.join(", ")}\n🚫 ${sk.ignore.join(", ")}\n\n## Context\n\`\`\`json\n${buildCtx(projId)}\n\`\`\``;};

  const copy=(text)=>{navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2000);};

  const askAI=async(prompt)=>{
    setAiLoad(true);setAiOut("");
    const sys=`You are The Brain AI Coach for ${user?.name||"this builder"}, targeting £${user?.monthly_target||3000}/mo. Direct, max 250 words. Reference specific projects. Context:\n${buildCtx()}`;
    try{
      const d = await aiApi.ask(prompt, sys);
      setAiOut(d.content?.map(b=>b.text||"").join("")||"No response.");
    }catch(e){
      setAiOut(e.message || "Connection error.");
    }
    setAiLoad(false);setTimeout(()=>aiRef.current?.scrollIntoView({behavior:"smooth"}),100);
  };

  // ── INTEGRATIONS (UI only for now) ─────────────────────────
  const [integrations,setIntegrations]=useState([
    {id:"github",icon:"🐙",label:"GitHub",desc:"Repo status, last commit",connected:false,fields:["repoUrl","accessToken"],docsUrl:"https://docs.github.com/en/rest"},
    {id:"netlify",icon:"🟢",label:"Netlify",desc:"Deploy status, build logs",connected:false,fields:["siteId","apiToken"],docsUrl:"https://docs.netlify.com/api/get-started/"},
    {id:"tidb",icon:"🐬",label:"TiDB",desc:"DB connected",connected:true,fields:[],docsUrl:"https://tidbcloud.com"},
    {id:"farcaster",icon:"🟣",label:"Farcaster",desc:"Publish build-in-public",connected:false,fields:["fid","signerUuid"],docsUrl:"https://docs.farcaster.xyz/"},
    {id:"twitter",icon:"🐦",label:"Twitter/X",desc:"Post launch threads",connected:false,fields:["apiKey","apiSecret"],docsUrl:"https://developer.twitter.com/en/docs"},
    {id:"base",icon:"🔵",label:"Base Chain",desc:"Deploy contracts, mint",connected:false,fields:["rpcUrl","walletAddress"],docsUrl:"https://docs.base.org/"},
  ]);

  // ── TAB DEFINITIONS ────────────────────────────────────────
  const BRAIN_TABS=[{id:"command",label:"⚡ Command"},{id:"projects",label:"🗂 Projects"},{id:"bootstrap",label:"🚀 Bootstrap"},{id:"staging",label:`🌀 Staging${inReview>0?` (${inReview})`:""}`},{id:"skills",label:"🤖 Skills"},{id:"workflows",label:"⚙️ Workflows"},{id:"integrations",label:"🔌 Connect"},{id:"ideas",label:"💡 Ideas"},{id:"tags",label:`🏷 Tags${userTags.length>0?` (${userTags.length})`:""}`},{id:"ai",label:"💬 AI Coach"},{id:"export",label:"📤 Export"}];
  const HUB_TABS=[{id:"editor",label:"📝 Editor"},{id:"overview",label:"📊 Overview"},{id:"folders",label:"📁 Folders"},{id:"review",label:`🔄 Review${hub?staging.filter(s=>s.project===hubId&&s.status==="in-review").length>0?` (${staging.filter(s=>s.project===hubId&&s.status==="in-review").length})`:"":""}`},{id:"devlog",label:"📓 Dev Log"},{id:"gantt",label:"📅 Timeline"},{id:"comments",label:"💬 Comments"},{id:"links",label:`🔗 Links${hubLinks.length>0?` (${hubLinks.length})`:""}`},{id:"meta",label:"🔧 Meta"}];

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <div style={{...S.root,fontFamily:`'${userSettings.font}','JetBrains Mono','Fira Code',monospace`,fontSize:userSettings.fontSize}}>
      {toast&&<Toast msg={toast.msg} onDone={()=>setToast(null)}/>}

      {/* ── TOP BAR ── */}
      <div style={{background:"linear-gradient(180deg,#0a0f1e,#070b14)",borderBottom:`1px solid ${C.border}`,padding:"12px 20px 0"}}>
        <div style={{maxWidth:1200,margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <div>
                <div style={{fontSize:9,color:C.blue,letterSpacing:"0.2em",textTransform:"uppercase"}}>Project OS · v6 · {user?.name||user?.email||"Builder"}</div>
                <div style={{fontSize:18,fontWeight:700,color:"#f1f5f9",lineHeight:1.1}}>{view==="hub"&&hub?`${hub.emoji} ${hub.name}`:"THE BRAIN 🧠"}</div>
              </div>
              <div style={{display:"flex",gap:3}}>
                <button style={S.btn(view==="brain"?"primary":"ghost")} onClick={()=>setView("brain")}>🧠 Brain</button>
                {hub&&<button style={S.btn(view==="hub"?"primary":"ghost")} onClick={()=>setView("hub")}>🗂 Hub</button>}
                <button style={{...S.btn("ghost"),fontSize:9}} onClick={()=>setModal("new-project")}>+ Project</button>
              </div>
              {/* Search */}
              <div style={{position:"relative"}}>
                <input style={{...S.input,width:180,fontSize:10,padding:"5px 10px"}} placeholder="🔍 Search all files..." value={searchQ} onChange={e=>{setSearchQ(e.target.value);runSearch(e.target.value);setShowSearch(true);}} onFocus={()=>setShowSearch(true)} onBlur={()=>setTimeout(()=>setShowSearch(false),200)}/>
                {showSearch&&searchRes.length>0&&(
                  <div style={{position:"absolute",top:"100%",left:0,width:380,background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,zIndex:200,maxHeight:280,overflowY:"auto",marginTop:2}}>
                    {searchRes.map((r,i)=><div key={i} onClick={()=>{openHub(r.projId,r.path);setShowSearch(false);}} style={{padding:"8px 12px",cursor:"pointer",borderBottom:`1px solid ${C.border}`}} onMouseEnter={e=>e.currentTarget.style.background="#ffffff08"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <div style={{fontSize:10,color:C.text}}>{r.emoji} {r.projName} · <span style={{color:C.muted}}>{r.path}</span></div>
                      <div style={{fontSize:9,color:C.dim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>...{r.excerpt}...</div>
                    </div>)}
                  </div>
                )}
              </div>
            </div>

            <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
              {/* Settings gear */}
              <button style={{...S.btn("ghost"),padding:"5px 8px",fontSize:13}} title="Settings" onClick={...}>⚙️</button>
            {/* Session timer */}
              <div onClick={()=>{if(!sessionActive)setSessionOn(true);else endSession();}} style={{background:sessionActive?"rgba(16,185,129,0.08)":C.surface,border:`1px solid ${sessionActive?"#10b98140":C.border}`,borderRadius:6,padding:"5px 11px",textAlign:"center",cursor:"pointer"}}>
                <div style={{fontSize:12,fontWeight:700,color:sessionActive?C.green:"#475569",fontVariantNumeric:"tabular-nums"}}>{sessionActive?fmtTime(sessionSecs):"▶ START"}</div>
                <div style={{fontSize:8,color:C.dim,textTransform:"uppercase"}}>{sessionActive?"End & Log":"Session"}</div>
              </div>
              {[{v:projects.length,l:"Projects"},{v:`${activeGoal?.currency==='USD'?'$':activeGoal?.currency==='EUR'?'€':'£'}${totalIncome}`,l:activeGoal?.title||"Goal"},{v:`${Math.round(totalIncome/(activeGoal?.target_amount||3000)*100)}%`,l:"Status"},atRisk>0?{v:atRisk,l:"⚠ At Risk",c:C.amber}:null].filter(Boolean).map(s=>(
                <div key={s.l} style={{textAlign:"center"}}><div style={{fontSize:15,fontWeight:700,color:s.c||C.blue2}}>{s.v}</div><div style={{fontSize:8,color:C.dim,textTransform:"uppercase"}}>{s.l}</div></div>
              ))}
              <button style={{...S.btn("ghost"),fontSize:9}} onClick={onLogout}>Sign Out</button>
            </div>
          </div>

          {sessionActive&&<div style={{display:"flex",gap:6,marginBottom:8}}>
            <input style={{...S.input,fontSize:11}} placeholder="What are you working on?" value={sessionLog} onChange={e=>setSessionLog(e.target.value)}/>
            <button style={{...S.btn("danger"),fontSize:9}} onClick={endSession}>End & Log</button>
          </div>}

          <div style={{display:"flex",gap:0,flexWrap:"wrap"}}>
            {view==="brain"?BRAIN_TABS.map(t=><button key={t.id} style={S.tab(mainTab===t.id)} onClick={()=>{setMainTab(t.id); if(t.id!=="command") setActiveAreaFilter(null);}}>{t.label}</button>)
              :HUB_TABS.map(t=><button key={t.id} style={S.tab(hubTab===t.id,"#10b981")} onClick={()=>setHubTab(t.id)}>{t.label}</button>)}
            {view==="hub"&&hub&&<div style={{marginLeft:"auto",display:"flex",gap:4,paddingBottom:4}}>
              <button style={{...S.btn("ghost"),fontSize:9}} onClick={()=>setModal("new-custom-folder")}>+ Folder</button>
              <button style={{...S.btn("ghost"),fontSize:9}} onClick={()=>{setRenameValue(hub.name);setModal("rename-project");}}>✏ Rename</button>
              <button style={{...S.btn("ghost"),fontSize:9}} onClick={()=>exportProject(hubId)}>⬇ Export</button>
              <button style={{...S.btn("danger"),fontSize:9}} onClick={()=>setModal("delete-project")}>🗑</button>
            </div>}
          </div>
        </div>
      </div>

      {/* ── MODALS ── */}
      {modal==="new-project"&&(
        <Modal title="New Project" onClose={()=>setModal(null)}>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <input style={{...S.input,width:60}} placeholder="🚀" value={newProjForm.emoji} onChange={e=>setNewProjForm(f=>({...f,emoji:e.target.value}))}/>
            <input style={S.input} placeholder="Project name..." value={newProjForm.name} onChange={e=>setNewProjForm(f=>({...f,name:e.target.value}))} autoFocus/>
          </div>
          <select style={{...S.sel,marginBottom:8}} value={newProjForm.templateId} onChange={e=>setNewProjForm(f=>({...f,templateId:e.target.value}))}>
            <option value="">Select Template...</option>
            {templates.map(t=><option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
          </select>
          {(!newProjForm.templateId || templates.find(t=>t.id===newProjForm.templateId)?.config?.phases?.length > 0) && (
            <select style={{...S.sel,marginBottom:8}} value={newProjForm.phase} onChange={e=>setNewProjForm(f=>({...f,phase:e.target.value}))}>
                {newProjForm.templateId ? templates.find(t=>t.id===newProjForm.templateId).config.phases.map(p=><option key={p}>{p}</option>) : BUIDL_PHASES.map(p=><option key={p}>{p}</option>)}
            </select>
          )}
          <textarea style={{...S.input,height:60,resize:"vertical",marginBottom:8}} placeholder="One sentence description..." value={newProjForm.desc} onChange={e=>setNewProjForm(f=>({...f,desc:e.target.value}))}/>
          <select style={{...S.sel,marginBottom:12}} value={newProjForm.areaId} onChange={e=>setNewProjForm(f=>({...f,areaId:e.target.value}))}>
            <option value="">Assign to Area (Optional)</option>
            {areas.map(a=><option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
          </select>
          <div style={{display:"flex",gap:6}}>
            <button style={S.btn("primary")} onClick={()=>newProjForm.name.trim()&&createProject(newProjForm)}>Create + Save to DB</button>
            <button style={S.btn("ghost")} onClick={()=>setModal(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {modal==="new-file"&&hub&&(
        <Modal title={`New File — ${hub.name}`} onClose={()=>setModal(null)}>
          <select style={{...S.sel,marginBottom:8}} value={newFileFolder} onChange={e=>setNewFileFolder(e.target.value)}>
            <option value="">Root</option>
            {hubAllFolders.map(f=><option key={f.id} value={f.id}>{f.icon||"📁"} {f.label}</option>)}
          </select>
          <input style={{...S.input,marginBottom:8}} placeholder="filename.md" value={newFileName} onChange={e=>setNewFileName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createFile(hubId,newFileFolder,newFileName)} autoFocus/>
          <div style={{display:"flex",gap:6}}>
            <button style={S.btn("primary")} onClick={()=>createFile(hubId,newFileFolder,newFileName)}>Create</button>
            <button style={S.btn("ghost")} onClick={()=>setModal(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {modal==="new-custom-folder"&&hub&&(
        <Modal title="Add Custom Folder" onClose={()=>setModal(null)}>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <input style={{...S.input,width:60}} placeholder="📁" value={customFolderForm.icon} onChange={e=>setCFForm(f=>({...f,icon:e.target.value}))}/>
            <input style={S.input} placeholder="folder-id (no spaces)" value={customFolderForm.id} onChange={e=>setCFForm(f=>({...f,id:e.target.value.toLowerCase().replace(/\s+/g,"-")}))} autoFocus/>
          </div>
          <input style={{...S.input,marginBottom:8}} placeholder="Display label" value={customFolderForm.label} onChange={e=>setCFForm(f=>({...f,label:e.target.value}))}/>
          <input style={{...S.input,marginBottom:12}} placeholder="Description..." value={customFolderForm.desc} onChange={e=>setCFForm(f=>({...f,desc:e.target.value}))}/>
          <div style={{display:"flex",gap:6}}>
            <button style={S.btn("primary")} onClick={()=>customFolderForm.id.trim()&&customFolderForm.label.trim()&&addCustomFolder(hubId,customFolderForm)}>Add Folder</button>
            <button style={S.btn("ghost")} onClick={()=>setModal(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {modal==="rename-project"&&hub&&(
        <Modal title={`Rename: ${hub.name}`} onClose={()=>setModal(null)}>
          <input style={{...S.input,marginBottom:12}} value={renameValue} onChange={e=>setRenameValue(e.target.value)} onKeyDown={e=>e.key==="Enter"&&renameProject(hubId,renameValue)} autoFocus/>
          <div style={{display:"flex",gap:6}}>
            <button style={S.btn("primary")} onClick={()=>renameValue.trim()&&renameProject(hubId,renameValue)}>Rename</button>
            <button style={S.btn("ghost")} onClick={()=>setModal(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {modal==="delete-project"&&hub&&(
        <Modal title="Delete Project?" onClose={()=>setModal(null)}>
          <div style={{fontSize:11,color:C.text,marginBottom:16,lineHeight:1.7}}>Delete <strong>{hub.name}</strong> from the database? This cannot be undone. Export first if you want a backup.</div>
          <div style={{display:"flex",gap:6}}>
            <button style={{...S.btn("primary"),background:C.red}} onClick={()=>deleteProject(hubId)}>Delete from DB</button>
            <button style={S.btn("ghost")} onClick={()=>{exportProject(hubId);setModal(null);}}>Export first</button>
            <button style={S.btn("ghost")} onClick={()=>setModal(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {bootstrapWizardId&&<BootstrapWizard project={projects.find(p=>p.id===bootstrapWizardId)} onComplete={brief=>completeBootstrap(bootstrapWizardId,brief)} onClose={()=>{setBootstrapWiz(null);openHub(bootstrapWizardId);}}/>}

      {modal==="manage-goals" && (
        <Modal title="Manage Goals" onClose={()=>setModal(null)} width={500}>
          <div style={{marginBottom:16}}>
            <span style={S.label()}>Active Goal</span>
            <select style={S.sel} value={activeGoalId||""} onChange={e=>setActiveGoalId(e.target.value)}>
              {goals.map(g=><option key={g.id} value={g.id}>{g.title} ({g.currency})</option>)}
            </select>
          </div>

          <div style={{borderTop:`1px solid ${C.border}`, paddingTop:16, marginBottom:16}}>
            <span style={S.label()}>Create New Goal</span>
            <input style={{...S.input, marginBottom:8}} placeholder="Goal Title (e.g. Save for House)" value={newGoalForm.title} onChange={e=>setNewGoalForm({...newGoalForm, title: e.target.value})}/>
            <div style={{display:"flex", gap:8, marginBottom:8}}>
              <input style={S.input} type="number" placeholder="Target Amount" value={newGoalForm.target_amount} onChange={e=>setNewGoalForm({...newGoalForm, target_amount: parseInt(e.target.value)})}/>
              <select style={S.sel} value={newGoalForm.currency} onChange={e=>setNewGoalForm({...newGoalForm, currency: e.target.value})}>
                <option value="GBP">GBP (£)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
            <button style={S.btn("primary")} onClick={async ()=>{
              if(!newGoalForm.title) return;
              try {
                const res = await goalsApi.create(newGoalForm);
                const updated = await goalsApi.list();
                setGoals(updated.goals || []);
                if(res.id) setActiveGoalId(res.id);
                setNewGoalForm({title:"",target_amount:3000,currency:"GBP",timeframe:"monthly",category:"income"});
              } catch(e) { showToast("Failed to create goal"); }
            }}>Create Goal</button>
          </div>

          <div style={{borderTop:`1px solid ${C.border}`, paddingTop:16}}>
            <span style={S.label()}>Existing Goals</span>
            {goals.map(g => (
              <div key={g.id} style={{padding:"8px 0", borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4}}>
                  <div style={{fontSize:11}}>{g.title} ({g.currency}{g.current_amount}/{g.target_amount})</div>
                  <button style={{...S.btn("danger"), padding:"2px 6px", fontSize:8}} onClick={async ()=>{
                    if(!confirm("Delete this goal?")) return;
                    await goalsApi.delete(g.id);
                    const updated = await goalsApi.list();
                    setGoals(updated.goals || []);
                  }}>Delete</button>
                </div>
                <QuickTagRow entityType="goal" entityId={g.id}/>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {modal==="settings"&&(
        <Modal title="⚙ Settings" onClose={()=>setModal(null)} width={420}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <span style={S.label()}>Font Family</span>
              <select style={S.sel} value={settingsForm.font} onChange={e=>setSettingsForm(f=>({...f,font:e.target.value}))}>
                <option value="JetBrains Mono">JetBrains Mono</option>
                <option value="Fira Code">Fira Code</option>
                <option value="Courier New">Courier New</option>
                <option value="monospace">System Monospace</option>
              </select>
            </div>
            <div>
              <span style={S.label()}>Font Size</span>
              <select style={S.sel} value={settingsForm.fontSize} onChange={e=>setSettingsForm(f=>({...f,fontSize:Number(e.target.value)}))}>
                {[11,12,13,14].map(n=><option key={n} value={n}>{n}px</option>)}
              </select>
            </div>
            <div style={{padding:"10px 12px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,fontFamily:`'${settingsForm.font}',monospace`,fontSize:settingsForm.fontSize,color:C.muted}}>
              Preview: THE BRAIN v6 · Wired Edition · Bootstrap → Thailand
            </div>
            <button style={S.btn("primary")} onClick={async ()=>{
              try{
                await settingsApi.put(settingsForm);
                setUserSettings({...settingsForm});
                setModal(null);
                showToast("✓ Settings saved");
              }catch(e){showToast("Failed to save settings");}
            }}>Save Settings</button>
          </div>
        </Modal>
      )}

      {/* ── BODY ── */}
      <div style={{maxWidth:1200,margin:"0 auto",padding:"16px 20px"}}>

        {/* ═══════════════════════════════════════════
            HUB VIEW
        ═══════════════════════════════════════════ */}
        {view==="hub"&&hub&&(()=>{
          // ── LOADING STATE — files not yet fetched ──
          if (!hub.files || loadingFiles) {
            return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"calc(100vh - 200px)",flexDirection:"column",gap:12}}>
              <div style={{fontSize:32}}>📂</div>
              <div style={{fontSize:10,color:C.muted,letterSpacing:"0.15em",textTransform:"uppercase"}}>Loading project files...</div>
            </div>;
          }

          const commKey=`${hubId}:${hub.activeFile}`;
          const fileComs=comments[commKey]||[];
          return <div>

            {hubTab==="editor"&&(
              <div style={{display:"flex",gap:10,height:"calc(100vh-160px)",minHeight:500}}>
                <div style={{width:210,flexShrink:0,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
                  <FileTree files={hub.files||{}} activeFile={hub.activeFile} customFolders={hub.customFolders||[]}
                    onSelect={path=>{setProjects(prev=>prev.map(p=>p.id===hubId?{...p,activeFile:path}:p));projectsApi.setActiveFile(hubId,path).catch(()=>{});}}
                    onNewFile={()=>setModal("new-file")}
                    onDelete={path=>deleteFile(hubId,path)}/>
                </div>
                <div style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden",display:"flex",flexDirection:"column",position:"relative"}}
                  onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={e=>handleDrop(e,hubId)}>
                  {dragOver&&<div style={{position:"absolute",inset:0,background:"rgba(26,79,214,0.12)",border:`2px dashed ${C.blue}`,borderRadius:8,zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}><span style={{fontSize:14,color:C.blue}}>Drop to stage →</span></div>}
                  {hub.activeFile&&<div style={{padding:"4px 10px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",background:C.bg}}>
                    <span style={{fontSize:8,color:C.dim,textTransform:"uppercase",letterSpacing:"0.1em",flexShrink:0}}>tags</span>
                    <QuickTagRow entityType="file" entityId={`${hubId}/${hub.activeFile}`}/>
                  </div>}
                  <MarkdownEditor path={hub.activeFile} content={(hub.files||{})[hub.activeFile]||""} onChange={()=>{}} onSave={handleHubSave} saving={saving}/>
                </div>
              </div>
            )}

            {hubTab==="overview"&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div style={S.card(true)}>
                  <span style={S.label()}>Status</span>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
                    {[{l:"Phase",v:hub.phase},{l:"Status",v:<BadgeStatus status={hub.status}/>},{l:"Priority",v:`#${hub.priority}`},{l:"Health",v:<HealthBar score={hub.health}/>},{l:"Momentum",v:<Dots n={hub.momentum}/>},{l:"Income",v:`${activeGoal?.currency==='USD'?'$':activeGoal?.currency==='EUR'?'€':'£'}${hub.incomeTarget||0}/mo`}].map(r=>(
                      <div key={r.l} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,padding:"7px 10px"}}>
                        <div style={{fontSize:8,color:C.dim,textTransform:"uppercase",marginBottom:3}}>{r.l}</div>
                        <div style={{fontSize:11}}>{r.v}</div>
                      </div>
                    ))}
                  </div>
                  <span style={S.label()}>Area</span>
                  <div style={{marginBottom:10}}>
                    <select style={S.sel} value={hub.areaId||""} onChange={e=>updateProject(hubId,{areaId:e.target.value})}>
                      <option value="">No Area</option>
                      {areas.map(a=><option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
                    </select>
                  </div>
                  <span style={S.label(C.green)}>Next Action</span>
                  <div style={{fontSize:11,color:C.green,marginBottom:8}}>→ {hub.nextAction}</div>
                  {hub.blockers?.length>0&&<>{hub.blockers.map((b,i)=><div key={i} style={{fontSize:10,color:"#92400e"}}>⚠ {b}</div>)}</>}
                  <div style={{marginTop:10,display:"flex",gap:4,flexWrap:"wrap"}}>
                    <button style={{...S.btn("success"),fontSize:9}} onClick={()=>setBootstrapWiz(hubId)}>🚀 Bootstrap Wizard</button>
                    <button style={S.btn("ghost")} onClick={()=>exportProject(hubId)}>⬇ Export</button>
                  </div>
                </div>
                <div style={S.card(false)}>
                  <span style={S.label()}>Project Overview</span>
                  <div style={{fontSize:11,lineHeight:1.8}} dangerouslySetInnerHTML={{__html:renderMd((hub.files||{})["PROJECT_OVERVIEW.md"]||"")}}/>
                </div>
              </div>
            )}

            {hubTab==="folders"&&(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{fontSize:10,color:C.blue,letterSpacing:"0.1em",textTransform:"uppercase"}}>📁 All Folders</span>
                  <button style={S.btn("ghost")} onClick={()=>setModal("new-custom-folder")}>+ Custom Folder</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8}}>
                  {hubAllFolders.map(f=>{
                    const files=hub.files||{};
                    const count=Object.keys(files).filter(k=>k.startsWith(f.id+"/")&&!k.endsWith(".gitkeep")).length;
                    const isCustom=!STANDARD_FOLDER_IDS.has(f.id);
                    return <div key={f.id} style={{background:C.bg,border:`1px solid ${isCustom?C.purple:C.border}`,borderRadius:6,padding:"10px 12px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                        <span style={{fontSize:12}}>{f.icon} <span style={{fontSize:11,color:"#e2e8f0",fontWeight:600}}>{f.label}</span></span>
                        <div style={{display:"flex",gap:4,alignItems:"center"}}>{isCustom&&<span style={S.badge(C.purple)}>custom</span>}<span style={{fontSize:9,color:count>0?C.blue2:C.dim}}>{count}</span></div>
                      </div>
                      <div style={{fontSize:9,color:C.muted}}>{f.desc}</div>
                      {count>0&&<div style={{marginTop:6}}>{Object.keys(files).filter(k=>k.startsWith(f.id+"/")&&!k.endsWith(".gitkeep")).map(path=>(
                        <div key={path} onClick={()=>{setProjects(prev=>prev.map(p=>p.id===hubId?{...p,activeFile:path}:p));setHubTab("editor");}} style={{fontSize:9,color:C.blue,cursor:"pointer",padding:"1px 0"}}>{path.split("/").pop()}</div>
                      ))}</div>}
                    </div>;
                  })}
                </div>
              </div>
            )}

            {hubTab==="review"&&(
              <div>
                <div onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={e=>handleDrop(e,hubId)}
                  style={{background:dragOver?"rgba(26,79,214,0.08)":C.surface,border:`2px dashed ${dragOver?C.blue:C.border}`,borderRadius:8,padding:16,textAlign:"center",marginBottom:12}}>
                  <div style={{fontSize:10,color:C.muted}}>🌀 Drag & drop files to stage them</div>
                </div>
                {staging.filter(s=>s.project===hubId).length===0
                  ?<div style={{fontSize:10,color:C.dim,textAlign:"center",padding:"24px 0"}}>No staging items for {hub.name}.</div>
                  :staging.filter(s=>s.project===hubId).map(item=>{const sc=REVIEW_STATUSES[item.status];return(
                    <div key={item.id} style={{background:C.bg,border:`1px solid ${sc.color}25`,borderLeft:`3px solid ${sc.color}`,borderRadius:"0 6px 6px 0",padding:"10px 14px",marginBottom:7}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,flexWrap:"wrap",gap:5}}>
                        <span style={{fontSize:11}}>{item.name}</span><span style={S.badge(sc.color)}>{sc.icon} {sc.label}</span>
                      </div>
                      <div style={{fontSize:9,color:C.muted,marginBottom:6}}>{item.notes} · {item.added}</div>
                      <div style={{display:"flex",gap:4}}>
                        {["approved","rejected","deferred"].filter(s=>s!==item.status).map(s=>(
                          <button key={s} style={{...S.btn(s==="approved"?"success":s==="rejected"?"danger":"ghost"),padding:"2px 8px",fontSize:8}} onClick={()=>updateStagingStatus(item.id,s)}>{REVIEW_STATUSES[s].icon} {s}</button>
                        ))}
                      </div>
                    </div>
                  );}
                )}
              </div>
            )}

            {hubTab==="devlog"&&(
              <div>
                <div style={{display:"flex",gap:6,marginBottom:10}}>
                  <textarea style={{...S.input,height:60,resize:"vertical",flex:1}} placeholder="What did you build/learn/decide?" value={sessionLog} onChange={e=>setSessionLog(e.target.value)}/>
                  <button style={{...S.btn("success"),alignSelf:"flex-end"}} onClick={async()=>{
                    if(!sessionLog.trim())return;
                    const entry=`\n## ${new Date().toISOString().slice(0,10)}\n\n${sessionLog}\n`;
                    const current=(hub.files||{})["DEVLOG.md"]||"";
                    await saveFile(hubId,"DEVLOG.md",current+entry);
                    setSessionLog("");
                  }}>Log</button>
                </div>
                <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 18px",maxHeight:420,overflowY:"auto",fontSize:11,lineHeight:1.8}} dangerouslySetInnerHTML={{__html:renderMd((hub.files||{})["DEVLOG.md"]||"*No entries yet.*")}}/>
              </div>
            )}

            {hubTab==="gantt"&&(
              <div style={S.card(false)}>
                <span style={S.label()}>Timeline</span>
                <GanttChart tasks={parseTasks((hub.files||{})["TASKS.md"]||"")}/>
                <div style={{marginTop:14,maxHeight:280,overflowY:"auto"}} dangerouslySetInnerHTML={{__html:renderMd((hub.files||{})["TASKS.md"]||"*No tasks yet.*")}}/>
              </div>
            )}

            {hubTab==="comments"&&(
              <div>
                <div style={{fontSize:9,color:C.muted,marginBottom:8}}>On: <span style={{color:C.blue}}>{hub.activeFile}</span></div>
                <div style={{display:"flex",gap:6,marginBottom:10}}>
                  <input style={S.input} placeholder="Add comment..." value={newComment} onChange={e=>setNewComment(e.target.value)} onKeyDown={async e=>{if(e.key==="Enter"&&newComment.trim()){const tmp={id:`tmp-${Date.now()}`,text:newComment,date:new Date().toISOString().slice(0,10),resolved:false};setComments(prev=>({...prev,[commKey]:[...(prev[commKey]||[]),tmp]}));setNewComment("");try{const r=await commentsApi.create(hubId,hub.activeFile,newComment);setComments(prev=>({...prev,[commKey]:(prev[commKey]||[]).map(c=>c.id===tmp.id?{...c,id:r.id}:c)}));}catch{}}}}/>
                  <button style={S.btn("primary")} onClick={async()=>{if(!newComment.trim())return;const tmp={id:`tmp-${Date.now()}`,text:newComment,date:new Date().toISOString().slice(0,10),resolved:false};setComments(prev=>({...prev,[commKey]:[...(prev[commKey]||[]),tmp]}));setNewComment("");try{const r=await commentsApi.create(hubId,hub.activeFile,newComment);setComments(prev=>({...prev,[commKey]:(prev[commKey]||[]).map(c=>c.id===tmp.id?{...c,id:r.id}:c)}));}catch{}}}>Add</button>
                </div>
                {commentsLoading ? <div style={{fontSize:10,color:C.dim,textAlign:"center",padding:"20px 0"}}>Loading comments...</div> :
                  fileComs.length===0?<div style={{fontSize:10,color:C.dim,textAlign:"center",padding:"20px 0"}}>No comments yet.</div>
                  :fileComs.map(c=>(
                    <div key={c.id} style={{background:C.bg,border:`1px solid ${c.resolved?C.border:C.blue+"40"}`,borderRadius:6,padding:"10px 14px",marginBottom:6}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:9,color:C.muted}}>{c.date}</span>
                        <button style={{...S.btn(c.resolved?"ghost":"success"),padding:"1px 7px",fontSize:8}} onClick={async()=>{setComments(prev=>({...prev,[commKey]:prev[commKey].map(cm=>cm.id===c.id?{...cm,resolved:!cm.resolved}:cm)}));await commentsApi.resolve(c.id,!c.resolved).catch(()=>{});}}>{c.resolved?"Reopen":"✓ Resolve"}</button>
                      </div>
                      <div style={{fontSize:11,color:c.resolved?C.muted:C.text,textDecoration:c.resolved?"line-through":"none"}}>{c.text}</div>
                    </div>
                  ))}
              </div>
            )}

            {hubTab==="meta"&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div style={S.card(false)}>
                  <span style={S.label()}>manifest.json <span style={S.badge(C.purple)}>portability contract</span></span>
                  <pre style={{fontSize:9,color:C.muted,background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,padding:12,overflow:"auto",maxHeight:300,lineHeight:1.6,margin:0}}>{(hub.files||{})["manifest.json"]||"{}"}</pre>
                </div>
                <div style={S.card(false)}>
                  <span style={S.label()}>Folder Summary</span>
                  {hubAllFolders.map(f=>{
                    const count=Object.keys(hub.files||{}).filter(k=>k.startsWith(f.id+"/")&&!k.endsWith(".gitkeep")).length;
                    const isCustom=!STANDARD_FOLDER_IDS.has(f.id);
                    return <div key={f.id} style={{display:"flex",justifyContent:"space-between",fontSize:9,padding:"3px 0",borderBottom:`1px solid ${C.border}`,color:count>0?C.text:C.dim}}>
                      <span>{f.icon} {f.label} {isCustom&&<span style={{color:C.purple}}>·custom</span>}</span>
                      <span style={{color:count>0?C.blue2:C.dim}}>{count}</span>
                    </div>;
                  })}
                  <div style={{marginTop:16}}>
                    <button style={S.btn("ghost")} onClick={async ()=>{
                        const manifest = JSON.parse(hub.files["manifest.json"] || "{}");
                        const template = {
                            name: `${hub.name} Template`,
                            description: `Extracted from project: ${hub.name}`,
                            icon: hub.emoji,
                            config: {
                                phases: BUIDL_PHASES.includes(hub.phase) ? BUIDL_PHASES : [hub.phase],
                                folders: Object.keys(hub.files).map(p=>p.split('/')[0]).filter(f=>f && f!=='.gitkeep' && !f.endsWith('.md') && !f.endsWith('.json'))
                            }
                        };
                        try {
                            await templatesApi.create(template);
                            showToast("✓ Saved as template");
                            const data = await templatesApi.list();
                            setTemplates(data.templates || []);
                        } catch(e) { showToast("Failed to save template"); }
                    }}>Save as Template</button>
                  </div>
                </div>
              </div>
            )}

            {hubTab==="links"&&(
              <div>
                <div style={S.card(false)}>
                  <span style={S.label()}>🔗 Link this project to another entity</span>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"flex-end",marginTop:8}}>
                    <div>
                      <span style={S.label()}>Type</span>
                      <select style={S.sel} value={newLinkForm.targetType} onChange={e=>setNewLinkForm(f=>({...f,targetType:e.target.value,targetId:""}))}>
                        <option value="project">Project</option>
                        <option value="idea">Idea</option>
                        <option value="staging">Staging Item</option>
                        <option value="goal">Goal</option>
                      </select>
                    </div>
                    <div>
                      <span style={S.label()}>Entity</span>
                      <select style={S.sel} value={newLinkForm.targetId} onChange={e=>setNewLinkForm(f=>({...f,targetId:e.target.value}))}>
                        <option value="">Select...</option>
                        {newLinkForm.targetType==="project"&&projects.filter(p=>p.id!==hubId).map(p=><option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
                        {newLinkForm.targetType==="idea"&&ideas.map(i=><option key={i.id} value={i.id}>{i.title}</option>)}
                        {newLinkForm.targetType==="staging"&&staging.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                        {newLinkForm.targetType==="goal"&&goals.map(g=><option key={g.id} value={g.id}>{g.title}</option>)}
                      </select>
                    </div>
                    <div>
                      <span style={S.label()}>Relationship</span>
                      <select style={S.sel} value={newLinkForm.relationship} onChange={e=>setNewLinkForm(f=>({...f,relationship:e.target.value}))}>
                        <option value="related">Related</option>
                        <option value="parent">Parent of</option>
                        <option value="child">Child of</option>
                        <option value="supports">Supports</option>
                        <option value="blocks">Blocks</option>
                      </select>
                    </div>
                    <button style={S.btn("primary")} onClick={async ()=>{
                      if(!newLinkForm.targetId){showToast("Select an entity first");return;}
                      try{
                        const res = await linksApi.create('project',hubId,newLinkForm.targetType,newLinkForm.targetId,newLinkForm.relationship);
                        setHubLinks(prev=>[...prev,{id:res.id,source_type:'project',source_id:hubId,target_type:newLinkForm.targetType,target_id:newLinkForm.targetId,relationship:newLinkForm.relationship,created_at:new Date().toISOString()}]);
                        setNewLinkForm(f=>({...f,targetId:""}));
                        showToast("✓ Link created");
                      }catch(e){showToast("Failed to create link");}
                    }}>Link</button>
                  </div>
                </div>
                <div style={S.card(false)}>
                  <span style={S.label()}>Existing Links ({hubLinks.length})</span>
                  {hubLinks.length===0
                    ? <div style={{fontSize:10,color:C.dim,padding:"8px 0"}}>No links yet. Link this project to related ideas, goals, or other projects.</div>
                    : hubLinks.map(link=>{
                        const isSource = link.source_type==='project'&&String(link.source_id)===String(hubId);
                        const otherType = isSource?link.target_type:link.source_type;
                        const otherId   = isSource?link.target_id:link.source_id;
                        const rel       = isSource?link.relationship:`← ${link.relationship}`;
                        let otherLabel="";
                        if(otherType==="project"){const p=projects.find(p=>String(p.id)===String(otherId));otherLabel=p?`${p.emoji} ${p.name}`:otherId;}
                        else if(otherType==="idea"){const i=ideas.find(i=>String(i.id)===String(otherId));otherLabel=i?`💡 ${i.title}`:otherId;}
                        else if(otherType==="staging"){const s=staging.find(s=>String(s.id)===String(otherId));otherLabel=s?`🌀 ${s.name}`:otherId;}
                        else if(otherType==="goal"){const g=goals.find(g=>String(g.id)===String(otherId));otherLabel=g?`🎯 ${g.title}`:otherId;}
                        return <div key={link.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,fontSize:10}}>
                            <span style={{color:C.blue2,textTransform:"capitalize"}}>{rel}</span>
                            <span style={{color:C.text}}>{otherLabel||otherId}</span>
                            <span style={S.badge(C.purple)}>{otherType}</span>
                          </div>
                          <button style={{...S.btn("danger"),padding:"2px 6px",fontSize:8}} onClick={async ()=>{
                            await linksApi.delete(link.id);
                            setHubLinks(prev=>prev.filter(l=>l.id!==link.id));
                          }}>✕</button>
                        </div>;
                      })
                  }
                </div>
              </div>
            )}
          </div>;
        })()}

        {/* ═══════════════════════════════════════════
            BRAIN TABS
        ═══════════════════════════════════════════ */}
        {view==="brain"&&<>

          {mainTab==="command"&&(
            <div>
              {/* Area summary cards */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10,marginBottom:14}}>
                {areaStats.map(a=>(
                  <div key={a.id} style={S.card(activeAreaFilter===a.id, a.color)} onClick={()=>setActiveAreaFilter(activeAreaFilter===a.id?null:a.id)}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <span style={{fontSize:14}}>{a.icon} <span style={{fontSize:12,fontWeight:700}}>{a.name}</span></span>
                      <span style={{fontSize:10,color:C.muted}}>{a.projectCount} projects</span>
                    </div>
                    <HealthBar score={a.health}/>
                  </div>
                ))}
              </div>

              {projects.filter(p=>p.health<50).length>0&&(
                <div style={{background:"rgba(239,68,68,0.05)",border:"1px solid #ef444330",borderRadius:6,padding:"10px 14px",marginBottom:10}}>
                  <div style={{fontSize:9,color:C.red,letterSpacing:"0.12em",marginBottom:6}}>🚨 HEALTH ALERTS</div>
                  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{projects.filter(p=>p.health<50).map(p=><div key={p.id} style={{display:"flex",gap:6,alignItems:"center"}}><span>{p.emoji}</span><span style={{fontSize:10}}>{p.name}</span><HealthBar score={p.health}/></div>)}</div>
                </div>
              )}
              <div style={S.card(true)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
                  <span style={{fontSize:10,color:C.blue,letterSpacing:"0.11em",textTransform:"uppercase"}}>⚡ Today's Focus</span>
                  <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{projects.map(p=><button key={p.id} style={{...S.btn(focusId===p.id?"primary":"ghost"),fontSize:9}} onClick={()=>setFocusId(p.id)}>{p.emoji}</button>)}</div>
                </div>
                {focusP&&<div style={{background:C.bg,border:`1px solid ${C.blue}`,borderRadius:6,padding:"12px 16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,flexWrap:"wrap",gap:6}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#f1f5f9"}}>{focusP.emoji} {focusP.name}</div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}><BadgeStatus status={focusP.status}/><HealthBar score={focusP.health}/><Dots n={focusP.momentum}/></div>
                  </div>
                  <div style={{fontSize:11,color:C.muted,lineHeight:1.6,marginBottom:8}}>{focusP.desc}</div>
                  <span style={S.label()}>Next Action</span>
                  <div style={{fontSize:12,color:C.green,marginBottom:8}}>→ {focusP.nextAction}</div>
                  {focusP.blockers?.length>0&&<div style={{marginBottom:8}}>{focusP.blockers.map((b,i)=><div key={i} style={{fontSize:10,color:"#78350f"}}>⚠ {b}</div>)}</div>}
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    <button style={S.btn("success")} onClick={()=>openHub(focusP.id)}>🗂 Open Hub</button>
                    {!sessionActive&&<button style={S.btn("primary")} onClick={()=>setSessionOn(true)}>▶ Start Session</button>}
                    <button style={S.btn("ghost")} onClick={()=>{setMainTab("ai");askAI(`Sharp 2-hour plan for ${focusP.name}. What exactly do I do right now?`);}}>💬 Ask AI</button>
                  </div>
                </div>}
              </div>
              <div style={S.card(false)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div style={{fontSize:10,color:C.blue,letterSpacing:"0.11em",textTransform:"uppercase"}}>📋 Priority Stack {activeAreaFilter && "(Filtered)"}</div>
                    {activeAreaFilter && <button style={{...S.btn("ghost"),fontSize:8}} onClick={()=>setActiveAreaFilter(null)}>Show All</button>}
                </div>
                {[...filteredProjects].sort((a,b)=>a.priority-b.priority).map((p,i)=>(
                  <div key={p.id} onClick={()=>openHub(p.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:i<projects.length-1?`1px solid ${C.border}`:"none",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background="#ffffff05"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <div style={{width:18,fontSize:10,color:C.dim,fontWeight:700}}>{p.priority}</div>
                    <span style={{fontSize:14}}>{p.emoji}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,color:p.id===focusId?C.blue2:"#e2e8f0",fontWeight:p.id===focusId?700:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                      <div style={{fontSize:8,color:C.dim}}>{p.phase} · {p.lastTouched}</div>
                    </div>
                    <HealthBar score={p.health}/><Dots n={p.momentum}/><BadgeStatus status={p.status}/>
                {p.revenueReady&&<span style={S.badge(C.green)}>{activeGoal?.currency==='GBP'?'£':activeGoal?.currency==='USD'?'$':activeGoal?.currency==='EUR'?'€':activeGoal?.currency||'£'}</span>}
                    {staging.filter(s=>s.project===p.id&&s.status==="in-review").length>0&&<span style={S.badge(C.amber)}>{staging.filter(s=>s.project===p.id&&s.status==="in-review").length}⏳</span>}
                  </div>
                ))}
              </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4,cursor:"pointer"}} onClick={()=>setModal("manage-goals")}>
             <div style={{fontSize:9,color:C.dim}}>{activeGoal?.title || "Goal"}: {activeGoal?.currency==='USD'?'$':activeGoal?.currency==='EUR'?'€':activeGoal?.currency==='GBP'?'£':activeGoal?.currency||'£'}{totalIncome} / {activeGoal?.currency==='USD'?'$':activeGoal?.currency==='EUR'?'€':activeGoal?.currency==='GBP'?'£':activeGoal?.currency||'£'}{activeGoal?.target_amount || 3000} ({Math.round(totalIncome/(activeGoal?.target_amount||3000)*100)}%)</div>
             <div style={{fontSize:9,color:C.blue}}>⚙️ Manage</div>
          </div>
          <div style={{height:6,background:C.border,borderRadius:3,overflow:"hidden",marginBottom:4}} onClick={()=>setModal("manage-goals")}>
            <div style={{width:`${Math.min(100,Math.round(totalIncome/(activeGoal?.target_amount||3000)*100))}%`,height:"100%",background:`linear-gradient(90deg,${C.blue},${C.green})`,borderRadius:3}}/>
              </div>
            </div>
          )}

          {mainTab==="projects"&&(
            <div>
              <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
                <button style={S.btn("primary")} onClick={()=>setModal("new-project")}>+ New Project</button>
              </div>
              {projects.map(p=>(
                <div key={p.id} style={S.card(false)}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,flexWrap:"wrap",gap:6}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:18}}>{p.emoji}</span>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:"#f1f5f9"}}>{p.name}</div>
                        <div style={{fontSize:8,color:C.muted}}>{p.phase} · #{p.priority} · {p.lastTouched}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
                      <HealthBar score={p.health}/><Dots n={p.momentum}/><BadgeStatus status={p.status}/>
                      <button style={{...S.btn("success"),fontSize:9}} onClick={()=>openHub(p.id)}>🗂 Hub</button>
                      <button style={{...S.btn("ghost"),fontSize:9}} onClick={()=>exportProject(p.id)}>⬇</button>
                    </div>
                  </div>
                  <div style={{fontSize:10,color:C.muted,lineHeight:1.5,marginBottom:4}}>{p.desc}</div>
                  <div style={{fontSize:10,color:C.green}}>→ {p.nextAction}</div>
                  <QuickTagRow entityType="project" entityId={p.id}/>
                </div>
              ))}
              {projects.length===0&&<div style={{fontSize:11,color:C.dim,textAlign:"center",padding:"40px 0"}}>No projects yet. Create your first one above.</div>}
            </div>
          )}

          {mainTab==="bootstrap"&&(
            <div>
              <div style={{...S.card(true,C.green),marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
                  <div>
                    <span style={S.label(C.green)}>🚀 Agent Bootstrap Protocol</span>
                    <div style={{fontSize:11,color:C.text,lineHeight:1.8,maxWidth:560}}>Spin up a new project with agent control baked in from day one. Generates a Bootstrap Brief + ready-to-paste agent prompts, all saved to your database.</div>
                  </div>
                  <button style={{...S.btn("success"),fontSize:11,padding:"8px 16px"}} onClick={()=>setModal("new-project")}>+ New Project → Bootstrap</button>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8,marginBottom:14}}>
                {BOOTSTRAP_STEPS.map((s,i)=>(
                  <div key={s.id} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 12px"}}>
                    <div style={{fontSize:16,marginBottom:4}}>{s.icon}</div>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><span style={{fontSize:9,color:C.dim,fontWeight:700}}>STEP {i+1}</span>{s.agent?<span style={S.badge(C.blue2)}>{s.agent}</span>:<span style={S.badge(C.amber)}>YOU</span>}</div>
                    <div style={{fontSize:11,color:"#e2e8f0",fontWeight:600,marginBottom:4}}>{s.label}</div>
                    <div style={{fontSize:9,color:C.muted,lineHeight:1.6}}>{s.desc}</div>
                  </div>
                ))}
              </div>
              {projects.map(p=>{
                const bf=p.files||{};
                const briefExists=!!bf["project-artifacts/BOOTSTRAP_BRIEF.md"];
                const stratDone=!!bf["project-artifacts/STRATEGY_OUTPUT.md"];
                const devDone=!!bf["code-modules/DEV_BRIEF.md"];
                const steps=[{label:"Brief",done:briefExists},{label:"Strategy",done:stratDone},{label:"Dev",done:devDone},{label:"Design",done:!!bf["design-assets/UI_SPEC.md"]},{label:"Content",done:!!bf["content-assets/LAUNCH_COPY.md"]},{label:"Review",done:p.status==="active"&&briefExists&&stratDone&&devDone}];
                const pct=Math.round(steps.filter(s=>s.done).length/steps.length*100);
                return <div key={p.id} style={{...S.card(false),display:"flex",gap:12,alignItems:"center",cursor:"pointer"}} onClick={()=>setBootstrapWiz(p.id)}>
                  <span style={{fontSize:18,flexShrink:0}}>{p.emoji}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                      <span style={{fontSize:11,color:"#e2e8f0",fontWeight:600}}>{p.name}</span>
                      <span style={{fontSize:9,color:pct===100?C.green:pct>0?C.amber:C.dim}}>{pct}% bootstrapped</span>
                    </div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{steps.map(s=><span key={s.label} style={{fontSize:8,padding:"2px 6px",borderRadius:3,background:s.done?"rgba(16,185,129,0.12)":"rgba(255,255,255,0.04)",color:s.done?C.green:C.dim,border:`1px solid ${s.done?"#10b98130":C.border}`}}>{s.done?"✓":""} {s.label}</span>)}</div>
                  </div>
                  <div style={{display:"flex",gap:5,flexShrink:0}}>
                    {briefExists?<button style={{...S.btn("ghost"),fontSize:9}} onClick={e=>{e.stopPropagation();openHub(p.id,"project-artifacts/BOOTSTRAP_BRIEF.md");}}>📋 Brief</button>:<span style={S.badge(C.amber)}>No Brief</span>}
                    {briefExists&&!stratDone&&<button style={{...S.btn("primary"),fontSize:9}} onClick={e=>{e.stopPropagation();openHub(p.id,"project-artifacts/STRATEGY_PROMPT.md");}}>🎯 Strategy →</button>}
                    {stratDone&&!devDone&&<button style={{...S.btn("primary"),fontSize:9}} onClick={e=>{e.stopPropagation();openHub(p.id,"project-artifacts/DEV_PROMPT.md");}}>🛠 Dev →</button>}
                  </div>
                </div>;
              })}
            </div>
          )}

          {mainTab==="staging"&&(
            <div>
              <div style={S.card(false)}>
                <span style={S.label()}>🌀 Stage Something</span>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
                  <select style={S.sel} value={newStaging.tag} onChange={e=>setNewStaging(s=>({...s,tag:e.target.value}))}>{ITEM_TAGS.map(t=><option key={t}>{t}</option>)}</select>
                  <select style={S.sel} value={newStaging.project} onChange={e=>setNewStaging(s=>({...s,project:e.target.value}))}>{projects.map(p=><option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}</select>
                </div>
                <input style={{...S.input,marginBottom:6}} placeholder="Name or description..." value={newStaging.name} onChange={e=>setNewStaging(s=>({...s,name:e.target.value}))}/>
                <input style={{...S.input,marginBottom:6}} placeholder="Notes..." value={newStaging.notes} onChange={e=>setNewStaging(s=>({...s,notes:e.target.value}))}/>
                <button style={S.btn("primary")} onClick={()=>{if(newStaging.name.trim()){addStaging(newStaging);setNewStaging({name:"",tag:"IDEA_",project:projects[0]?.id||"",notes:""});}}}>→ Stage It</button>
              </div>
              {["in-review","approved","deferred","rejected"].map(sk=>{
                const items=staging.filter(s=>s.status===sk);
                if(!items.length&&sk!=="in-review")return null;
                const sc=REVIEW_STATUSES[sk];
                return <div key={sk} style={{marginBottom:14}}>
                  <div style={{fontSize:9,color:sc.color,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>{sc.icon} {sc.label} ({items.length})</div>
                  {!items.length&&<div style={{fontSize:9,color:C.dim}}>Nothing here.</div>}
                  {items.map(item=>{const proj=projects.find(p=>p.id===item.project);const isc=REVIEW_STATUSES[item.status];return(
                    <div key={item.id} style={{background:C.surface,border:`1px solid ${isc.color}22`,borderLeft:`3px solid ${isc.color}`,borderRadius:"0 5px 5px 0",padding:"8px 13px",marginBottom:5}}>
                      <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:5,marginBottom:3}}>
                        <div><span style={{fontSize:9,background:C.border,padding:"1px 5px",borderRadius:3,marginRight:6}}>{item.tag}</span><span style={{fontSize:11}}>{item.name}</span></div>
                        <span style={{fontSize:8,color:C.muted}}>{proj?.emoji} {proj?.name} · {item.added}</span>
                      </div>
                      {item.notes&&<div style={{fontSize:9,color:C.muted,marginBottom:5}}>{item.notes}</div>}
                      <QuickTagRow entityType="staging" entityId={item.id}/>
                      <div style={{display:"flex",gap:4,marginTop:4}}>
                        {["approved","rejected","deferred"].filter(s=>s!==sk).map(s=>(
                          <button key={s} style={{...S.btn(s==="approved"?"success":s==="rejected"?"danger":"ghost"),padding:"2px 7px",fontSize:8}} onClick={()=>updateStagingStatus(item.id,s)}>{REVIEW_STATUSES[s].icon} {s}</button>
                        ))}
                        <button style={{...S.btn("ghost"),padding:"2px 7px",fontSize:8}} onClick={()=>openHub(item.project)}>🗂 Hub</button>
                      </div>
                    </div>
                  );})}
                </div>;
              })}
            </div>
          )}

          {mainTab==="skills"&&(
            <div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>{Object.values(SKILLS).map(sk=><button key={sk.id} style={{...S.btn(activeSkill===sk.id?"primary":"ghost"),fontSize:10}} onClick={()=>setActiveSkill(sk.id)}>{sk.icon} {sk.label}</button>)}</div>
              {SKILLS[activeSkill]&&(()=>{const sk=SKILLS[activeSkill];return <div style={S.card(true)}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:8}}>
                  <div><div style={{fontSize:13,fontWeight:700,color:"#f1f5f9"}}>{sk.icon} {sk.label}</div><div style={{fontSize:10,color:C.muted}}>{sk.description}</div></div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <select style={{...S.sel,width:160}} value={briefProj} onChange={e=>setBriefProj(e.target.value)}>{projects.map(p=><option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}</select>
                    <button style={S.btn("primary")} onClick={()=>copy(buildBrief(activeSkill,briefProj))}>{copied?"✓ Copied!":"📋 Copy Briefing"}</button>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div><span style={S.label()}>SOP</span>{sk.sop.map((s,i)=><div key={i} style={{fontSize:10,color:C.muted,padding:"3px 0",borderBottom:`1px solid ${C.border}`,lineHeight:1.5}}>{i+1}. {s}</div>)}</div>
                  <div><span style={S.label(C.green)}>Permissions</span>{sk.permissions.map(p=><div key={p} style={{fontSize:10,color:C.green,padding:"2px 0"}}>✅ {p}</div>)}<span style={{...S.label(C.red),marginTop:8}}>agent.ignore</span>{sk.ignore.map(p=><div key={p} style={{fontSize:10,color:C.red,padding:"2px 0"}}>🚫 {p}</div>)}</div>
                </div>
                <div style={{marginTop:10,background:C.bg,border:`1px solid ${C.blue}`,borderRadius:5,padding:"10px 13px"}}><span style={S.label()}>Prompt Prefix</span><div style={{fontSize:10,color:C.muted,fontStyle:"italic"}}>{sk.prompt_prefix}</div></div>
              </div>;})()} 
            </div>
          )}

          {mainTab==="workflows"&&(
            <div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>{WORKFLOWS.map(w=><button key={w.id} style={{...S.btn(activeWF===w.id?"primary":"ghost"),fontSize:10}} onClick={()=>setActiveWF(activeWF===w.id?null:w.id)}>{w.icon} {w.label}</button>)}</div>
              {activeWF&&(()=>{const wf=WORKFLOWS.find(w=>w.id===activeWF);if(!wf)return null;return(
                <div style={S.card(true)}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#f1f5f9"}}>{wf.icon} {wf.label}</div>
                    <select style={{...S.sel,width:180}} value={wfProj} onChange={e=>setWfProj(e.target.value)}>{projects.map(p=><option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}</select>
                  </div>
                  {wf.steps.map((step,i)=>{const sk=SKILLS[step.agent];const isH=step.agent==="human";return(
                    <div key={step.id} style={{display:"flex",gap:10,padding:"10px 0",borderBottom:i<wf.steps.length-1?`1px solid ${C.border}`:"none",alignItems:"flex-start"}}>
                      <div style={{width:22,height:22,borderRadius:"50%",background:isH?C.border:"#1a4fd615",border:`1px solid ${isH?C.dim:C.blue}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:isH?C.muted:C.blue,flexShrink:0}}>{step.id}</div>
                      <div style={{flex:1}}><div style={{display:"flex",gap:6,marginBottom:3}}><div style={{fontSize:11,fontWeight:600,color:"#e2e8f0"}}>{step.label}</div><span style={S.badge(isH?C.dim:C.blue2)}>{isH?"👤 Human":`${sk?.icon} ${sk?.label}`}</span></div><div style={{fontSize:10,color:C.muted}}>{step.sop}</div></div>
                      {!isH&&<button style={{...S.btn("ghost"),fontSize:8}} onClick={()=>copy(buildBrief(step.agent,wfProj))}>📋 Brief</button>}
                    </div>
                  );})}
                </div>
              );})()}
            </div>
          )}

          {mainTab==="integrations"&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
              {integrations.map(int=>(
                <div key={int.id} style={S.card(showInt===int.id)}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontSize:18}}>{int.icon}</span><div><div style={{fontSize:12,fontWeight:700,color:"#f1f5f9"}}>{int.label}</div><div style={{fontSize:9,color:C.muted}}>{int.desc}</div></div></div>
                    <span style={S.badge(int.connected?C.green:C.dim)}>{int.connected?"LIVE":"OFF"}</span>
                  </div>
                  {int.fields.length>0&&<div style={{display:"flex",gap:5}}>
                    <button style={S.btn("ghost")} onClick={()=>setShowInt(showInt===int.id?null:int.id)}>⚙️ Configure</button>
                  </div>}
                  {showInt===int.id&&<div style={{marginTop:10,borderTop:`1px solid ${C.border}`,paddingTop:10}}>
                    {int.fields.map(field=><div key={field} style={{marginBottom:6}}><span style={S.label()}>{field}</span><input style={{...S.input,fontSize:10}} placeholder={`${field}...`} type={field.includes("key")||field.includes("token")||field.includes("secret")?"password":"text"}/></div>)}
                    <button style={S.btn("success")} onClick={()=>{setIntegrations(prev=>prev.map(i=>i.id===int.id?{...i,connected:true}:i));setShowInt(null);}}>✅ Connect</button>
                  </div>}
                </div>
              ))}
            </div>
          )}

          {mainTab==="ideas"&&(
            <div>
              <div style={S.card(false)}>
                <span style={S.label()}>💡 Bank an Idea</span>
                <div style={{display:"flex",gap:6}}>
                  <input style={S.input} value={newIdea} onChange={e=>setNewIdea(e.target.value)} placeholder="Describe it..." onKeyDown={e=>e.key==="Enter"&&addIdea(newIdea)}/>
                  <button style={S.btn("primary")} onClick={()=>addIdea(newIdea)}>Bank It</button>
                </div>
                <div style={{fontSize:8,color:C.dim,marginTop:4}}>Ideas ≠ projects. Bank now. Promote only when P1–P3 have revenue.</div>
              </div>
              {ideas.map(idea=>(
                <div key={idea.id} style={{...S.card(false),display:"flex",alignItems:"center",gap:10}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,color:C.text}}>{idea.title}</div>
                    <div style={{display:"flex",gap:3,marginTop:3,flexWrap:"wrap",alignItems:"center"}}><QuickTagRow entityType="idea" entityId={idea.id}/><span style={{fontSize:8,padding:"1px 5px",borderRadius:8,background:C.border,color:C.muted}}>{idea.added}</span></div>
                  </div>
                  <div style={{fontSize:15,fontWeight:700,color:idea.score>=7?C.green:idea.score>=5?C.amber:C.red}}>{idea.score}/10</div>
                </div>
              ))}
            </div>
          )}

          {mainTab==="ai"&&(
            <div>
              <div style={S.card(false)}>
                <span style={S.label()}>💬 AI Coach</span>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
                  {["What should I work on today?","Where am I looping?","Thailand income path?","Triage staging","Rank by revenue potential","Which project is dying?"].map(p=><button key={p} style={S.btn("ghost")} onClick={()=>askAI(p)}>{p}</button>)}
                </div>
                <div style={{display:"flex",gap:6}}>
                  <input style={S.input} value={aiIn} placeholder="Ask anything..." onChange={e=>setAiIn(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&aiIn.trim()){askAI(aiIn);setAiIn("");}}}/>
                  <button style={S.btn("primary")} onClick={()=>{if(aiIn.trim()){askAI(aiIn);setAiIn("");}}} disabled={aiLoad}>Ask</button>
                </div>
              </div>
              {(aiLoad||aiOut)&&<div ref={aiRef} style={{...S.card(true,C.green)}}>
                <span style={S.label(C.green)}>Response</span>
                {aiLoad?<div style={{fontSize:10,color:C.dim}}>Thinking...</div>:<div style={{fontSize:11,color:C.text,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{aiOut}</div>}
              </div>}
            </div>
          )}

          {mainTab==="export"&&(
            <div>
              <div style={S.card(true)}>
                <span style={S.label()}>📤 Agent Context + Exports</span>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                  <button style={S.btn("primary")} onClick={()=>copy(buildCtx())}>{copied?"✓ Copied!":"📋 Copy Full Context"}</button>
                  {projects[0]&&<><button style={S.btn("ghost")} onClick={()=>copy(buildBrief("dev",briefProj))}>📋 Dev Brief</button><button style={S.btn("ghost")} onClick={()=>copy(buildBrief("strategy",briefProj))}>📋 Strategy Brief</button></>}
                </div>
                <div style={{marginBottom:10}}>
                  <span style={S.label()}>Export Projects (local download)</span>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{projects.map(p=><button key={p.id} style={S.btn("ghost")} onClick={()=>exportProject(p.id)}>{p.emoji} {p.name}</button>)}</div>
                </div>
                <pre style={{fontSize:8,color:C.dim,background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,padding:12,overflow:"auto",maxHeight:280,lineHeight:1.6,margin:0}}>{buildCtx()}</pre>
              </div>
            </div>
          )}

          {mainTab==="tags"&&(
            <div>
              <div style={S.card(false)}>
                <span style={S.label()}>🏷 Tag Cloud</span>
                {userTags.length===0
                  ? <div style={{fontSize:10,color:C.dim,padding:"8px 0"}}>No tags yet. Tag a project, idea, staging item, goal, or file to get started.</div>
                  : <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6}}>
                      {userTags.map(t=>{
                        const count=entityTags.filter(et=>et.tag_id===t.id).length;
                        const isSel=selectedTagId===t.id;
                        return <span key={t.id} onClick={()=>setSelectedTagId(isSel?null:t.id)}
                          style={{padding:"3px 10px",borderRadius:12,border:`1px solid ${isSel?t.color||C.blue:C.border}`,background:isSel?(t.color||C.blue)+"22":"transparent",color:t.color||C.blue,fontSize:10,cursor:"pointer",userSelect:"none"}}>
                          {t.name} <span style={{fontSize:8,color:C.muted}}>{count}</span>
                        </span>;
                      })}
                    </div>
                }
              </div>
              {selectedTagId&&(()=>{
                const tag=userTags.find(t=>t.id===selectedTagId);
                if(!tag)return null;
                const matches=entityTags.filter(et=>et.tag_id===selectedTagId);
                const byType={};
                matches.forEach(et=>{if(!byType[et.entity_type])byType[et.entity_type]=[];byType[et.entity_type].push(et);});
                const TYPE_LABELS={project:"Projects",idea:"Ideas",staging:"Staging",goal:"Goals",file:"Files"};
                const renderEntity=(type,et)=>{
                  if(type==="project"){const p=projects.find(p=>String(p.id)===String(et.entity_id));if(!p)return null;return<div key={et.id} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:`1px solid ${C.border}`,cursor:"pointer"}} onClick={()=>{openHub(p.id);setView("hub");}}><span>{p.emoji}</span><span style={{fontSize:10}}>{p.name}</span><BadgeStatus status={p.status}/></div>;}
                  if(type==="idea"){const i=ideas.find(i=>String(i.id)===String(et.entity_id));if(!i)return null;return<div key={et.id} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:10}}>💡 {i.title}</span><span style={{fontSize:9,color:C.dim}}>{i.score}/10</span></div>;}
                  if(type==="staging"){const s=staging.find(s=>String(s.id)===String(et.entity_id));if(!s)return null;const proj=projects.find(p=>p.id===s.project);return<div key={et.id} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:10}}>🌀 {s.name}</span><span style={{fontSize:8,color:C.muted}}>{proj?.emoji} {proj?.name}</span></div>;}
                  if(type==="goal"){const g=goals.find(g=>String(g.id)===String(et.entity_id));if(!g)return null;return<div key={et.id} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:10}}>🎯 {g.title}</span><span style={{fontSize:8,color:C.muted}}>{g.currency}{g.current_amount}/{g.target_amount}</span></div>;}
                  if(type==="file"){const[projectId,...rest]=et.entity_id.split("/");const filePath=rest.join("/");const p=projects.find(p=>String(p.id)===String(projectId));return<div key={et.id} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:`1px solid ${C.border}`,cursor:"pointer"}} onClick={()=>{openHub(projectId,filePath);setView("hub");}}><span style={{fontSize:10}}>📝 {filePath}</span><span style={{fontSize:8,color:C.muted}}>{p?.emoji} {p?.name}</span></div>;}
                  return null;
                };
                return<div style={S.card(false)}>
                  <span style={S.label()}>All entities tagged <span style={{color:tag.color||C.blue}}>{tag.name}</span> ({matches.length})</span>
                  {matches.length===0&&<div style={{fontSize:10,color:C.dim}}>No entities tagged with this yet.</div>}
                  {["project","idea","staging","goal","file"].filter(type=>byType[type]).map(type=>(
                    <div key={type} style={{marginBottom:12}}>
                      <div style={{fontSize:8,color:C.dim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>{TYPE_LABELS[type]} ({byType[type].length})</div>
                      {byType[type].map(et=>renderEntity(type,et))}
                    </div>
                  ))}
                </div>;
              })()}
            </div>
          )}

        </>}

        <div style={{marginTop:24,fontSize:8,color:"#1e293b",textAlign:"center"}}>
          THE BRAIN v6 · WIRED EDITION · {user?.email||""} · BOOTSTRAP → THAILAND 🇹🇭
        </div>
      </div>
    </div>
  );
}
