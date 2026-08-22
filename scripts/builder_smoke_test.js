#!/usr/bin/env node
// Ink Builder v2 regression smoke test. Drives the real Rails page in headless Chrome over
// CDP and verifies the recursive document/runtime, schema panel, responsive styles, history,
// generated publish HTML, custom code, and classic-editor preview.
"use strict";

const http = require("http");
const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const CDP_PORT = Number(process.env.CDP_PORT || 9223);
const EMAIL = process.env.ADMIN_EMAIL || "admin@inkwell.test";
const PASSWORD = process.env.ADMIN_PASSWORD || "password123";
let failures = 0;

function check(name, ok, detail = "") {
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures += 1;
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const getJson = (url) => new Promise((resolve, reject) => {
  http.get(url, (response) => {
    let body = "";
    response.on("data", (chunk) => (body += chunk));
    response.on("end", () => resolve(JSON.parse(body)));
  }).on("error", reject);
});

function cdp(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const errors = [];
  let sequence = 0;
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
    if (message.method === "Runtime.exceptionThrown") {
      const details = message.params.exceptionDetails;
      errors.push(details.exception?.description || details.text || "Runtime exception");
    }
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      errors.push((message.params.args || []).map((arg) => arg.value || arg.description || "").join(" "));
    }
  };
  const open = new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = () => reject(new Error("CDP connection failed"));
  });
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = ++sequence;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (response.result?.exceptionDetails) {
      return { __error: response.result.exceptionDetails.exception?.description || response.result.exceptionDetails.text };
    }
    return response.result.result.value;
  };
  return { open, send, evaluate, errors, close: () => socket.close() };
}

function createSmokePage() {
  const source = `
site = Site.first
role = Role.find_by(name: "admin") || Role.create!(name: "admin")
user = site.users.find_by(email: "admin@inkwell.test") || User.create!(name: "Admin", email: "admin@inkwell.test", password: "password123", site: site, role: role)
page = site.pages.find_or_create_by!(title: "Builder V2 Smoke", template: "landing") { |record| record.author = user }
page.content = [{ "type" => "page_builder", "data" => {
  "html" => "<html><body><h1>Legacy content must not become the canvas</h1></body></html>",
  "store" => { "name" => "PageElement", "elementLists" => [] }
} }]
page.update!(draft_content: nil)
print page.id
`;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "inkwell-builder-v2-"));
  const file = path.join(directory, "setup.rb");
  fs.writeFileSync(file, source);
  return execFileSync("bin/rails", ["runner", file], { cwd: process.cwd(), encoding: "utf8" }).trim();
}

async function main() {
  console.log(`Builder v2 smoke test against ${BASE_URL}`);
  const pageId = createSmokePage();
  console.log(`  smoke page id: ${pageId}`);

  const chromeBin = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "inkwell-builder-v2-chrome-"));
  const chrome = spawn(chromeBin, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore" });

  try {
    await wait(2500);
    const version = await getJson(`http://127.0.0.1:${CDP_PORT}/json/version`);
    check("headless Chrome started", !!version.webSocketDebuggerUrl);
    const tabs = await getJson(`http://127.0.0.1:${CDP_PORT}/json`);
    const client = cdp(tabs.find((tab) => tab.type === "page").webSocketDebuggerUrl);
    await client.open;
    await client.send("Runtime.enable");
    await client.send("Page.enable");

    await client.send("Page.navigate", { url: `${BASE_URL}/users/sign_in` });
    await wait(2500);
    await client.evaluate(`(function(){
      var email = document.querySelector('input[name="user[email]"]');
      if (!email) return false;
      email.value = ${JSON.stringify(EMAIL)};
      document.querySelector('input[name="user[password]"]').value = ${JSON.stringify(PASSWORD)};
      document.querySelector('form').submit();
      return true;
    })()`);
    await wait(2500);

    await client.send("Page.navigate", { url: `${BASE_URL}/builder/page/${pageId}` });
    await wait(7000);

    let state = await client.evaluate(`(function(){
      var b = window.builder;
      var canvas = b && b.iframeDoc;
      return {
        title: document.title,
        v2: b instanceof window.InkBuilderV2,
        ready: !!(b && b.runtime && canvas),
        version: b && b.getData().version,
        childCount: b && b.getData().children.length,
        emptyHelper: !!canvas && !!canvas.querySelector('.ink-editor-root-empty'),
        legacyAbsent: !!canvas && !canvas.body.textContent.includes('Legacy content'),
        elements: document.querySelectorAll('[data-ink-element-type]').length,
        noBootstrap: !!canvas && Array.from(canvas.querySelectorAll('link[rel="stylesheet"]')).every(function(link){ return !/bootstrap/i.test(link.href); })
      };
    })()`);
    check("builder loads the v2 runtime", state.title === "Ink Builder — Inkwell" && state.v2 && state.ready, JSON.stringify(state));
    check("legacy v1 data starts as a clean v2 document", state.version === 2 && state.childCount === 0 && state.legacyAbsent, JSON.stringify(state));
    check("empty canvas exposes a real drop surface", state.emptyHelper === true);
    check("element library is registry-driven", state.elements === 40, `${state.elements} elements`);
    check("canvas has no Bootstrap dependency", state.noBootstrap === true);
    state = await client.evaluate(`(function(){var button=document.querySelector('.ink-v2-panel-collapse');var resizer=document.querySelector('.ink-v2-panel-resizer');button.click();var collapsed=document.body.classList.contains('ink-panel-collapsed');button.click();return {button:!!button,resizer:!!resizer,collapsed:collapsed,restored:!document.body.classList.contains('ink-panel-collapsed')}})()`);
    check("Ink panel can resize and collapse", state.button && state.resizer && state.collapsed && state.restored, JSON.stringify(state));
    state = await client.evaluate(`(function(){var n=builder.navigator;n.toggle();var visible=!n.window.hidden;n.setDocked(true);var docked=n.window.classList.contains('is-docked')&&document.body.classList.contains('ink-structure-docked');n.hide();return {visible:visible,docked:docked,hidden:n.window.hidden&&!document.body.classList.contains('ink-structure-docked')}})()`);
    check("Structure floats, docks, resizes, and closes independently", state.visible && state.docked && state.hidden, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder;
      var panelHTML=document.querySelector('#WidgetsContainer').innerHTML;
      var hasElementsHeading=panelHTML.includes('Elements');
      var noPeerTabs=!panelHTML.includes('ink-v2-panel-routes');
      var structureBtn=document.getElementById('structureButton');
      structureBtn.click(); var structOpen=!b.navigator.window.hidden && structureBtn.classList.contains('is-active');
      structureBtn.click(); var structClosed=b.navigator.window.hidden && !structureBtn.classList.contains('is-active');
      document.querySelector('[data-panel="history"]').click();
      var historyRoute=b.runtime.panel.route==='history' && !!document.querySelector('#WidgetsContainer .ink-v2-history');
      document.querySelector('[data-panel="site"]').click();
      var siteRoute=b.runtime.panel.route==='site' && !!document.querySelector('#WidgetsContainer .ink-v2-site-settings');
      document.querySelector('[data-panel="elements"]').click();
      return {hasElementsHeading:hasElementsHeading,noPeerTabs:noPeerTabs,structOpen:structOpen,structClosed:structClosed,historyRoute:historyRoute,siteRoute:siteRoute};
    })()`);
    check("top-bar actions drive panel screens and Structure", state.hasElementsHeading && state.noPeerTabs && state.structOpen && state.structClosed && state.historyRoute && state.siteRoute, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var before=document.documentElement.getAttribute('data-ink-theme');
      var appbarBg=getComputedStyle(document.querySelector('.ink-appbar')).backgroundColor;
      toggleTheme();
      var after=document.documentElement.getAttribute('data-ink-theme');
      var appbarBg2=getComputedStyle(document.querySelector('.ink-appbar')).backgroundColor;
      toggleTheme();
      return {before:before,after:after,toggled:before!==after,changed:appbarBg!==appbarBg2};
    })()`);
    check("editor chrome supports dark and light themes", state.toggled && state.changed && state.before === "dark", JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b = window.builder, r = b.runtime;
      var container = r.insert('container', {}, { settings:{tag:'section'}, styles:{base:{display:'flex','flex-direction':'column',gap:{size:24,unit:'px'},padding:{top:32,right:24,bottom:32,left:24,unit:'px'}}} });
      var heading = r.insert('heading', {parentId:container.id}, { settings:{text:'Foundation heading',tag:'h1'}, styles:{base:{color:'#123456','font-size':{size:48,unit:'px'}},tablet:{'font-size':{size:36,unit:'px'}},mobile:{'font-size':{size:28,unit:'px'}}} });
      var paragraph = r.insert('paragraph', {parentId:container.id}, { settings:{text:'A recursive, editable page document.'} });
      r.selection.select(heading.id);
      var canvas = b.iframeDoc;
      var css = canvas.getElementById('ink-builder-v2-styles').textContent;
      return {
        container:container.id, heading:heading.id, paragraph:paragraph.id,
        nested:!!canvas.querySelector('[data-ink-element-id="'+container.id+'"] [data-ink-element-id="'+heading.id+'"]'),
        text:(function(){var element=canvas.querySelector('[data-ink-element-id="'+heading.id+'"]').cloneNode(true);element.querySelectorAll('[data-ink-editor-only]').forEach(function(item){item.remove()});return element.textContent})(),
        scoped:canvas.querySelector('[data-ink-element-id="'+heading.id+'"]').classList.contains('ink-el-'+heading.id) && css.includes('#123456'),
        responsive:css.includes('@media(max-width:1024px)') && css.includes('@media(max-width:767px)'),
        dimensions:css.includes('padding:32px 24px 32px 24px'),
        overlays:canvas.querySelectorAll('.ink-editor-overlay').length,
        controls:document.querySelectorAll('#SettingsContainer .ink-v2-control').length,
        selected:!!canvas.querySelector('[data-ink-element-id="'+heading.id+'"].ink-is-selected')
      };
    })()`);
    const ids = state;
    check("recursive elements render and remain selectable", state.nested && state.selected && state.text === "Foundation heading", JSON.stringify(state));
    check("generated CSS is scoped and responsive", state.scoped && state.responsive, JSON.stringify(state));
    check("dimension values compile to CSS shorthand", state.dimensions === true, JSON.stringify(state));
    check("selection opens schema-driven controls", state.controls > 0, `${state.controls} controls`);
    check("canvas renders Ink element overlays", state.overlays === 3, `${state.overlays} overlays`);

    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime;
      var aurora=r.insert('aurora-text'); var retro=r.insert('retro-grid'); var bento=r.insert('bento-grid');
      var doc=b.iframeDoc;
      var result={aurora:!!doc.querySelector('.ink-magic-aurora-accent'),retro:!!doc.querySelector('.ink-magic-retro-scroll'),bentoCards:doc.querySelectorAll('.ink-magic-bento-card').length,editable:r.elements.get('bento-grid').controls.some(function(c){return c.type==='repeater'}),published:b.getHtml().includes('ink-magic-bento-grid')};
      r.remove(aurora.id);r.remove(retro.id);r.remove(bento.id);return result;
    })()`);
    check("Magic UI components are native editable v2 elements", state.aurora && state.retro && state.bentoCards === 4 && state.editable && state.published, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=window.builder, element=b.iframeDoc.querySelector('[data-ink-element-id=${JSON.stringify(ids.heading)}]');
      element.dispatchEvent(new b.iframeDoc.defaultView.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:80,clientY:80}));
      var menu=b.iframeDoc.querySelector('.ink-editor-context-menu');
      var actions=menu ? menu.querySelectorAll('button').length : 0;
      menu?.remove();
      var before=b.getData().children[0].children.length; b.runtime.duplicate(${JSON.stringify(ids.heading)});
      var duplicated=b.getData().children[0].children.length===before+1; b.runtime.history.undo();
      b.runtime.copyStyles(${JSON.stringify(ids.heading)}); b.runtime.pasteStyles(${JSON.stringify(ids.paragraph)}); var stylesPasted=b.runtime.document.get(${JSON.stringify(ids.paragraph)}).styles.base.color==='#123456'; b.runtime.history.undo();
      return {actions:actions,duplicated:duplicated,restored:b.getData().children[0].children.length===before,stylesPasted:stylesPasted,stylesRestored:!b.runtime.document.get(${JSON.stringify(ids.paragraph)}).styles.base.color};
    })()`);
    check("context menu, duplicate, and style actions use document commands", state.actions === 8 && state.duplicated && state.restored && state.stylesPasted && state.stylesRestored, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var r=builder.runtime;
      r.elements.register({type:'control-lab',title:'Control lab',category:'Test',icon:'tune',defaults:{settings:{media:'',gallery:[],items:[{title:'First'}],url:{url:'#'},icon:'star',rich:'<p>Text</p>',enabled:true,amount:25},styles:{base:{shadow:{x:0,y:4,blur:12,spread:0,color:'#000000'},border:{width:1,style:'solid',color:'#000000'}}}},controls:[
        {tab:'content',section:'Controls',name:'media',type:'media',label:'Media'},
        {tab:'content',section:'Controls',name:'gallery',type:'gallery',label:'Gallery'},
        {tab:'content',section:'Controls',name:'items',type:'repeater',label:'Repeater',titleField:'title',fields:[{name:'title',type:'text',label:'Title'}]},
        {tab:'content',section:'Controls',name:'url',type:'url',multiple:true,label:'URL'},
        {tab:'content',section:'Controls',name:'icon',type:'icons',label:'Icon'},
        {tab:'content',section:'Controls',name:'rich',type:'wysiwyg',label:'Editor'},
        {tab:'content',section:'Controls',name:'enabled',type:'switcher',label:'Switcher'},
        {tab:'content',section:'Controls',name:'amount',type:'slider',label:'Slider'},
        {tab:'content',target:'styles',section:'Controls',name:'shadow',type:'box-shadow',label:'Shadow'},
        {tab:'content',target:'styles',section:'Controls',name:'border',type:'border',label:'Border'},
        {tab:'content',section:'Controls',name:'more',type:'popover-toggle',label:'Popover',controls:[{name:'moreText',type:'text',label:'Nested'}]}
      ],render:function(context){return context.domDocument.createElement('div')}});
      var lab=r.insert('control-lab'); r.selection.select(lab.id);
      var panel=document.getElementById('SettingsContainer');
      var result={media:!!panel.querySelector('.ink-v2-media'),gallery:!!panel.querySelector('.ink-v2-gallery'),repeater:!!panel.querySelector('.ink-v2-repeater'),url:!!panel.querySelector('.ink-v2-url'),icons:!!panel.querySelector('.ink-v2-icons'),wysiwyg:!!panel.querySelector('.ink-v2-wysiwyg'),switcher:!!panel.querySelector('.ink-v2-switch'),slider:!!panel.querySelector('.ink-v2-slider'),shadow:!!panel.querySelector('.ink-v2-shadow'),border:!!panel.querySelector('.ink-v2-border'),popover:!!panel.querySelector('.ink-v2-popover')};
      r.remove(lab.id); r.selection.select(${JSON.stringify(ids.heading)}); return result;
    })()`);
    check("advanced Ink control families render through schemas", Object.values(state).every(Boolean), JSON.stringify(state));

    // Media picker: opens a dialog, loads the standalone picker page (bounded tiles), and
    // posts the selection back to the canvas.
    state = await client.evaluate(`(function(){
      var r=builder.runtime; var img=r.insert('image',{}); window.__imgId=img.id; r.selection.select(img.id);
      var choose=Array.from(document.querySelectorAll('#SettingsContainer button')).find(function(b){return b.textContent.trim()==='Choose'});
      choose.click();
      window.__mediaUrl=null;
      window.addEventListener('message',function(e){ if(e.data&&e.data.type==='inkwell:media-select'){ window.__mediaUrl=e.data.detail.url; } });
      return {dialogOpened:!!document.getElementById('inkwell-media-picker-modal')?.open};
    })()`);
    const pickerOpened = state.dialogOpened;
    await wait(2500);
    const picker = await client.evaluate(`(function(){
      var iframe=document.querySelector('#inkwell-media-picker-modal iframe');
      var doc=iframe?iframe.contentDocument:null;
      var item=doc?doc.querySelector('[data-controller="media-picker-item"]'):null;
      if(!item) return {err:'no item'};
      var rect=item.getBoundingClientRect(), ifr=iframe.getBoundingClientRect();
      return {items:doc.querySelectorAll('[data-controller="media-picker-item"]').length, bounded:Math.abs(rect.width-rect.height)<4 && rect.width>40, x:Math.round(ifr.x+rect.x+rect.width/2), y:Math.round(ifr.y+rect.y+rect.height/2)};
    })()`);
    if (!picker.err) {
      await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: picker.x, y: picker.y });
      await client.send("Input.dispatchMouseEvent", { type: "mousePressed", x: picker.x, y: picker.y, button: "left", clickCount: 1 });
      await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: picker.x, y: picker.y, button: "left", clickCount: 1 });
      await wait(1200);
    }
    state = await client.evaluate(`(function(){
      var r=builder.runtime; var img=r.document.get(window.__imgId);
      return {selected:window.__mediaUrl, src:img?img.settings.src:null, dialogClosed:!document.getElementById('inkwell-media-picker-modal')?.open};
    })()`);
    check("media picker opens, bounds tiles, and returns the selection", pickerOpened === true && picker.items > 0 && picker.bounded && state.selected && state.src === state.selected && state.dialogClosed, JSON.stringify({ state, picker }));

    state = await client.evaluate(`(function(){
      var b=builder, r=b.runtime;
      var section=r.insert('section',{});
      var heading=r.insert('heading',{parentId:section.id});
      r.selection.select(section.id);
      var styleTab=Array.from(document.querySelectorAll('#SettingsContainer .ink-v2-control-tabs button')).find(function(t){return t.textContent.trim()==='style'});
      if(styleTab) styleTab.click();
      var bg=document.querySelector('#SettingsContainer .ink-v2-background');
      var bgControl=!!bg, bgRows=bg?bg.querySelectorAll('.ink-v2-control').length:0;
      bg?.querySelector('.ink-v2-background-trigger')?.click();
      var bgOpen=!!bg&&bg.classList.contains('is-open');
      var panel=r.panel; panel.route='history'; panel.render();
      var host=document.getElementById('WidgetsContainer');
      var labels=Array.from(host.querySelectorAll('.ink-v2-history-item')).map(function(i){return i.textContent.trim()});
      var hasCurrent=!!host.querySelector('.ink-v2-history-item.is-current');
      var childrenBefore=r.document.get(section.id).children.length;
      host.querySelector('.ink-v2-history-item.is-current')?.click();
      var childrenAfter=r.document.get(section.id).children.length;
      r.selection.select(section.id);
      var d=b.iframeDoc;
      var hEl=d.querySelector('[data-ink-element-id="'+section.id+'"]');
      var toolbar=hEl?hEl.querySelector('.ink-editor-toolbar'):null;
      var toolbarOnSelect=!!toolbar && d.defaultView.getComputedStyle(toolbar).opacity==='1';
      var editorCss=d.querySelector('#ink-editor-canvas-styles')?.textContent||'';
      r.remove(section.id);
      return {labels:labels,hasCurrent:hasCurrent,undoWorks:childrenBefore===1&&childrenAfter===0,bgControl:bgControl,bgRows:bgRows,bgOpen:bgOpen,toolbarOnSelect:toolbarOnSelect,hoverRule:editorCss.includes('data-ink-kind="column"]:hover')};
    })()`);
    check("history panel, background control, and toolbar reveal work", state.hasCurrent && state.undoWorks && state.labels[0].toLowerCase().includes('add heading') && state.bgControl && state.bgRows === 6 && state.bgOpen && state.toolbarOnSelect && state.hoverRule, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder, id=${JSON.stringify(ids.heading)}, element=b.iframeDoc.querySelector('[data-ink-element-id="'+id+'"]');
      element.dispatchEvent(new b.iframeDoc.defaultView.MouseEvent('dblclick',{bubbles:true,cancelable:true}));
      var editing=element.getAttribute('contenteditable')==='true'; var textNode=Array.from(element.childNodes).find(function(child){return child.nodeType===3}); textNode.nodeValue='Inline heading'; element.dispatchEvent(new b.iframeDoc.defaultView.FocusEvent('blur'));
      var committed=b.runtime.document.get(id).settings.text==='Inline heading'; b.runtime.history.undo();
      return {editing:editing,committed:committed,restored:b.runtime.document.get(id).settings.text==='Foundation heading'};
    })()`);
    check("double-click inline editing commits through history", state.editing && state.committed && state.restored, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=window.builder, r=b.runtime, id=${JSON.stringify(ids.heading)};
      r.update(id,{settings:{text:'Edited heading'},styles:{base:{color:'#ef4444'}}},'Edit heading');
      function text(){var element=b.iframeDoc.querySelector('[data-ink-element-id="'+id+'"]').cloneNode(true);element.querySelectorAll('[data-ink-editor-only]').forEach(function(item){item.remove()});return element.textContent}
      var edited=text();
      r.history.undo();
      var undone=text();
      r.history.redo();
      var redone=text();
      return {edited:edited,undone:undone,redone:redone,css:b.iframeDoc.getElementById('ink-builder-v2-styles').textContent.includes('#ef4444')};
    })()`);
    check("history undoes and redoes element changes", state.edited === "Edited heading" && state.undone === "Foundation heading" && state.redone === "Edited heading" && state.css, JSON.stringify(state));

    // ------------------------------------------------------------------
    // Real browser drag & drop: library tile -> iframe canvas, nested drop,
    // and reordering an existing element. No setIntent() calls — the native
    // HTML5 drag session (mouse press/move/release over a draggable tile)
    // drives beginDrag -> iframe dragover -> drop.
    // ------------------------------------------------------------------
    async function realDrag(sx, sy, dx, dy) {
      await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: sx, y: sy });
      await client.send("Input.dispatchMouseEvent", { type: "mousePressed", x: sx, y: sy, button: "left", clickCount: 1 });
      await wait(140);
      const steps = 14;
      for (let i = 1; i <= steps; i += 1) {
        await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: Math.round(sx + (dx - sx) * i / steps), y: Math.round(sy + (dy - sy) * i / steps), button: "left", buttons: 1 });
        await wait(45);
      }
      await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: dx, y: dy, button: "left", clickCount: 1 });
      await wait(500);
    }

    // A) Library -> canvas root insert
    await client.evaluate(`builder.openPanelScreen('elements'); true`);
    await client.evaluate(`(function(){
      var t=Array.from(document.querySelectorAll('#WidgetsContainer [data-ink-element-type]')).find(function(x){return x.dataset.inkElementType==='heading'});
      if(!t) return false;
      var body=document.querySelector('#WidgetsContainer .ink-v2-panel-body');
      body.scrollTop=Math.max(0, t.getBoundingClientRect().top - body.getBoundingClientRect().top - body.clientHeight/2 + 20);
      return true;
    })()`);
    await wait(250);
    let drag = await client.evaluate(`(function(){
      var tile=Array.from(document.querySelectorAll('#WidgetsContainer [data-ink-element-type]')).find(function(t){return t.dataset.inkElementType==='heading'});
      var tr=tile.getBoundingClientRect();
      var ifr=builder.iframe.getBoundingClientRect();
      return { sx:Math.round(tr.x+tr.width/2), sy:Math.round(tr.y+tr.height/2), dx:Math.round(ifr.x+ifr.width/2), dy:Math.round(ifr.y+ifr.height-60), before:builder.runtime.document.data.children.length };
    })()`);
    await realDrag(drag.sx, drag.sy, drag.dx, drag.dy);
    const dragBefore = drag.before;
    state = await client.evaluate(`(function(){
      var r=builder.runtime, d=builder.iframeDoc;
      var rootHeadings=r.document.data.children.filter(function(n){return n.type==='heading'});
      var selectedId=r.selection.selectedId;
      return {
        count:r.document.data.children.length,
        inserted:rootHeadings.length===1,
        markup:!!d.querySelector('[data-ink-element-type="heading"]'),
        selected:!!selectedId && d.querySelector('[data-ink-element-id="'+selectedId+'"].ink-is-selected')!==null,
        droppedId:selectedId,
        structureHas:(function(){ var n=builder.navigator; n.show(); var has=Array.from(document.querySelectorAll('.ink-structure-window-body [data-ink-navigator-id]')).some(function(b){return b.getAttribute('data-ink-navigator-id')===selectedId}); n.hide(); return has; })()
      };
    })()`);
    const droppedHeading = state.droppedId;
    check("real drag from the panel inserts into the canvas", state.count === dragBefore + 1 && state.inserted && state.markup && state.selected && state.structureHas, JSON.stringify(state));
    state = await client.evaluate(`(function(){
      var r=builder.runtime;
      r.history.undo(); var undone=!r.document.get(${JSON.stringify(droppedHeading)});
      r.history.redo(); var redone=!!r.document.get(${JSON.stringify(droppedHeading)});
      return {undone:undone,redone:redone};
    })()`);
    check("drag insertion is undoable and redoable", state.undone && state.redone, JSON.stringify(state));

    // B) Library -> nested container drop
    await client.evaluate(`builder.openPanelScreen('elements'); true`);
    await client.evaluate(`(function(){
      var t=Array.from(document.querySelectorAll('#WidgetsContainer [data-ink-element-type]')).find(function(x){return x.dataset.inkElementType==='paragraph'});
      if(!t) return false;
      var body=document.querySelector('#WidgetsContainer .ink-v2-panel-body');
      body.scrollTop=Math.max(0, t.getBoundingClientRect().top - body.getBoundingClientRect().top - body.clientHeight/2 + 20);
      return true;
    })()`);
    await wait(250);
    drag = await client.evaluate(`(function(){
      var r=builder.runtime, container=r.document.data.children.find(function(n){return n.type==='container'});
      var el=builder.iframeDoc.querySelector('[data-ink-element-id="'+container.id+'"]');
      var rect=el.getBoundingClientRect();
      var ifr=builder.iframe.getBoundingClientRect();
      var tile=Array.from(document.querySelectorAll('#WidgetsContainer [data-ink-element-type]')).find(function(t){return t.dataset.inkElementType==='paragraph'});
      var tr=tile.getBoundingClientRect();
      return {container:container.id, childrenBefore:container.children.length, paragraphsBefore:container.children.filter(function(c){return c.type==='paragraph'}).length, sx:Math.round(tr.x+tr.width/2), sy:Math.round(tr.y+tr.height/2), dx:Math.round(ifr.x+rect.x+rect.width/2), dy:Math.round(ifr.y+rect.y+rect.height*0.4)};
    })()`);
    const nestedTarget = drag.container, nestedChildrenBefore = drag.childrenBefore, nestedParagraphsBefore = drag.paragraphsBefore;
    await realDrag(drag.sx, drag.sy, drag.dx, drag.dy);
    state = await client.evaluate(`(function(){
      var r=builder.runtime, container=r.document.get(${JSON.stringify(nestedTarget)});
      return {count:container.children.length, paragraphs:container.children.filter(function(c){return c.type==='paragraph'}).length, domNested:!!builder.iframeDoc.querySelector('[data-ink-element-id="' + ${JSON.stringify(nestedTarget)} + '"] [data-ink-element-type="paragraph"]')};
    })()`);
    check("real drag drops inside a nested container", state.count === nestedChildrenBefore + 1 && state.paragraphs === nestedParagraphsBefore + 1 && state.domNested, JSON.stringify(state));

    // C) Reorder an existing element (move from inside container to root)
    drag = await client.evaluate(`(function(){
      var r=builder.runtime, container=r.document.data.children.find(function(n){return n.type==='container'});
      var heading=container.children.find(function(c){return c.type==='heading'});
      var el=builder.iframeDoc.querySelector('[data-ink-element-id="'+heading.id+'"]');
      var rect=el.getBoundingClientRect();
      var ifr=builder.iframe.getBoundingClientRect();
      return {heading:heading.id, containerChildren:container.children.length, rootBefore:r.document.data.children.length, sx:Math.round(ifr.x+rect.x+rect.width/2), sy:Math.round(ifr.y+rect.y+rect.height/2), dx:Math.round(ifr.x+ifr.width/2), dy:Math.round(ifr.y+ifr.height-40)};
    })()`);
    const movedHeading = drag.heading, moveContainerChildren = drag.containerChildren, moveRootBefore = drag.rootBefore;
    await realDrag(drag.sx, drag.sy, drag.dx, drag.dy);
    state = await client.evaluate(`(function(){
      var r=builder.runtime;
      var atRoot=r.document.data.children.some(function(n){return n.id===${JSON.stringify(movedHeading)}});
      var container=r.document.data.children.find(function(n){return n.type==='container'});
      return {movedToRoot:atRoot, containerStillHas:!!container && container.children.some(function(c){return c.id===${JSON.stringify(movedHeading)}}), rootCount:r.document.data.children.length};
    })()`);
    check("real drag reorders an existing canvas element", state.movedToRoot && !state.containerStillHas && state.rootCount === moveRootBefore + 1 && moveContainerChildren - 1 >= 1, JSON.stringify(state));


    state = await client.evaluate(`(function(){
      switchToTabletMode();
      var tablet={device:builder.runtime.responsive.device,width:builder.mainContainer.style.width,active:document.getElementById('tabletModeButton').classList.contains('active'),bar:!!builder.mainContainer.querySelector('.ink-v2-responsive-bar'),handles:builder.mainContainer.querySelectorAll('.ink-v2-viewport-handle').length};
      builder.viewport.setScale(.8); builder.viewport.setSize(700,900); var custom={width:builder.mainContainer.style.width,height:builder.iframe.style.height,scale:builder.mainContainer.style.getPropertyValue('--ink-preview-scale')};
      switchToMobileMode();
      var mobile={device:builder.runtime.responsive.device,width:builder.mainContainer.style.width,active:document.getElementById('mobileModeButton').classList.contains('active')};
      switchToDesktopMode();
      return {tablet:tablet,custom:custom,mobile:mobile,desktop:builder.mainContainer.style.width};
    })()`);
    check("responsive toolbar drives canvas and control context", state.tablet.device === "tablet" && state.tablet.width === "768px" && state.tablet.active && state.tablet.bar && state.tablet.handles === 3 && state.custom.width === "700px" && state.custom.height === "900px" && state.custom.scale === "0.8" && state.mobile.device === "mobile" && state.mobile.width === "375px" && state.mobile.active && state.desktop === "100%", JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var n=builder.navigator;
      n.show();
      var rows=Array.from(document.querySelectorAll('.ink-structure-window-body [data-ink-navigator-id]'));
      var result={count:rows.length,labels:rows.map(function(button){return button.textContent.trim();}),nested:!!rows[1]?.closest('ul')?.parentElement?.closest('li'),toggled:!!document.getElementById('structureButton')};
      n.hide();
      return result;
    })()`);
    check("Structure mirrors the recursive document and syncs with the top bar", state.count >= 3 && state.labels.some((label) => label.includes("Edited heading")) && state.nested && state.toggled, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var n=builder.navigator, panel=n.panel;
      localStorage.setItem('inkwell_builder_nav_collapsed','[]');
      panel.collapsedNodes.clear(); panel.render();
      n.show();
      var rows=Array.from(document.querySelectorAll('.ink-structure-window-body [data-ink-navigator-id]'));
      var container=rows.find(function(b){return b.closest('li').querySelector('ul');});
      if(!container) { n.hide(); return {ok:false}; }
      var parentId=container.getAttribute('data-ink-navigator-id');
      panel.toggleNavigatorCollapse(parentId);
      var saved=JSON.parse(localStorage.getItem('inkwell_builder_nav_collapsed')||'[]');
      var collapsed=panel.collapsedNodes.has(parentId) && saved.includes(parentId);
      var gone=container.closest('li').querySelectorAll('ul').length===0;
      panel.toggleNavigatorCollapse(parentId);
      var expanded=!panel.collapsedNodes.has(parentId) && container.closest('li').querySelectorAll('ul').length>0;
      n.hide();
      return {ok:true,collapsed:collapsed,expanded:expanded};
    })()`);
    check("navigator expand/collapse persists to localStorage", state.ok && state.collapsed && state.expanded, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var r=builder.runtime, n=builder.navigator; n.show();
      var first=r.document.data.children[0], second=r.document.data.children[1];
      if(!first||!second) { n.hide(); return {ok:false}; }
      var rows=Array.from(document.querySelectorAll('.ink-structure-window-body [data-ink-navigator-id]'));
      var srcRow=rows.find(function(b){return b.getAttribute('data-ink-navigator-id')===first.id;});
      var dstRow=rows.find(function(b){return b.getAttribute('data-ink-navigator-id')===second.id;});
      var dt=new DataTransfer(), beforeOrder=r.document.data.children.map(function(x){return x.id;}).join(',');
      srcRow.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:dt}));
      var rowDiv=dstRow.closest('.ink-v2-navigator-row'), rect=rowDiv.getBoundingClientRect();
      dstRow.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:rect.left+5,clientY:rect.bottom-2}));
      var zone=rowDiv.dataset.inkNavDrop;
      dstRow.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
      var moved=!!(r.document.data.children[0].id===second.id && r.document.data.children[1].id===first.id);
      r.history.undo();
      var restored=r.document.data.children.map(function(x){return x.id;}).join(',')===beforeOrder;
      n.hide();
      return {ok:true,moved:moved,restored:restored,zone:zone};
    })()`);
    check("navigator drag reorders via before/after drop zones", state.ok && state.moved && state.restored && (state.zone==="before"||state.zone==="after"), JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var r=builder.runtime, b=builder, id=${JSON.stringify(ids.heading)};
      r.update(id,{settings:{hidden:true}},'Hide element');
      var el=b.iframeDoc.querySelector('[data-ink-element-id="'+id+'"]');
      var dimmed=!!el && el.hasAttribute('data-ink-hidden') && b.iframeDoc.defaultView.getComputedStyle(el).opacity==="0.4";
      var html=b.getHtml();
      var publishedHidden=!html.includes('ink-el-'+id);
      r.update(id,{settings:{hidden:false}},'Show element');
      var shown=!!b.iframeDoc.querySelector('[data-ink-element-id="'+id+'"]') && !b.iframeDoc.querySelector('[data-ink-element-id="'+id+'"]').hasAttribute('data-ink-hidden');
      return {ok:true,dimmed:dimmed,publishedHidden:publishedHidden,shown:shown};
    })()`);
    check("hidden toggle dims canvas and strips publish output", state.ok && state.dimmed && state.publishedHidden && state.shown, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var r=builder.runtime, b=builder, id=${JSON.stringify(ids.heading)};
      r.update(id,{settings:{locked:true}},'Lock element');
      var el=b.iframeDoc.querySelector('[data-ink-element-id="'+id+'"]');
      var overlay=b.iframeDoc.querySelector('[data-ink-element-id="'+id+'"] > .ink-editor-overlay');
      var canvasLocked=!!el && el.hasAttribute('data-ink-locked') && el.draggable===false;
      var toolbarDisabled=!!overlay && Array.from(overlay.querySelectorAll('.ink-editor-toolbar button')).length>0 && Array.from(overlay.querySelectorAll('.ink-editor-toolbar button')).every(function(btn){return btn.disabled;});
      var row=Array.from(document.querySelectorAll('.ink-structure-window-body [data-ink-navigator-id]')).find(function(x){return x.getAttribute('data-ink-navigator-id')===id;});
      var rowLocked=!!row && row.classList.contains('is-locked');
      r.update(id,{settings:{locked:false}},'Unlock element');
      var unlocked=!!b.iframeDoc.querySelector('[data-ink-element-id="'+id+'"]') && !b.iframeDoc.querySelector('[data-ink-element-id="'+id+'"]').hasAttribute('data-ink-locked');
      return {ok:true,canvasLocked:canvasLocked,toolbarDisabled:toolbarDisabled,rowLocked:rowLocked,unlocked:unlocked};
    })()`);
    check("lock disables canvas toolbar and marks the navigator row", state.ok && state.canvasLocked && state.toolbarDisabled && state.rowLocked && state.unlocked, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var n=builder.navigator; n.show();
      var row=document.querySelector('.ink-structure-window-body [data-ink-navigator-id]');
      row.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:80,clientY:120}));
      var menu=document.querySelector('.ink-navigator-context-menu');
      var opened=!!menu;
      var items=opened?Array.from(menu.querySelectorAll('button')).map(function(b){return b.dataset.action;}):[];
      n.panel.closeNavigatorMenu();
      var closed=!document.querySelector('.ink-navigator-context-menu');
      n.hide();
      return {ok:true,opened:opened,items:items,closed:closed};
    })()`);
    check("navigator context menu offers element actions", state.ok && state.opened && ["duplicate","copy","paste","rename","delete"].every(function(a){return state.items.includes(a);}) && state.closed, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var n=builder.navigator;
      n.show(); n.setDocked(true);
      var docked=JSON.parse(localStorage.getItem('inkwell_builder_navigator')||'{}').docked===true;
      n.setDocked(false);
      var undocked=JSON.parse(localStorage.getItem('inkwell_builder_navigator')||'{}').docked===false;
      n.hide();
      return {ok:true,docked:docked,undocked:undocked};
    })()`);
    check("navigator dock state persists", state.ok && state.docked && state.undocked, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder, r=b.runtime, canvas=b.iframeDoc, win=b.iframeDoc.defaultView;
      var full=r.insert('section',{}, {settings:{layout:'full'}});
      var boxed=r.insert('section',{}, {settings:{layout:'boxed'}});
      var fEl=canvas.querySelector('[data-ink-element-id="'+full.id+'"]');
      var bEl=canvas.querySelector('[data-ink-element-id="'+boxed.id+'"] .ink-el-section-inner');
      var gutter=parseFloat(win.getComputedStyle(canvas.querySelector('[data-ink-canvas-root]')).paddingLeft)||0;
      var css=canvas.getElementById('ink-builder-v2-styles').textContent;
      var result={
        fullWidth:Math.abs(fEl.getBoundingClientRect().width-(fEl.parentElement.getBoundingClientRect().width-gutter*2))<2,
        boxedW:Math.round(bEl.getBoundingClientRect().width),
        contentWidth:(css.match(/--ink-content-width:([^;]+)/)||[])[1],
        gutterApplied:gutter===10,
        gutterCss:css.includes('--ink-page-gutter:10px')
      };
      r.remove(full.id); r.remove(boxed.id);
      return result;
    })()`);
    check("boxed/full-width sections respect content width and page gutter", state.fullWidth && state.boxedW > 0 && state.contentWidth === "1140px" && state.gutterApplied && state.gutterCss, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder, r=b.runtime, id=${JSON.stringify(ids.heading)};
      r.update(id,{styles:{base:{'margin':{top:10,right:20,bottom:30,left:40,unit:'px',linked:false}}}},'Set margins');
      var css=b.iframeDoc.getElementById('ink-builder-v2-styles').textContent;
      var unlinked=css.includes('margin:10px 20px 30px 40px');
      r.history.undo();
      var undone=!b.runtime.document.get(id).styles.base.margin;
      var gaps=r.insert('columns',{}, {settings:{structure:'50,50'},children:[r.create('column'),r.create('column')]});
      r.update(gaps.id,{styles:{base:{gap:{row:30,column:12,unit:'px'}}}},'Set gaps');
      var gapCss=b.iframeDoc.getElementById('ink-builder-v2-styles').textContent.includes('gap:30px 12px');
      var responsive=r.insert('paragraph',{},{styles:{base:{'font-size':{size:18,unit:'px'}},tablet:{'font-size':{size:16,unit:'px'}},mobile:{}}});
      r.remove(gaps.id); r.remove(responsive.id);
      return {unlinked:unlinked,undone:undone,gapCss:gapCss};
    })()`);
    check("independent row/column gaps and linked/unlinked dimensions", state.unlinked && state.undone && state.gapCss, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder, r=b.runtime;
      var section=r.insert('section',{});
      var types=['heading','paragraph','button','text-editor','html','icon','icon-box','image-box','icon-list','counter','progress','rating','testimonial','tabs','accordion','toggle','alert','social-icons','read-more','divider','spacer'];
      var rendered={};
      types.forEach(function(t){ var w=r.insert(t,{parentId:section.id}); rendered[t]=!!b.iframeDoc.querySelector('[data-ink-element-type="'+t+'"]'); });
      var d=b.iframeDoc, scope='[data-ink-element-id="'+section.id+'"]';
      var cleanText=function(sel){var el=d.querySelector(scope+' '+sel);if(!el)return null;var clone=el.cloneNode(true);clone.querySelectorAll('[data-ink-editor-only]').forEach(function(n){n.remove()});return clone.textContent.trim();};
      var checks={
        heading:cleanText('[data-ink-element-type="heading"]')==='Heading',
        button:!!d.querySelector(scope+' [data-ink-element-type="button"]')?.classList.contains('ink-el-button'),
        progressBar:d.querySelector(scope+' [data-ink-element-type="progress"] .ink-el-progress-value')?.style.width,
        textEditor:(cleanText('[data-ink-element-type="text-editor"]')||'').length>0
      };
      r.remove(section.id);
      return {count:types.length,rendered:Object.values(rendered).every(Boolean),checks:checks};
    })()`);
    check("core widgets render with semantic markup and designed defaults", state.count === 21 && state.rendered && state.checks.heading && state.checks.button && state.checks.progressBar === "75%" && state.checks.textEditor, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder, r=b.runtime;
      var container=r.insert('container',{});
      var btn=r.insert('button',{parentId:container.id},{settings:{text:'Go',size:'lg',icon:'arrow_forward',iconPosition:'after',align:'center',url:'#x'}});
      var heading=r.insert('heading',{parentId:container.id},{settings:{text:'Linked',tag:'h2',link:'https://example.com'}});
      var img=r.insert('image',{parentId:container.id},{settings:{src:'https://example.com/i.png',caption:'Cap',link:'https://ex.com',align:'center'}});
      var icon=r.insert('icon',{parentId:container.id},{settings:{icon:'star',rotate:45}});
      var divider=r.insert('divider',{parentId:container.id},{settings:{align:'center'}});
      var d=b.iframeDoc;
      var btnEl=d.querySelector('[data-ink-element-id="'+btn.id+'"]');
      var result={
        buttonSize:btnEl.classList.contains('is-size-lg'),
        buttonAlign:btnEl.classList.contains('is-align-center'),
        buttonIcon:!!btnEl.querySelector('.ink-el-button-icon'),
        headingLink:!!d.querySelector('[data-ink-element-id="'+heading.id+'"] a'),
        imageFigure:d.querySelector('[data-ink-element-id="'+img.id+'"]')?.classList.contains('ink-el-image-figure'),
        imageCaption:d.querySelector('[data-ink-element-id="'+img.id+'"] figcaption')?.textContent==='Cap',
        imageLinked:!!d.querySelector('[data-ink-element-id="'+img.id+'"] .ink-el-image-link'),
        iconRotate:d.querySelector('[data-ink-element-id="'+icon.id+'"]')?.style.transform,
        dividerAlign:d.querySelector('[data-ink-element-id="'+divider.id+'"]')?.classList.contains('is-align-center')
      };
      // states switcher appears on state-capable controls (button style tab)
      r.selection.select(btn.id);
      var styleTab=Array.from(document.querySelectorAll('#SettingsContainer .ink-v2-control-tabs button')).find(function(t){return t.textContent.trim()==='style'});
      if(styleTab) styleTab.click();
      result.statesSwitcher=!!document.querySelector('#SettingsContainer .ink-v2-states');
      r.remove(container.id);
      return result;
    })()`);
    check("primitive widgets expose Elementor-style controls and markup", state.buttonSize && state.buttonAlign && state.buttonIcon && state.headingLink && state.imageFigure && state.imageCaption && state.imageLinked && state.iconRotate === "rotate(45deg)" && state.dividerAlign && state.statesSwitcher, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder, r=b.runtime;
      var section=r.insert('section',{});
      var heading=r.insert('heading',{parentId:section.id},{styles:{base:{'background-image':'https://example.com/bg.jpg',filter:{blur:1,brightness:90,contrast:110,saturate:80,hue:5},'-webkit-text-stroke':{strokeWidth:2,unit:'px',color:'#ff0000'}}}});
      var gradientEl=r.insert('paragraph',{parentId:section.id},{styles:{base:{'background-image':'linear-gradient(90deg, #6ec1e4, #4054b2)'}}});
      var css=b.iframeDoc.getElementById('ink-builder-v2-styles').textContent;
      var result={
        bg:css.includes('url("https://example.com/bg.jpg")'),
        gradient:css.includes('linear-gradient(90deg, #6ec1e4, #4054b2)'),
        filters:css.includes('blur(1px) brightness(90%) contrast(110%) saturate(80%) hue-rotate(5deg)'),
        stroke:css.includes('2px #ff0000')
      };
      r.remove(section.id);
      return result;
    })()`);
    check("background images, gradients, CSS filters, and text stroke compile", state.bg && state.gradient && state.filters && state.stroke, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder, r=b.runtime;
      var container=r.insert('container',{});
      r.selection.select(container.id);
      var finder=b.finder; finder.show(); finder.input.value='Heading'; finder.render();
      var addButton=finder.results.querySelector('section button');
      addButton.click();
      var node=r.document.get(container.id);
      var result={inserted:node.children.some(function(c){return c.type==='heading'}), nested:!!b.iframeDoc.querySelector('[data-ink-element-id="'+container.id+'"] [data-ink-element-type="heading"]')};
      r.remove(container.id);
      return result;
    })()`);
    check("finder inserts into the selected container", state.inserted && state.nested, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder, canvas=b.iframeDoc;
      var overlays=canvas.querySelectorAll('.ink-editor-overlay').length;
      var count=builder.runtime.document.data.children.length;
      b.setMode('preview');
      var hidden=overlays>0 && Array.from(canvas.querySelectorAll('.ink-editor-overlay,.ink-editor-empty')).every(function(el){return b.iframeDoc.defaultView.getComputedStyle(el).display==='none'});
      b.setMode('design');
      return {overlays:overlays,hidden:hidden,count:count};
    })()`);
    check("preview mode removes all editor-only UI", state.overlays > 0 && state.hidden, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      document.getElementById('customCss').value='body{--smoke-color:#0ea5e9}';
      document.getElementById('customJs').value='window.__inkSmoke=true';
      applyCustomCode();
      var doc=builder.iframeDoc;
      var injected=doc.getElementById('pb-custom-css')?.textContent.includes('--smoke-color') && doc.defaultView.__inkSmoke === true;
      enterBuilderMode('code');
      var codeOpen=document.querySelector('[data-smenu="code"]').classList.contains('active') && !!window.codeMirrors.html;
      enterBuilderMode('design');
      var design=builder.getMode()==='design';
      toggleDesignMode(); var preview=builder.getMode()==='preview';
      toggleDesignMode();
      return {injected:injected,codeOpen:codeOpen,design:design,preview:preview};
    })()`);
    check("custom CSS and JS inject live", state.injected === true);
    check("Code and Design/Preview modes work", state.codeOpen && state.design && state.preview, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var html=builder.getHtml();
      return {
        semantic:/<section[^>]*>[\\s\\S]*<h1[^>]*>Edited heading<\\/h1>/.test(html),
        scoped:html.includes('ink-builder-v2-styles') && html.includes('#ef4444'),
        custom:html.includes('pb-custom-css') && html.includes('--smoke-color'),
        layout:html.includes('data-ink-publish-styles') && html.includes('ink-canvas-styles') && html.includes('.ink-el-columns'),
        clean:!html.includes('data-ink-element-id') && !html.includes('data-ink-element-type') && !html.includes('draggable=') && !html.includes('ink-editor-canvas-styles') && !html.includes('ink-is-selected') && !html.includes('ink-editor-toolbar') && !html.includes('data-ink-layout') && !html.includes('data-ink-structure')
      };
    })()`);
    check("publish HTML preserves semantic content and scoped styles", state.semantic && state.scoped && state.custom, JSON.stringify(state));
    check("publish HTML ships self-contained layout CSS", state.layout === true, JSON.stringify(state));
    check("publish HTML strips editor-only state", state.clean === true, JSON.stringify(state));

    if (process.env.SMOKE_SCREENSHOT) {
      await client.evaluate(`builder.runtime.selection.select(${JSON.stringify(ids.heading)})`);
      const capture = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      fs.writeFileSync(process.env.SMOKE_SCREENSHOT, Buffer.from(capture.result.data, "base64"));
    }

    state = await client.evaluate(`(function(){
      var before=builder.getData().children.length;
      clearPage(); var empty=builder.getData().children.length===0;
      builder.runtime.history.undo(); var restored=builder.getData().children.length===before;
      return {before:before,empty:empty,restored:restored};
    })()`);
    // ------------------------------------------------------------------
    // Additional drag/drop paths: blank root, empty container helper,
    // before/after an existing widget, reorder between containers, and
    // drag cancellation (no mutation, no leftover indicators).
    // ------------------------------------------------------------------
    async function scrollTile(type) {
      await client.evaluate(`builder.openPanelScreen('elements'); true`);
      await client.evaluate(`(function(){
        var t=Array.from(document.querySelectorAll('#WidgetsContainer [data-ink-element-type]')).find(function(x){return x.dataset.inkElementType===${JSON.stringify(type)}});
        if(!t) return false;
        var b=document.querySelector('#WidgetsContainer .ink-v2-panel-body');
        b.scrollTop=Math.max(0, t.getBoundingClientRect().top - b.getBoundingClientRect().top - b.clientHeight/2 + 20);
        return true;
      })()`);
      await wait(250);
      return await client.evaluate(`(function(){
        var t=Array.from(document.querySelectorAll('#WidgetsContainer [data-ink-element-type]')).find(function(x){return x.dataset.inkElementType===${JSON.stringify(type)}});
        var tr=t.getBoundingClientRect();
        return { sx:Math.round(tr.x+tr.width/2), sy:Math.round(tr.y+tr.height/2) };
      })()`);
    }

    // D) Library -> completely blank root
    await client.evaluate(`(function(){ var r=builder.runtime; r.document.replace({version:2,type:'page',settings:{title:'Blank'},children:[]}); r.history.undoStack.length=0; r.history.redoStack.length=0; return true; })()`);
    await wait(300);
    const blankTile = await scrollTile('heading');
    const blankPoint = await client.evaluate(`(function(){ var d=builder.iframeDoc; var root=d.querySelector('.ink-editor-root-empty'); var rr=root.getBoundingClientRect(); var ifr=builder.iframe.getBoundingClientRect(); return { dx:Math.round(ifr.x+rr.x+rr.width/2), dy:Math.round(ifr.y+rr.y+rr.height/2) }; })()`);
    await realDrag(blankTile.sx, blankTile.sy, blankPoint.dx, blankPoint.dy);
    state = await client.evaluate(`(function(){ var r=builder.runtime; return { count:r.document.data.children.length, inserted:r.document.data.children.some(function(n){return n.type==='heading'}), selected:!!r.selection.selectedId }; })()`);
    check("drag onto a completely blank canvas inserts at root", state.count === 1 && state.inserted && state.selected, JSON.stringify(state));

    // E) Library -> empty container helper
    await client.evaluate(`(function(){ var r=builder.runtime; var c=r.insert('container',{}); window.__emptyContainer=c.id; builder.openPanelScreen('elements'); return true; })()`);
    await wait(300);
    const emptyTile = await scrollTile('paragraph');
    const emptyPoint = await client.evaluate(`(function(){ var c=window.__emptyContainer; var el=builder.iframeDoc.querySelector('[data-ink-element-id="'+c+'"] .ink-editor-empty'); var r=el.getBoundingClientRect(); var ifr=builder.iframe.getBoundingClientRect(); return { dx:Math.round(ifr.x+r.x+r.width/2), dy:Math.round(ifr.y+r.y+r.height/2) }; })()`);
    await realDrag(emptyTile.sx, emptyTile.sy, emptyPoint.dx, emptyPoint.dy);
    state = await client.evaluate(`(function(){ var r=builder.runtime; var c=r.document.get(window.__emptyContainer); return { inside:c.children.some(function(n){return n.type==='paragraph'}), domNested:!!builder.iframeDoc.querySelector('[data-ink-element-id="'+c.id+'"] [data-ink-element-type="paragraph"]') }; })()`);
    check("drag into an empty container helper inserts inside", state.inside && state.domNested, JSON.stringify(state));

    // F) Library -> after an existing widget
    await client.evaluate(`(function(){ var r=builder.runtime; var c=r.document.get(window.__emptyContainer); r.insert('heading',{parentId:c.id},{settings:{text:'H'}}); return true; })()`);
    await wait(300);
    const afterTile = await scrollTile('button');
    const afterPoint = await client.evaluate(`(function(){ var c=window.__emptyContainer; var el=builder.iframeDoc.querySelector('[data-ink-element-id="'+c+'"]'); var r=el.getBoundingClientRect(); var ifr=builder.iframe.getBoundingClientRect(); return { dx:Math.round(ifr.x+r.x+r.width/2), dy:Math.round(ifr.y+r.y+r.height*0.85) }; })()`);
    await realDrag(afterTile.sx, afterTile.sy, afterPoint.dx, afterPoint.dy);
    state = await client.evaluate(`(function(){ var r=builder.runtime; var c=r.document.get(window.__emptyContainer); var types=c.children.map(function(n){return n.type}); var idx=types.indexOf('button'); return { after:idx>=0 && types[idx-1]==='heading', types:types }; })()`);
    check("drag before/after an existing widget places it as a sibling", state.after, JSON.stringify(state.types));

    // G) Reorder between containers
    await client.evaluate(`(function(){
      var r=builder.runtime; var c=r.document.get(window.__emptyContainer);
      var b=c.children.find(function(n){return n.type==='button'});
      var other=r.insert('container',{}); window.__other=other.id;
      window.__moveButton=b.id;
      return true;
    })()`);
    await wait(300);
    const movePoint = await client.evaluate(`(function(){
      var d=builder.iframeDoc; var b=window.__moveButton; var el=d.querySelector('[data-ink-element-id="'+b+'"]'); var r=el.getBoundingClientRect(); var ifr=builder.iframe.getBoundingClientRect();
      var other=d.querySelector('[data-ink-element-id="'+window.__other+'"] .ink-editor-empty'); var or=other.getBoundingClientRect();
      return { sx:Math.round(ifr.x+r.x+r.width/2), sy:Math.round(ifr.y+r.y+r.height/2), dx:Math.round(ifr.x+or.x+or.width/2), dy:Math.round(ifr.y+or.y+or.height/2) };
    })()`);
    await realDrag(movePoint.sx, movePoint.sy, movePoint.dx, movePoint.dy);
    state = await client.evaluate(`(function(){ var r=builder.runtime; return { moved:r.document.get(window.__other).children.some(function(n){return n.id===window.__moveButton}), left:r.document.get(window.__emptyContainer).children.some(function(n){return n.id===window.__moveButton}) }; })()`);
    check("drag reorders/reparents a widget between containers", state.moved && !state.left, JSON.stringify(state));

    // H) Drag cancellation — dropping outside the canvas (or Escape) mutates nothing.
    await client.evaluate(`(function(){ var r=builder.runtime; r.history.undoStack.length=0; r.history.redoStack.length=0; return true; })()`);
    const beforeCancel = await client.evaluate(`builder.runtime.document.data.children.length`);
    const cancelTile = await scrollTile('icon');
    await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: cancelTile.sx, y: cancelTile.sy });
    await client.send("Input.dispatchMouseEvent", { type: "mousePressed", x: cancelTile.sx, y: cancelTile.sy, button: "left", clickCount: 1 });
    await wait(120);
    // Move to the app bar (outside the canvas) and release — no canvas drop fires.
    await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 100, y: 24, button: "left", buttons: 1 });
    await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 100, y: 24, button: "left", clickCount: 1 });
    await wait(400);
    state = await client.evaluate(`(function(){
      return { count: builder.runtime.document.data.children.length, leftover: builder.iframeDoc.querySelectorAll('[data-ink-drop-position]').length, ghost: !!document.querySelector('.ink-drag-ghost') };
    })()`);
    check("drag cancellation mutates nothing and leaves no indicators", state.count === beforeCancel && state.leftover === 0 && !state.ghost, JSON.stringify(state));
    state = await client.evaluate(`(function(){
      var before=builder.getData().children.length;
      clearPage(); var empty=builder.getData().children.length===0;
      builder.runtime.history.undo(); var restored=builder.getData().children.length===before;
      return {before:before,empty:empty,restored:restored};
    })()`);
    check("Clear is undoable and keeps the document valid", state.before >= 1 && state.empty && state.restored, JSON.stringify(state));

    await client.send("Page.navigate", { url: `${BASE_URL}/admin/pages/${pageId}/edit` });
    await wait(6000);
    state = await client.evaluate(`(function(){
      var frame=document.querySelector('iframe[title="Ink Builder preview"]');
      return {block:!!document.querySelector('[data-block-editor-target="block"][data-type="page_builder"]'),preview:!!frame,styled:!!frame && frame.getAttribute('srcdoc').includes('ink-design-kit.css')};
    })()`);
    check("classic editor shows the builder block", state.block === true);
    check("classic editor preview remains styled", state.preview && state.styled, JSON.stringify(state));

    const relevantErrors = client.errors.filter((error) => !/not configured|favicon|Failed to load resource/.test(error));
    check("no uncaught console errors", relevantErrors.length === 0, relevantErrors[0] || "");
    client.close();
  } finally {
    chrome.kill("SIGKILL");
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
  }

  console.log(`\n${failures ? "Smoke failed" : "Smoke passed"} (${failures} failures)`);
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error("FATAL:", error.stack || error.message);
  process.exit(1);
});
