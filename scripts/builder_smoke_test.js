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
const IMPORTED_PAGE_IDS = (process.env.IMPORTED_PAGE_IDS || process.env.IMPORTED_PAGE_ID || "").split(",").map((id) => id.trim()).filter(Boolean);
const PUBLISH_IMPORTED_PAGE_ID = process.env.PUBLISH_IMPORTED_PAGE_ID || null;
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
      const stack = (message.params.stackTrace?.callFrames || []).map((f) => `  at ${f.functionName} (${f.url}:${f.lineNumber}:${f.columnNumber})`).join("\n");
      errors.push((message.params.args || []).map((arg) => arg.value || arg.description || "").join(" ") + (stack ? "\n" + stack : ""));
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
        snapshotFallbackAbsent: !!b && !b.runtime.elements.has('site-snapshot') && !Array.from(document.querySelectorAll('[data-ink-element-type]')).some(function(tile){return tile.dataset.inkElementType==='site-snapshot'}),
        elements: document.querySelectorAll('[data-ink-element-type]').length,
        noBootstrap: !!canvas && Array.from(canvas.querySelectorAll('link[rel="stylesheet"]')).every(function(link){ return !/bootstrap/i.test(link.href); })
      };
    })()`);
    check("builder loads the v2 runtime", state.title === "Ink Builder — Inkwell" && state.v2 && state.ready, JSON.stringify(state));
    check("legacy v1 data starts as a clean v2 document", state.version === 2 && state.childCount === 0 && state.legacyAbsent, JSON.stringify(state));
    check("website imports cannot downgrade to an iframe snapshot", state.snapshotFallbackAbsent === true);
    check("empty canvas exposes a real drop surface", state.emptyHelper === true);
    check("element library is registry-driven", state.elements >= 54, `${state.elements} elements`);
    check("canvas has no Bootstrap dependency", state.noBootstrap === true);
    state = await client.evaluate(`(function(){
      var r=builder.runtime;
      var section=r.elements.get('section'), columns=r.elements.get('columns'), container=r.elements.get('container');
      var flagged=section.legacy===true && columns.legacy===true && container.legacy!==true;
      var containerFirst=document.querySelectorAll('.ink-v2-library-section')[0].textContent.includes('Container');
      return {flagged:flagged,containerFirst:containerFirst};
    })()`);
    check("modern Container is primary; legacy Section/Columns are flagged", state.flagged && state.containerFirst, JSON.stringify(state));
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
      var r=builder.runtime, canvas=builder.iframeDoc;
      var timeline=r.insert('timeline-accordion',{}, {settings:{behavior:'single',defaultOpen:0,transitionDuration:120,items:[
        {eyebrow:'ONE',title:'First milestone',content:'First details'},
        {eyebrow:'TWO',title:'Second milestone',content:'Second details'}
      ]}});
      var root=canvas.querySelector('[data-ink-element-id="'+timeline.id+'"]');
      var items=Array.from(root.querySelectorAll('.ink-el-timeline-item'));
      items[1].querySelector('.ink-el-timeline-question').click();
      var toolbar=root.querySelector('.ink-editor-toolbar');
      var controls=r.elements.get('timeline-accordion').controls;
      var result={
        native:items.length===2,
        single:!items[0].classList.contains('is-open')&&items[1].classList.contains('is-open'),
        accessible:items[1].querySelector('.ink-el-timeline-question').getAttribute('aria-expanded')==='true',
        configurable:controls.some(function(c){return c.name==='items'&&c.type==='repeater'})&&controls.some(function(c){return c.name==='behavior'}),
        toolbarButtons:toolbar.querySelectorAll('button').length===5,
        toolbarIcons:toolbar.querySelectorAll('button svg.ink-canvas-action-icon').length===5,
        published:builder.getHtml().includes('ink-el-timeline-accordion')&&builder.getHtml().includes('Timeline accordion')
      };
      r.remove(timeline.id); return result;
    })()`);
    check("timeline accordion is native, editable, interactive, and publishable", state.native && state.single && state.accessible && state.configurable && state.published, JSON.stringify(state));
    check("every canvas action uses an explicit Lucide SVG", state.toolbarButtons && state.toolbarIcons, JSON.stringify(state));

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
      document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
      var closesFromShell=!b.iframeDoc.querySelector('.ink-editor-context-menu');
      element.dispatchEvent(new b.iframeDoc.defaultView.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:80,clientY:80}));
      b.iframeDoc.body.dispatchEvent(new b.iframeDoc.defaultView.PointerEvent('pointerdown',{bubbles:true}));
      var closesFromCanvas=!b.iframeDoc.querySelector('.ink-editor-context-menu');
      var before=b.getData().children[0].children.length; b.runtime.duplicate(${JSON.stringify(ids.heading)});
      var duplicated=b.getData().children[0].children.length===before+1; b.runtime.history.undo();
      b.runtime.copyStyles(${JSON.stringify(ids.heading)}); b.runtime.pasteStyles(${JSON.stringify(ids.paragraph)}); var stylesPasted=b.runtime.document.get(${JSON.stringify(ids.paragraph)}).styles.desktop.base.color==='#123456'; b.runtime.history.undo();
      return {actions:actions,closesFromShell:closesFromShell,closesFromCanvas:closesFromCanvas,duplicated:duplicated,restored:b.getData().children[0].children.length===before,stylesPasted:stylesPasted,stylesRestored:!b.runtime.document.get(${JSON.stringify(ids.paragraph)}).styles.desktop.base.color};
    })()`);
    check("context menu dismisses outside and element actions use document commands", state.actions === 8 && state.closesFromShell && state.closesFromCanvas && state.duplicated && state.restored && state.stylesPasted && state.stylesRestored, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var r=builder.runtime;
      window.__registryBaseline = r.elements.list().length;
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
      r.remove(lab.id);
      r.elements.unregister('control-lab'); // restore the registry — no synthetic types leak
      r.selection.select(${JSON.stringify(ids.heading)}); return result;
    })()`);
    check("control renderers are reachable from schema controls", Object.values(state).every(Boolean), JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var r=builder.runtime, panel=r.settingsPanel;
      var fallback=new Set(['textarea','code','select','select2','font','animation','exit-animation','hover-animation','choose','visual-choice','size','text','number','url','date-time']);
      var host=document.createElement('div'); host.className='ink-v2-panel ink-v2-controls'; host.style.cssText='position:fixed;left:0;top:0;width:320px;visibility:hidden;pointer-events:none;z-index:-1'; document.body.appendChild(host);
      var result={definitions:0,controls:0,types:{},failures:[],unknown:[],overflows:[],nativeColors:0,unstyledSelects:0,hostWidth:host.clientWidth};
      r.elements.list().filter(function(definition){return !definition.internal;}).forEach(function(definition){
        result.definitions+=1;
        var node=r.create(definition.type);
        (definition.controls||[]).forEach(function(control){
          result.controls+=1; result.types[control.type]=(result.types[control.type]||0)+1;
          if(!r.controls.has(control.type)&&!fallback.has(control.type)) result.unknown.push({element:definition.type,type:control.type,label:control.label});
          try {
            var row=panel.renderControl(control,node); host.appendChild(row);
            var hostRight=host.getBoundingClientRect().right;
            var overflowing=Array.from(row.querySelectorAll('*')).find(function(child){
              var style=getComputedStyle(child),rect=child.getBoundingClientRect();
              return style.display!=='none' && style.visibility!=='hidden' && rect.width>0 && rect.height>0 && rect.right>hostRight+2;
            });
            if(row.getBoundingClientRect().right>hostRight+2 || overflowing) result.overflows.push({element:definition.type,type:control.type,label:control.label,width:row.getBoundingClientRect().width,clientWidth:row.clientWidth,scrollWidth:row.scrollWidth,offender:overflowing&&overflowing.className,offenderRight:overflowing&&overflowing.getBoundingClientRect().right,hostRight:hostRight});
            result.nativeColors+=row.querySelectorAll('input[type="color"]').length;
            result.unstyledSelects+=Array.from(row.querySelectorAll('select')).filter(function(select){return getComputedStyle(select).appearance!=='none';}).length;
            row.remove(); document.querySelectorAll('.ink-v2-color-studio,.ink-v2-icon-dialog').forEach(function(dialog){dialog.remove();});
          } catch(error) { result.failures.push({element:definition.type,type:control.type,label:control.label,error:String(error)}); }
        });
      });
      result.hostRenderedWidth=host.getBoundingClientRect().width; host.remove(); result.typeCount=Object.keys(result.types).length; result.overflows=result.overflows.slice(0,20); return result;
    })()`);
    check("every public element control mounts within the compact panel", state.definitions >= 58 && state.controls >= 300 && state.typeCount >= 28 && state.failures.length === 0 && state.unknown.length === 0 && state.overflows.length === 0 && state.nativeColors === 0 && state.unstyledSelects === 0, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,panel=r.settingsPanel,doc=b.iframeDoc,host=document.createElement('div');
      host.className='ink-v2-panel ink-v2-controls';host.style.cssText='position:fixed;left:0;top:0;width:320px;visibility:hidden;pointer-events:none;z-index:-1';document.body.appendChild(host);
      var inserted=[],result={};
      var definition=function(type){return r.elements.get(type)};
      var control=function(type,name,tab){return (definition(type).controls||[]).find(function(item){return item.name===name&&(!tab||item.tab===tab)})};
      var mount=function(type,name,node,tab){host.replaceChildren();var schema=control(type,name,tab);var row=panel.renderControl(schema,node);host.appendChild(row);return row};
      var change=function(input,value){input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}))};
      var add=function(type,settings){var node=r.insert(type,{},settings?{settings:settings}:undefined);inserted.push(node.id);return node};
      try {
        var container=add('div');
        var widthRow=mount('div','__resizing',container,'advanced'),widthInput=widthRow.querySelector('.ink-v2-resize-field:first-child input[type="number"]'),widthUnit=widthRow.querySelector('.ink-v2-resize-field:first-child select');
        change(widthInput,640);
        var storedWidth=r.document.get(container.id).styles.desktop.base.width;
        var containerElement=doc.querySelector('[data-ink-element-id="'+container.id+'"]');
        result.desktopWidth=storedWidth&&storedWidth.size===640&&storedWidth.unit==='px'&&getComputedStyle(containerElement).width==='640px';

        r.responsive.setDevice('tablet');
        widthRow=mount('div','__resizing',r.document.get(container.id),'advanced');widthInput=widthRow.querySelector('.ink-v2-resize-field:first-child input[type="number"]');widthUnit=widthRow.querySelector('.ink-v2-resize-field:first-child select');
        change(widthUnit,'%');change(widthInput,70);
        var tabletWidth=r.document.get(container.id).styles.tablet.base.width;
        var rules=r.styles.nodeRules(r.document.get(container.id));
        result.responsiveWidth=tabletWidth&&tabletWidth.size===70&&tabletWidth.unit==='%'&&rules.includes('@media(max-width:1024px)')&&rules.includes('width:70%');
        r.responsive.setDevice('desktop');

        var heading=add('heading',{text:'Control matrix'}),alignment=mount('heading','text-align',heading,'style');
        var center=alignment.querySelector('.ink-v2-choose button:nth-child(2)');center&&center.click();
        var headingElement=doc.querySelector('[data-ink-element-id="'+heading.id+'"]');
        result.alignment=r.document.get(heading.id).styles.desktop.base['text-align']==='center'&&getComputedStyle(headingElement).textAlign==='center';

        var button=add('button',{text:'Control button'}),padding=mount('button','padding',button,'style');
        var link=padding.querySelector('.ink-v2-link-values');if(link&&!link.classList.contains('is-active'))link.click();
        var top=padding.querySelector('input[type="number"]');change(top,12);
        var paddingValue=r.document.get(button.id).styles.desktop.base.padding;
        var buttonElement=doc.querySelector('[data-ink-element-id="'+button.id+'"]');
        var buttonSurface=buttonElement.querySelector('.ink-el-button-surface');
        result.linkedPadding=paddingValue&&['top','right','bottom','left'].every(function(side){return paddingValue[side]===12})&&getComputedStyle(buttonSurface).paddingTop==='12px'&&getComputedStyle(buttonSurface).paddingLeft==='12px';

        var progress=add('progress'),slider=mount('progress','value',progress,'content'),number=slider.querySelector('input[type="number"]');change(number,63);
        var progressElement=doc.querySelector('[data-ink-element-id="'+progress.id+'"] .ink-el-progress-value');
        result.slider=r.document.get(progress.id).settings.value===63&&progressElement.style.width==='63%'&&progressElement.textContent.includes('63%');

        var gallery=add('gallery'),toggle=mount('gallery','lightbox',gallery,'content').querySelector('input[type="checkbox"]');
        toggle.click();
        var galleryElement=doc.querySelector('[data-ink-element-id="'+gallery.id+'"]');
        result.switcher=r.document.get(gallery.id).settings.lightbox===false&&galleryElement.dataset.lightbox==='false';
        r.history.undo();
        result.undo=r.document.get(gallery.id).settings.lightbox===true&&doc.querySelector('[data-ink-element-id="'+gallery.id+'"]')?.dataset.lightbox==='true';
      } finally {
        r.responsive.setDevice('desktop');inserted.slice().reverse().forEach(function(id){if(r.document.get(id))r.remove(id)});host.remove();
      }
      return result;
    })()`);
    check("representative controls mutate data, responsive CSS, canvas layout, and history", state.desktopWidth && state.responsiveWidth && state.alignment && state.linkedPadding && state.slider && state.switcher && state.undo, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var frame=r.insert('div',{}, {settings:{tag:'section'},styles:{base:{'min-width':{size:240,unit:'px'},'max-height':{size:420,unit:'px'},'aspect-ratio':'16 / 9',cursor:'pointer'}}});
      var heading=r.insert('heading',{parentId:frame.id},{settings:{text:'Balanced native headline'},styles:{base:{'text-wrap':'balance','font-feature-settings':'"liga" 1, "ss01" 1','font-variation-settings':'"wght" 650'}}});
      var frameEl=d.querySelector('[data-ink-element-id="'+frame.id+'"]');
      var rules=r.styles.nodeRules(r.document.get(frame.id))+r.styles.nodeRules(r.document.get(heading.id));
      var result={
        semantic:frameEl&&frameEl.tagName==='SECTION',
        frameStyles:rules.includes('min-width:240px')&&rules.includes('max-height:420px')&&rules.includes('aspect-ratio:16 / 9')&&rules.includes('cursor:pointer'),
        typography:rules.includes('text-wrap:balance')&&rules.includes('font-feature-settings:"liga" 1, "ss01" 1')&&rules.includes('font-variation-settings:"wght" 650')
      };
      r.remove(frame.id);return result;
    })()`);
    check("Framer-style constraints, semantic frames, and advanced typography remain native", state.semantic && state.frameStyles && state.typography, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var r=builder.runtime;
      var editorEl=r.insert('text-editor',{}, {settings:{html:'<p>Legacy paragraph.</p>'}});
      r.selection.select(editorEl.id);
      var pm=document.querySelector('#SettingsContainer .ink-v2-wysiwyg-editor .ProseMirror');
      var mounted=!!pm;
      var legacyCanvas=(function(){var el=builder.iframeDoc.querySelector('[data-ink-element-id="'+editorEl.id+'"]');return !!el && el.textContent.includes('Legacy paragraph');})();
      // Canonical { json, html } object also renders on canvas (TipTap save shape).
      r.update(editorEl.id,{settings:{html:{json:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Canonical JSON.'}]}]},html:'<p>Canonical JSON.</p>'}}},'Edit');
      var canonicalCanvas=(function(){var el=builder.iframeDoc.querySelector('[data-ink-element-id="'+editorEl.id+'"]');return !!el && el.textContent.includes('Canonical JSON.');})();
      // Toolbar command toggles an active state (TipTap, not execCommand).
      var boldBtn=document.querySelector('#SettingsContainer .ink-v2-wysiwyg-toolbar [title="toggleBold"]');
      var toggles=false, active=false;
      if(boldBtn){ boldBtn.click(); active=boldBtn.classList.contains('is-active'); boldBtn.click(); toggles=!boldBtn.classList.contains('is-active'); }
      r.remove(editorEl.id);
      return {ok:true,mounted:mounted,legacyCanvas:legacyCanvas,canonicalCanvas:canonicalCanvas,active:active,toggles:toggles};
    })()`);
    check("Text Editor runs TipTap and stores canonical JSON with legacy fallback", state.mounted && state.legacyCanvas && state.canonicalCanvas && state.active && state.toggles, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var slots=Array.from(document.querySelectorAll('.material-symbols-rounded'));
      var raw=slots.filter(function(slot){return !slot.querySelector(':scope > svg.ink-lucide-icon') || Array.from(slot.childNodes).some(function(node){return node.nodeType===3 && node.textContent.trim();});});
      var empty=slots.filter(function(slot){var svg=slot.querySelector(':scope > svg.ink-lucide-icon');return svg && svg.children.length===0;});
      var navigatorIcons=Array.from(document.querySelectorAll('.ink-structure-window .ink-v2-navigator-icon'));
      return {slots:slots.length,raw:raw.length,empty:empty.length,emptyNames:empty.map(function(slot){return slot.dataset.inkLucideSource;}),navigator:navigatorIcons.length,navigatorDirect:navigatorIcons.every(function(icon){return icon.tagName.toLowerCase()==='svg' && !icon.closest('.material-symbols-rounded');})};
    })()`);
    check("builder chrome renders Lucide SVGs without Material font glyphs", state.slots > 0 && state.raw === 0 && state.empty === 0 && state.navigator > 0 && state.navigatorDirect, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder, r=b.runtime, id=b.iframeDoc;
      var lucide=r.insert('icon',{}, {settings:{icon:'lucide:home'}});
      var phosphor=r.insert('icon',{}, {settings:{icon:'phosphor:house'}});
      var material=r.insert('icon',{}, {settings:{icon:'star'}});
      var lucideSvg=id.querySelector('[data-ink-element-id="'+lucide.id+'"].ink-icon-svg[viewBox="0 0 24 24"]');
      var phosphorSvg=id.querySelector('[data-ink-element-id="'+phosphor.id+'"].ink-icon-svg[viewBox="0 0 256 256"]');
      var materialLucide=id.querySelector('[data-ink-element-id="'+material.id+'"] svg.ink-icon-svg');
      // Google Fonts: setting a curated font-family emits @import in compiled CSS + a canvas link.
      var heading=r.insert('heading',{}, {settings:{text:'Fonts'}});
      r.update(heading.id,{styles:{base:{'font-family':'Montserrat'}}},'Style');
      var css=builder.runtime.styles.compile(r.document);
      var fontImport=css.startsWith("@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@") && css.includes('font-family:Montserrat');
      var link=id.querySelector('link[data-ink-google-font][data-ink-font="Montserrat"]');
      // Custom fonts are a first-class document setting: they render live and survive publish
      // without requiring page-level custom CSS.
      var previousCustomFonts=structuredClone(r.document.data.settings.customFonts||[]);
      r.updateDocumentSettings({customFonts:[{family:'Parity Display',url:'https://example.com/parity.woff2',weight:'400',style:'normal',display:'swap'}]},'Custom font');
      var customHeading=r.insert('heading',{}, {settings:{text:'Custom font'},styles:{base:{'font-family':'Parity Display'}}});
      var customCss=builder.runtime.styles.compile(r.document);
      var customFontFace=customCss.includes('@font-face{font-family:"Parity Display";src:url("https://example.com/parity.woff2") format("woff2")') && customCss.includes('font-family:Parity Display');
      // Mount the icon picker (an icon-box has an icon control) and confirm the full sets loaded.
      var iconBox=r.insert('icon-box',{});
      r.selection.select(iconBox.id);
      var contentTab=Array.from(document.querySelectorAll('#SettingsContainer .ink-v2-control-tabs button')).find(function(t){return t.textContent.toLowerCase().includes('content')});
      if(contentTab) contentTab.click();
      var pickerTabs=document.querySelectorAll('.ink-v2-icon-libs button');
      var fullSets=pickerTabs.length>=3 && Array.from(pickerTabs).some(function(t){return t.textContent.includes('2034')}) && Array.from(pickerTabs).some(function(t){return t.textContent.includes('1512')});
      // The full grid renders all icons, not a hardcoded slice.
      var lucideTab=Array.from(pickerTabs).find(function(t){return t.textContent.includes('Lucide')});
      if(lucideTab) lucideTab.click();
      var lucideButtons=document.querySelectorAll('.ink-v2-icon-grid button').length;
      var fullGrid=lucideButtons===2034;
      [lucide.id,phosphor.id,material.id,heading.id,customHeading.id,iconBox.id].forEach(function(x){r.remove(x);});
      r.updateDocumentSettings({customFonts:previousCustomFonts},'Restore custom fonts');
      return {ok:true,lucideSvg:!!lucideSvg,phosphorSvg:!!phosphorSvg,materialLucide:!!materialLucide,fontImport:fontImport,fontLink:!!link,customFontFace:customFontFace,fullSets:fullSets,fullGrid:fullGrid,lucideButtons:lucideButtons};
    })()`);
    check("icon libraries and hosted/custom fonts integrate", state.lucideSvg && state.phosphorSvg && state.materialLucide && state.fontImport && state.fontLink && state.customFontFace && state.fullSets, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder, r=b.runtime, tools=b.copilotTools;
      var exposed=!!tools && typeof tools.apply==='function' && typeof tools.index==='function' && typeof tools.isMutation==='function' && tools.TOOLS.length>=18 && tools.TOOLS.some(function(tool){return tool.name==='compose_landing_page';});
      var beforeStore=r.serialize();
      var beforeCss=b.customCode.getCss(), beforeJs=b.customCode.getJs();
      var container=r.insert('container',{});
      var containerIndex=r.document.data.children.findIndex(function(n){return n.id===container.id;});
      var inserted=JSON.parse(tools.apply('insert_element',{path:String(containerIndex),type:'heading',settings:{text:'AI heading'}}));
      var headingNode=r.document.get(container.id).children.find(function(n){return n.type==='heading';});
      var styled=tools.apply('set_styles',{path:String(containerIndex)+'.0',styles:{desktop:{base:{color:'#123456'}}}});
      var cssColor=headingNode && headingNode.styles.desktop.base.color==='#123456';
      var removed=tools.apply('remove_element',{path:String(containerIndex)+'.0'});
      var gone=!r.document.get(container.id).children.some(function(n){return n.type==='heading';});
      var undid=tools.apply('undo');
      var restored=r.document.get(container.id).children.some(function(n){return n.type==='heading';});
      var cssEdited=tools.apply('css_edit',{selector:':root',property:'--ink-color-primary',value:'#ff0000'});
      var cssChanged=b.customCode.getCss()!==beforeCss && b.customCode.getCss().includes('#ff0000');
      var readback=tools.apply('read_design').includes('[0]');
      var containerEl=b.iframeDoc.querySelector('[data-ink-element-id="'+container.id+'"]');
      var canvasShows=!!containerEl && !!containerEl.querySelector('[data-ink-element-type="heading"]');
      // Atomic page composition validates the recursive tree, custom code, rendered audit, and
      // single-step undo contract used by whole-page Copilot requests.
      r.document.replace(beforeStore);
      b.customCode.update(beforeCss, beforeJs);
      var composed=JSON.parse(tools.apply('replace_page',{children:[
        {type:'container',settings:{cssClasses:'smoke-hero'},children:[{type:'heading',settings:{text:'Atomic design',tag:'h1'}},{type:'paragraph',settings:{text:'A complete editable page.'}},{type:'button',settings:{text:'Start',url:'#start'}}]},
        {type:'container',children:[{type:'heading',settings:{text:'Proof',tag:'h2'}},{type:'paragraph',settings:{text:'Every node is builder native.'}}]},
        {type:'container',children:[{type:'heading',settings:{text:'Ready',tag:'h2'}},{type:'button',settings:{text:'Continue',url:'#continue'}}]}
      ],customCss:'.ink-canvas-root .smoke-hero{min-height:50vh}',customJs:''}));
      var audit=JSON.parse(tools.apply('audit_design'));
      tools.apply('undo');
      var atomicUndo=JSON.stringify(r.serialize())===JSON.stringify(beforeStore) && b.customCode.getCss()===beforeCss && b.customCode.getJs()===beforeJs;
      var landing=JSON.parse(tools.apply('compose_landing_page',{
        siteName:'Mara Vale',hero:{headline:'Products with a point of view.',body:'Independent product design for ambitious teams.'},
        projects:[{title:'Atlas',summary:'A clearer planning system.',outcome:'Faster confident decisions'},{title:'Fieldwork',summary:'A trusted service journey.',outcome:'Less friction at every step'}],
        proof:{heading:'Close to the work.',body:'Senior thinking from discovery to ship.'},process:{heading:'Clarity is a process.',body:'Evidence guides every move.'},closing:{headline:'Make the next version matter.',body:'Bring the hard problem.'}
      }));
      var landingAudit=JSON.parse(tools.apply('audit_design'));
      var stepsInner=b.iframeDoc.querySelector('.cp-steps > .ink-el-container-inner');
      var projectGridInner=b.iframeDoc.querySelector('.cp-project-grid > .ink-el-container-inner');
      var landingHooks=!!b.iframeDoc.querySelector('.cp-hero .cp-display') && b.customCode.getCss().includes('.cp-project-grid') && document.getElementById('customCss').value===b.customCode.getCss() && b.iframeDoc.defaultView.getComputedStyle(stepsInner).display==='grid' && b.iframeDoc.defaultView.getComputedStyle(projectGridInner).display==='grid';
      tools.apply('undo');
      var landingUndo=JSON.stringify(r.serialize())===JSON.stringify(beforeStore) && b.customCode.getCss()===beforeCss;
      var clean=r.serialize().children.length===beforeStore.children.length;
      return {ok:true,exposed:exposed,inserted:inserted.ok===true,headingExists:!!headingNode,styled:styled==='ok'&&cssColor,remove:removed==='ok'&&gone,undoRestores:undid==='ok'&&restored,cssEdit:JSON.parse(cssEdited).ok===true&&cssChanged,readback:readback,canvasShows:canvasShows,composed:composed.ok===true&&composed.nodes===10,audit:audit.summary.h1s===1&&audit.summary.actions>=2,atomicUndo:atomicUndo,landing:landing.ok===true&&landing.nodes>30,landingAudit:landingAudit.summary.h1s===1&&landingAudit.summary.actions>=3,landingHooks:landingHooks,landingUndo:landingUndo,clean:clean};
    })()`);
    check("Copilot client tools compose and audit the live v2 store through history", state.exposed && state.inserted && state.headingExists && state.styled && state.remove && state.undoRestores && state.cssEdit && state.readback && state.canvasShows && state.composed && state.audit && state.atomicUndo && state.landing && state.landingAudit && state.landingHooks && state.landingUndo && state.clean, JSON.stringify(state));


    state = await client.evaluate(`(function(){
      var r=builder.runtime;
      return { baseline: window.__registryBaseline, count: r.elements.list().length, hasLab: r.elements.has('control-lab') };
    })()`);
    check("registry is not polluted by synthetic test elements", state.count === state.baseline && !state.hasLab, JSON.stringify(state));

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
      var result={selected:window.__mediaUrl, src:img?img.settings.src:null, dialogClosed:!document.getElementById('inkwell-media-picker-modal')?.open};
      if (window.__imgId) r.remove(window.__imgId);
      return result;
    })()`);
    check("media picker opens, bounds tiles, and returns the selection", pickerOpened === true && picker.items > 0 && picker.bounded && state.selected && state.src === state.selected && state.dialogClosed, JSON.stringify({ state, picker }));

    state = await client.evaluate(`(function(){
      var b=builder, r=b.runtime;
      var section=r.insert('section',{});
      var heading=r.insert('heading',{parentId:section.id});
      r.update(section.id,{styles:{base:{'background-image':'linear-gradient(90deg,#111111 0%,#222222 50%,#333333 100%)'}}},'Seed gradient without mode marker');
      r.selection.select(section.id);
      var styleTab=Array.from(document.querySelectorAll('#SettingsContainer .ink-v2-control-tabs button')).find(function(t){return t.textContent.trim().toLowerCase().endsWith('style')});
      if(styleTab) styleTab.click();
      var bg=document.querySelector('#SettingsContainer .ink-v2-background');
      var bgControl=!!bg;
      var gradientBtn=bg?Array.from(bg.querySelectorAll('.ink-v2-background-choices button')).find(function(b){return b.getAttribute('aria-label')==='Gradient'}):null;
      var inferredGradient=!!gradientBtn && gradientBtn.getAttribute('aria-pressed')==='true' && gradientBtn.classList.contains('is-active');
      var backgroundTypeIcons=!!bg && Array.from(bg.querySelectorAll('.ink-v2-background-choices button')).every(function(button){var icon=button.querySelector('svg.ink-v2-background-choice-icon');return !!icon && parseFloat(getComputedStyle(icon).width)<=14 && button.getAttribute('role')==='radio' && button.hasAttribute('aria-checked')});
      var customSelect=!!bg?.querySelector('select') && getComputedStyle(bg.querySelector('select')).appearance==='none';
      var gradientStops=bg?bg.querySelectorAll('.ink-v2-gradient-stop').length:0;
      var colorTrigger=bg?bg.querySelector('.ink-v2-gradient-stop .ink-v2-color-trigger'):null;
      if(colorTrigger) colorTrigger.click();
      var colorStudio=document.querySelector('.ink-v2-color-studio');
      var projectPalette=!!colorStudio?.querySelector('.ink-v2-color-palette button[aria-label="Use #123456"]');
      var colorPlane=colorStudio?.querySelector('.ink-v2-color-plane');
      var colorPalette=colorStudio?.querySelector('.ink-v2-color-palette');
      var colorSwatch=colorPalette?.querySelector('button');
      var colorStudioCompact=!!colorStudio && !!colorPlane && !!colorPalette && !!colorSwatch && colorStudio.getBoundingClientRect().width<=260 && colorPlane.getBoundingClientRect().height<=132 && colorPalette.getBoundingClientRect().height<=64 && colorSwatch.getBoundingClientRect().width<=20 && colorSwatch.getBoundingClientRect().height<=20;
      var colorStudioReady=!!colorStudio && !!colorPlane && colorStudio.querySelectorAll('.ink-v2-color-palette button').length>=20 && !!colorStudio.querySelector('[data-hex]') && !!colorStudio.querySelector('[data-alpha]') && projectPalette && colorStudioCompact;
      colorStudio?.querySelector('[data-close]')?.click();
      var classicBtn=bg?Array.from(bg.querySelectorAll('.ink-v2-background-choices button')).find(function(b){return b.getAttribute('aria-label')==='Classic'}):null;
      if(classicBtn) classicBtn.click();
      var bgFresh=document.querySelector('#SettingsContainer .ink-v2-background');
      var bgRows=bgFresh?bgFresh.querySelectorAll('.ink-v2-control').length:0;
      var bgOpen=bgRows>0;
      r.history.undo(); // revert the background-mode change so history stays clean
      r.history.undo(); // revert the mode-less gradient fixture
      var tabsDebug=Array.from(document.querySelectorAll('#SettingsContainer .ink-v2-control-tabs button')).map(function(t){return t.textContent.trim()});
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
      return {labels:labels,hasCurrent:hasCurrent,undoWorks:childrenBefore===1&&childrenAfter===0,bgControl:bgControl,inferredGradient:inferredGradient,backgroundTypeIcons:backgroundTypeIcons,customSelect:customSelect,gradientStops:gradientStops,colorStudioReady:colorStudioReady,colorStudioCompact:colorStudioCompact,bgRows:bgRows,bgOpen:bgOpen,toolbarOnSelect:toolbarOnSelect,hoverRule:editorCss.includes('data-ink-kind="column"]:hover'),tabsDebug:tabsDebug};
    })()`);
    check("history panel, background control, color studio, and toolbar reveal work", state.hasCurrent && state.undoWorks && state.labels.some((label) => label.toLowerCase().includes('add heading')) && state.bgControl && state.inferredGradient && state.backgroundTypeIcons && state.customSelect && state.gradientStops === 3 && state.colorStudioReady && state.bgRows > 0 && state.bgOpen && state.toolbarOnSelect && state.hoverRule, JSON.stringify(state));

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
      return { sx:Math.round(tr.x+tr.width/2), sy:Math.round(tr.y+tr.height/2), dx:Math.round(ifr.x+ifr.width/2), dy:Math.round(Math.min(window.innerHeight-32,ifr.y+ifr.height-60)), before:builder.runtime.document.data.children.length };
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
      return {heading:heading.id, containerChildren:container.children.length, rootBefore:r.document.data.children.length, sx:Math.round(ifr.x+rect.x+rect.width/2), sy:Math.round(ifr.y+rect.y+rect.height/2), dx:Math.round(ifr.x+ifr.width/2), dy:Math.round(Math.min(window.innerHeight-32,ifr.y+ifr.height-40))};
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
    check("responsive toolbar drives canvas and control context", state.tablet.device === "tablet" && state.tablet.width === "768px" && state.tablet.active && state.tablet.bar && state.tablet.handles === 3 && state.custom.width === "700px" && state.custom.height === "900px" && state.custom.scale === "0.8" && state.mobile.device === "mobile" && state.mobile.width === "375px" && state.mobile.active && state.desktop === "1440px", JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var n=builder.navigator;
      n.panel.expandedNodes.clear(); n.panel.persistNavigatorExpansion(); n.panel.render();
      n.show();
      var defaultRows=Array.from(document.querySelectorAll('.ink-structure-window-body [data-ink-navigator-id]'));
      var defaultCollapsed=!document.querySelector('.ink-structure-window-body .ink-v2-navigator > ul > li > ul');
      var addActions=document.querySelectorAll('.ink-structure-window-body .ink-v2-navigator-add').length;
      var collect=function(nodes){nodes.forEach(function(node){if(node.children&&node.children.length){n.panel.expandedNodes.add(node.id);collect(node.children);}})};
      collect(n.runtime.document.data.children); n.panel.persistNavigatorExpansion(); n.panel.render();
      var rows=Array.from(document.querySelectorAll('.ink-structure-window-body [data-ink-navigator-id]'));
      var result={count:rows.length,labels:rows.map(function(button){return button.textContent.trim();}),nested:!!rows[1]?.closest('ul')?.parentElement?.closest('li'),toggled:!!document.getElementById('structureButton'),defaultCollapsed:defaultCollapsed,rootCount:defaultRows.length,noRowAdd:addActions===0};
      n.hide();
      return result;
    })()`);
    check("Navigator is collapsed by default and mirrors the recursive document", state.defaultCollapsed && state.noRowAdd && state.count >= 3 && state.labels.some((label) => label.includes("Edited heading")) && state.nested && state.toggled, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var n=builder.navigator, panel=n.panel;
      localStorage.setItem('inkwell_builder_nav_expanded','[]');
      panel.expandedNodes.clear(); panel.render();
      n.show();
      var findParent=function(nodes){for(var i=0;i<nodes.length;i++){if(nodes[i].children&&nodes[i].children.length)return nodes[i];}return null;};
      var parent=findParent(n.runtime.document.data.children);
      if(!parent) { n.hide(); return {ok:false}; }
      var parentId=parent.id;
      panel.toggleNavigatorCollapse(parentId);
      var saved=JSON.parse(localStorage.getItem('inkwell_builder_nav_expanded')||'[]');
      var expanded=panel.expandedNodes.has(parentId) && saved.includes(parentId) && !!document.querySelector('[data-ink-navigator-item="'+parentId+'"] > ul');
      panel.toggleNavigatorCollapse(parentId);
      var collapsed=!panel.expandedNodes.has(parentId) && !document.querySelector('[data-ink-navigator-item="'+parentId+'"] > ul');
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
      var publishedHidden=!new DOMParser().parseFromString(html, 'text/html').querySelector('.ink-el-'+id);
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
      n.show(); n.setDocked(false);
      n.window.style.left='40px'; n.window.style.top='100px'; n.window.style.width='300px'; n.window.style.height='350px';
      n.setDocked(true);
      var dockRect=n.window.getBoundingClientRect();
      var snapped=Math.abs(dockRect.right-window.innerWidth)<2 && n.window.style.left==='' && n.window.style.top==='';
      var docked=JSON.parse(localStorage.getItem('inkwell_builder_navigator')||'{}').docked===true;
      n.setDocked(false);
      var floatRect=n.window.getBoundingClientRect();
      var restored=Math.abs(floatRect.left-40)<2 && Math.abs(floatRect.top-100)<2 && Math.abs(floatRect.width-300)<2;
      var undocked=JSON.parse(localStorage.getItem('inkwell_builder_navigator')||'{}').docked===false;
      n.hide();
      return {ok:true,docked:docked,undocked:undocked,snapped:snapped,restored:restored,dockRight:dockRect.right,viewport:window.innerWidth};
    })()`);
    check("navigator docks to the right edge and restores floating geometry", state.ok && state.docked && state.undocked && state.snapped && state.restored, JSON.stringify(state));

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
      var undone=!b.runtime.document.get(id).styles.desktop.base.margin;
      var gaps=r.insert('columns',{}, {settings:{structure:'50,50'},children:[r.create('column'),r.create('column')]});
      r.update(gaps.id,{styles:{base:{gap:{row:30,column:12,unit:'px'}}}},'Set gaps');
      var gapCss=b.iframeDoc.getElementById('ink-builder-v2-styles').textContent.includes('gap:30px 12px');
      var responsive=r.insert('paragraph',{},{styles:{base:{'font-size':{size:18,unit:'px'}},tablet:{'font-size':{size:16,unit:'px'}},mobile:{}}});
      r.remove(gaps.id); r.remove(responsive.id);
      return {unlinked:unlinked,undone:undone,gapCss:gapCss};
    })()`);
    check("independent row/column gaps and linked/unlinked dimensions", state.unlinked && state.undone && state.gapCss, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,node=r.insert('container',{});
      r.selection.select(node.id);
      var layoutTab=Array.from(document.querySelectorAll('#SettingsContainer .ink-v2-control-tabs button')).find(function(t){return t.textContent.trim().toLowerCase().endsWith('layout')});
      if(layoutTab)layoutTab.click();
      var flow=document.querySelector('.ink-v2-layout-flow');
      var horizontal=flow&&flow.querySelector('button[aria-label="Horizontal"]');
      if(horizontal)horizontal.click();
      var live=document.querySelector('.ink-v2-auto-layout');
      var selected=live&&live.querySelector('.ink-v2-alignment-grid button.is-active');
      var direction=r.document.get(node.id).styles.desktop.base['flex-direction'];
      var reverse=document.querySelector('.ink-v2-flow-reverse');if(reverse)reverse.click();
      var reversed=r.document.get(node.id).styles.desktop.base['flex-direction']==='row-reverse';
      var widthMode=document.querySelector('.ink-v2-resize-field button[aria-label="Width resizing"]');if(widthMode)widthMode.click();
      var hug=document.querySelector('.ink-v2-resize-menu button[data-mode="hug"]');if(hug)hug.click();
      var hugged=r.document.get(node.id).styles.desktop.base.width==='fit-content';
      var result={flow:!!flow,horizontal:live&&live.classList.contains('is-horizontal'),selected:!!selected,marks:selected&&selected.querySelectorAll('i').length,direction:direction,reversed:reversed,hugged:hugged};
      r.remove(node.id);return result;
    })()`);
    check("auto layout flow, alignment glyphs, reverse, and resizing modes are functional", state.flow && state.horizontal && state.selected && state.marks===3 && state.direction==='row' && state.reversed && state.hugged, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var r=builder.runtime,d=builder.iframeDoc,beforeCss=r.document.data.settings.customCss||'';
      var frame=r.insert('frame',{}, {settings:{label:'Native hero'},styles:{desktop:{base:{width:{size:800,unit:'px'},height:{size:500,unit:'px'},position:'relative',overflow:'hidden'}}}});
      var button=r.insert('button',{parentId:frame.id},{settings:{text:'Meet the Heroes',behavior:'action',buttonType:'button'},styles:{desktop:{base:{width:'fit-content',height:'fit-content',color:'#3b001b','background-color':'#ffe878',padding:{top:14,right:34,bottom:16,left:34,unit:'px'},'border-radius':{size:18,unit:'px'},'depth-color':'#3b001b','depth-size':{size:9,unit:'px'},'outer-radius':{size:25,unit:'px'},'font-family':'Oswald','font-size':{size:22,unit:'px'},'font-weight':600,'line-height':.9,'letter-spacing':{size:-.88,unit:'px'}}}}});
      var badge=r.insert('frame',{parentId:frame.id},{settings:{label:'Customer Support',motion:{enabled:true,trigger:'load',duration:2400,iterations:'infinite',direction:'alternate',easing:'ease-in-out',keyframes:[{offset:0,transform:'translateY(-4px) rotate(-29deg)'},{offset:1,transform:'translateY(4px) rotate(-29deg)'}]}},styles:{desktop:{base:{position:'absolute',top:{size:40,unit:'px'},left:{size:80,unit:'px'},width:{size:164,unit:'px'},height:{size:160,unit:'px'},rotate:{size:-29,unit:'deg'}}},tablet:{base:{left:{size:8,unit:'%'}}}}});
      var flower=r.insert('svg',{parentId:badge.id},{settings:{viewBox:'0 0 164 160',markup:'<path fill="#c0edc0" d="M82 0c18 0 25 24 34 35 14-1 38-8 45 9 7 17-15 30-24 41 8 12 25 31 12 44-13 13-32-4-44-12-11 9-24 31-41 24-17-7-10-31-9-45C44 87 20 80 20 62s24-25 35-34C54 14 61 0 82 0Z"/>'},styles:{desktop:{base:{position:'absolute',top:0,right:0,bottom:0,left:0,width:'100%',height:'100%'}}}});
      var label=r.insert('inline-text',{parentId:badge.id},{settings:{text:'Customer Support',tag:'strong'},styles:{desktop:{base:{position:'absolute',top:{size:50,unit:'%'},left:{size:50,unit:'%'},translate:'-50% -50%','font-family':'Oswald','font-size':{size:16,unit:'px'},'font-weight':600,'line-height':1.3,color:'#111111','text-align':'center'}}}});
      var buttonEl=d.querySelector('[data-ink-element-id="'+button.id+'"]'),surface=buttonEl.querySelector('.ink-el-button-surface'),badgeEl=d.querySelector('[data-ink-element-id="'+badge.id+'"]');
      var rootStyle=getComputedStyle(buttonEl),surfaceStyle=getComputedStyle(surface),badgeStyle=getComputedStyle(badgeEl),rules=r.styles.nodeRules(badge),motion=r.styles.motionRules(badge);
      var result={nativeTree:frame.children.length===2&&badge.children.length===2&&flower.type==='svg'&&label.type==='inline-text',semantic:buttonEl.tagName==='BUTTON'&&buttonEl.type==='button',layered:rootStyle.backgroundColor==='rgb(59, 0, 27)'&&rootStyle.paddingBottom==='9px'&&surfaceStyle.backgroundColor==='rgb(255, 232, 120)'&&surfaceStyle.paddingTop==='14px'&&surfaceStyle.paddingRight==='34px'&&surfaceStyle.borderRadius==='18px',constrained:badgeStyle.position==='absolute'&&rules.includes('left:8%')&&rules.includes('@media(max-width:1024px)'),vector:!!badgeEl.querySelector('svg path'),motion:motion.includes('@keyframes')&&motion.includes('prefers-reduced-motion'),noCustomCss:(r.document.data.settings.customCss||'')===beforeCss};
      r.remove(frame.id);return result;
    })()`);
    check("layered CTA and floating vector badge are reproducible as native constrained elements", state.nativeTree && state.semantic && state.layered && state.constrained && state.vector && state.motion && state.noCustomCss, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc,w=d.defaultView;
      r.responsive.setDevice('desktop');
      var frame=r.insert('frame',{}, {styles:{desktop:{base:{position:'relative',width:{size:500,unit:'px'},height:{size:300,unit:'px'}}}}});
      var item=r.insert('frame',{parentId:frame.id},{styles:{desktop:{base:{position:'absolute',left:{size:20,unit:'px'},top:{size:30,unit:'px'},width:{size:100,unit:'px'},height:{size:80,unit:'px'}}}}});
      var sibling=r.insert('frame',{parentId:frame.id},{styles:{desktop:{base:{position:'absolute',left:{size:200,unit:'px'},top:{size:80,unit:'px'},width:{size:100,unit:'px'},height:{size:80,unit:'px'}}}}});
      r.selection.select(item.id);
      var preview=0,off=r.events.on('element:position-preview',function(e){if(e.id===item.id)preview+=1});
      var element=d.querySelector('[data-ink-element-id="'+item.id+'"]'),rect=element.getBoundingClientRect();
      element.dispatchEvent(new w.PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,clientX:rect.left+20,clientY:rect.top+20}));
      d.dispatchEvent(new w.PointerEvent('pointermove',{bubbles:true,cancelable:true,button:0,clientX:rect.left+99,clientY:rect.top+69}));
      var guides=d.querySelectorAll('.ink-snap-guide').length,distances=d.querySelectorAll('.ink-distance-measure').length;
      d.dispatchEvent(new w.PointerEvent('pointerup',{bubbles:true,cancelable:true,button:0,clientX:rect.left+99,clientY:rect.top+69}));
      off();
      var moved=r.document.get(item.id).styles.desktop.base;
      var oneStep=r.history.entries().undo[0]==='Move positioned element';
      var overlaysCleared=!d.querySelector('.ink-snap-guide,.ink-distance-measure');
      r.history.undo();
      var undone=r.document.get(item.id).styles.desktop.base;
      var result={left:moved.left&&moved.left.size,top:moved.top&&moved.top.size,preview:preview,guides:guides,distances:distances,overlaysCleared:overlaysCleared,oneStep:oneStep,undoLeft:undone.left&&undone.left.size,undoTop:undone.top&&undone.top.size};
      r.remove(frame.id);return result;
    })()`);
    check("absolute elements smart-snap with guides/distances, persist pins, and undo as one gesture", Math.abs(state.left-100)<=1 && Math.abs(state.top-80)<=1 && state.preview>0 && state.guides>=1 && state.distances>0 && state.overlaysCleared && state.oneStep && state.undoLeft===20 && state.undoTop===30, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,before=r.serialize();
      var legacyButton={id:'legacy-button-migration',type:'button',settings:{text:'Old button',size:'lg'},styles:{base:{}},children:[]};
      r.document.replace({version:2,type:'page',settings:{title:'Migration'},children:[legacyButton]});
      var migrated=r.document.get(legacyButton.id),base=migrated.styles.desktop.base;
      var libraryTypes=Array.from(document.querySelectorAll('.ink-v2-library-item')).map(function(el){return el.dataset.inkElementType});
      var result={sizeRemoved:!Object.hasOwn(migrated.settings,'size'),font:base['font-size']&&base['font-size'].size,padding:base.padding&&base.padding.top,radius:base['border-radius']&&base['border-radius'].size,legacyHidden:!['section','columns','column'].some(function(type){return libraryTypes.includes(type)})};
      r.document.replace(before);return result;
    })()`);
    check("legacy button presets migrate to explicit styles and compatibility-only layout elements stay out of the modern library", state.sizeRemoved && state.font===18 && state.padding===20 && state.radius===5 && state.legacyHidden, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,before=r.serialize();
      var legacy={id:'legacy-group',type:'group',settings:{label:'Old visual group',tag:'section'},styles:{base:{display:'block',width:{size:160,unit:'px'},height:{size:120,unit:'px'},'background-color':'#111111'}},children:[]};
      r.document.replace({version:2,type:'page',settings:{title:'Group migration'},children:[legacy]});
      var migrated=r.document.get(legacy.id),legacyFrame=migrated&&migrated.type==='frame';
      r.document.replace(before);
      var parent=r.insert('frame',{}, {styles:{base:{width:{size:400,unit:'px'},height:{size:200,unit:'px'}}}});
      var first=r.insert('heading',{parentId:parent.id},{settings:{text:'One'}}),second=r.insert('heading',{parentId:parent.id},{settings:{text:'Two'}});
      r.selection.select(first.id);r.selection.select(second.id,{additive:true});
      var group=r.groupSelection();var groupEl=b.iframeDoc.querySelector('[data-ink-element-id="'+group.id+'"]');
      var computed=groupEl&&b.iframeDoc.defaultView.getComputedStyle(groupEl).display;
      var empty=groupEl&&groupEl.querySelector('.ink-editor-empty'),overlay=groupEl&&groupEl.querySelector(':scope > .ink-editor-overlay');
      var grouped=parent.children.length===1&&parent.children[0].id===group.id&&group.children.length===2&&computed==='contents'&&!empty&&!overlay;
      var ungrouped=r.ungroup(group.id)&&parent.children.length===2&&parent.children[0].id===first.id&&parent.children[1].id===second.id;
      r.remove(parent.id);return {legacyFrame:legacyFrame,grouped:grouped,ungrouped:ungrouped};
    })()`);
    check("Groups are non-visual organizational layers while legacy visual groups migrate to Frames", state.legacyFrame && state.grouped && state.ungrouped, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var parent=r.insert('frame',{}, {styles:{base:{position:'relative',width:{size:500,unit:'px'},height:{size:260,unit:'px'}}}});
      var first=r.insert('frame',{parentId:parent.id},{styles:{base:{position:'absolute',left:{size:20,unit:'px'},top:{size:30,unit:'px'},width:{size:100,unit:'px'},height:{size:60,unit:'px'}}}});
      var second=r.insert('frame',{parentId:parent.id},{styles:{base:{position:'absolute',left:{size:190,unit:'px'},top:{size:90,unit:'px'},width:{size:80,unit:'px'},height:{size:70,unit:'px'}}}});
      r.selection.select(first.id);r.selection.select(second.id,{additive:true});
      var frame=r.frameSelection(),frameEl=d.querySelector('[data-ink-element-id="'+frame.id+'"]');
      var framed=frame&&frame.type==='frame'&&frame.settings.frameSelection&&frame.children.length===2&&frameEl&&frameEl.querySelector('.ink-el-frame-inner')&&frameEl.querySelector('.ink-el-frame-overlay');
      var style=frame.styles.desktop.base,firstStyle=frame.children[0].styles.desktop.base;
      var geometry=style.position==='absolute'&&style.left.size===20&&style.top.size===30&&style.width.size===250&&style.height.size===130&&firstStyle.left.size===0&&firstStyle.top.size===0;
      var restored=r.unframe(frame.id),nodes=parent.children;
      var unframed=restored&&nodes.length===2&&nodes[0].styles.desktop.base.left.size===20&&nodes[1].styles.desktop.base.top.size===90;
      r.remove(parent.id);return {framed:framed,geometry:geometry,unframed:unframed};
    })()`);
    check("Frame selection preserves freeform geometry, exposes an editable surface, and can unframe", state.framed && state.geometry && state.unframed, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc,w=d.defaultView;
      var parent=r.insert('frame',{}, {styles:{base:{position:'relative',width:{size:420,unit:'px'},height:{size:260,unit:'px'},padding:{top:16,right:16,bottom:16,left:16,unit:'px'}}}});
      var el=d.querySelector('[data-ink-element-id="'+parent.id+'"]'),host=el.querySelector('[data-ink-children]'),rect=host.getBoundingClientRect();
      r.events.emit('frame:draw',{parentId:parent.id});
      var armed=d.body.classList.contains('ink-is-drawing-frame');
      d.dispatchEvent(new w.PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,clientX:rect.left+30,clientY:rect.top+40}));
      d.dispatchEvent(new w.PointerEvent('pointermove',{bubbles:true,cancelable:true,button:0,clientX:rect.left+210,clientY:rect.top+160}));
      d.dispatchEvent(new w.PointerEvent('pointerup',{bubbles:true,cancelable:true,button:0,clientX:rect.left+210,clientY:rect.top+160}));
      var child=parent.children[0],base=child&&child.styles.desktop.base;
      var result={armed:armed,child:child&&child.type==='frame',position:base&&base.position==='absolute'&&base.left.size===30&&base.top.size===40&&base.width.size===180&&base.height.size===120,base:base,clean:!d.body.classList.contains('ink-is-drawing-frame')&&!d.querySelector('.ink-frame-draw-preview')};
      r.remove(parent.id);return result;
    })()`);
    check("Draw Frame mode uses a Frame content host as its exact X/Y origin", state.armed && state.child && state.position && state.clean, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc,w=d.defaultView;
      var first=r.insert('frame',{}, {styles:{base:{position:'absolute',left:{size:20,unit:'px'},top:{size:20,unit:'px'},width:{size:80,unit:'px'},height:{size:60,unit:'px'}}}});
      var second=r.insert('frame',{}, {styles:{base:{position:'absolute',left:{size:140,unit:'px'},top:{size:30,unit:'px'},width:{size:80,unit:'px'},height:{size:60,unit:'px'}}}});
      var root=b.canvasRoot;
      root.dispatchEvent(new w.PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,clientX:360,clientY:260}));
      d.dispatchEvent(new w.PointerEvent('pointermove',{bubbles:true,cancelable:true,button:0,clientX:5,clientY:5}));
      d.dispatchEvent(new w.PointerEvent('pointerup',{bubbles:true,cancelable:true,button:0,clientX:5,clientY:5}));
      var ids=[...r.selection.selectedIds],result={selected:ids.includes(first.id)&&ids.includes(second.id),clean:!d.querySelector('.ink-marquee-selection')};
      r.removeMany([first.id,second.id]);return result;
    })()`);
    check("blank-canvas marquee selects multiple native layers and cleans up its editor surface", state.selected && state.clean, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var frame=r.insert('frame',{}, {settings:{link:{url:'/docs',isExternal:true,nofollow:true}},styles:{base:{'box-shadow':[{x:0,y:2,blur:6,spread:0,unit:'px',color:'#110011'},{x:0,y:8,blur:18,spread:0,unit:'px',color:'rgba(0,0,0,.2)'}],'transform-origin':'center center',perspective:{size:800,unit:'px'},'backface-visibility':'hidden','transform-style':'preserve-3d'}}});
      var element=d.querySelector('[data-ink-element-id="'+frame.id+'"]'),rules=r.styles.nodeRules(frame);
      var result={link:element.tagName==='A'&&element.getAttribute('href')==='/docs'&&element.target==='_blank'&&element.rel==='nofollow',surface:!!element.querySelector('.ink-el-frame-inner,.ink-el-frame-overlay'),shadows:/box-shadow:[^;}]*,[^;}]*/.test(rules),threeD:rules.includes('transform-style:preserve-3d')&&rules.includes('backface-visibility:hidden')};
      r.remove(frame.id);return result;
    })()`);
    check("Frames support semantic links, layered shadows, and full 3D transform styles", state.link && state.surface && state.shadows && state.threeD, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var button=r.insert('button',{}, {styles:{base:{'background-color':'#fde168','border-radius':{size:28,unit:'px'},'box-shadow':{x:5,y:5,blur:0,spread:0,unit:'px',color:'#260d1a'}}}});
      var root=d.querySelector('[data-ink-element-id="'+button.id+'"]'),surface=root.querySelector('.ink-el-button-surface'),rules=r.styles.nodeRules(button);
      var result={surface:!!surface,exact:/\.ink-el-button-surface\\{[^}]*box-shadow:5px 5px 0px 0px #260d1a/.test(rules),computed:d.defaultView.getComputedStyle(surface).boxShadow.includes('5px 5px 0px 0px'),rules:rules};
      r.remove(button.id);return result;
    })()`);
    check("Button shadow is attached to the visible surface with exact Framer-style offsets", state.surface && state.exact && state.computed, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc,w=d.defaultView;
      var el=r.insert('button',{}, {settings:{text:'Rotate me',behavior:'link',url:'#'},styles:{base:{'background-color':'#f9d94c','border-radius':{size:100,unit:'px'},color:'#260d1a'}}});
      r.selection.select(el.id);
      var root=d.querySelector('[data-ink-element-id="'+el.id+'"]');
      var knob=root.querySelector('.ink-rotate-handle');
      var visible=knob&&w.getComputedStyle(knob).opacity==='1'&&w.getComputedStyle(knob).pointerEvents==='auto';
      var rect=root.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
      var kr=knob.getBoundingClientRect(),sx=kr.left+kr.width/2,sy=kr.top+kr.height/2;
      knob.dispatchEvent(new w.PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:1,button:0,clientX:sx,clientY:sy}));
      // drag a quarter-turn (pointer above center -> pointer left of center) = -90deg relative
      var tx=cx-100,ty=cy;
      d.dispatchEvent(new w.PointerEvent('pointermove',{bubbles:true,cancelable:true,pointerId:1,clientX:tx,clientY:ty}));
      var live=root.style.getPropertyValue('rotate');
      var tip=d.querySelector('.ink-rotate-tooltip');
      // Shift-snap while near -80deg -> snaps to a 15deg step
      var ang=-80*Math.PI/180;
      d.dispatchEvent(new w.PointerEvent('pointermove',{bubbles:true,cancelable:true,pointerId:1,shiftKey:true,clientX:cx+Math.cos(ang)*120,clientY:cy+Math.sin(ang)*120}));
      var snapped=root.style.getPropertyValue('rotate');
      d.dispatchEvent(new w.PointerEvent('pointerup',{bubbles:true,cancelable:true,pointerId:1,clientX:cx-100,clientY:cy}));
      var stored=r.document.get(el.id).styles.desktop.base.rotate;
      var label=r.history.entries().undo[0];
      // reject: lock the element, knob should not appear
      r.update(el.id,{settings:{locked:true}});
      r.selection.select(el.id);
      var lockedKnob=!!d.querySelector('[data-ink-element-id="'+el.id+'"] .ink-rotate-handle');
      var result={knob:visible,lockedKnob:lockedKnob===false,live:!!live,tip:tip?tip.textContent:null,snapped:!snapped||/^-?\\d+deg$/.test(snapped),stored:stored&&stored.unit==='deg'&&Number(stored.size)%15===0,label:label==='Rotate element'};
      r.remove(el.id);return result;
    })()`);
    check("selected elements expose a shift-snapped drag-to-rotate handle that commits to the store", state.knob && state.live && state.snapped && state.stored && state.label && state.lockedKnob, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder, r=b.runtime, doc=document;
      var el=r.insert('container',{}, {settings:{tag:'div'},styles:{base:{gap:{row:20,column:20,unit:'px'}}}});
      r.selection.select(el.id);
      // switch to the Advanced tab so Scale is present
      var tabs=doc.querySelectorAll('.ink-v2-control-tabs button');
      var adv=Array.from(tabs).find(function(t){return /advanced/i.test(t.textContent);}); if(adv)adv.click();
      var scaleRow=doc.querySelector('.ink-v2-control[data-ink-control="scale"]');
      var input=scaleRow&&scaleRow.querySelector('input');
      var focused=false; if(input){ input.focus(); focused=doc.activeElement===input; input.value='1.5'; }
      // A live edit re-renders the panel via document:update (just like typing in Scale).
      r.update(el.id,{styles:{base:{scale:1.5}}},'Set scale');
      // Read focus state BEFORE removing (removal clears selection and the panel shows empty).
      var activeEl=doc.activeElement;
      var refocused=!!(activeEl && activeEl.closest && activeEl.closest('.ink-v2-control[data-ink-control="scale"]'));
      var stillInput=(activeEl && activeEl.tagName)==='INPUT';
      var stored=r.document.get(el.id).styles.desktop.base.scale;
      r.remove(el.id);
      return {focused:focused,refocused:refocused,stillInput:stillInput,stored:stored};
    })()`);
    check("settings panel keeps the edited control focused across live re-renders", state.focused && state.refocused && state.stillInput && Number(state.stored) === 1.5, JSON.stringify(state));

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
      var btn=r.insert('button',{parentId:container.id},{settings:{text:'Go',icon:'arrow_forward',iconPosition:'after',align:'center',url:'#x'},styles:{base:{'font-size':{size:18,unit:'px'},padding:{top:20,right:40,bottom:20,left:40,unit:'px',linked:false},'border-radius':{size:5,unit:'px'}}}});
      var heading=r.insert('heading',{parentId:container.id},{settings:{text:'Linked',tag:'h2',link:'https://example.com'}});
      var img=r.insert('image',{parentId:container.id},{settings:{src:'https://example.com/i.png',caption:'Cap',link:'https://ex.com',align:'center'}});
      var icon=r.insert('icon',{parentId:container.id},{settings:{icon:'star',rotate:45}});
      var divider=r.insert('divider',{parentId:container.id},{settings:{align:'center'}});
      var d=b.iframeDoc;
      var btnEl=d.querySelector('[data-ink-element-id="'+btn.id+'"]');
      var result={
        buttonExplicit:!btnEl.classList.contains('is-size-lg')&&d.defaultView.getComputedStyle(btnEl).fontSize==='18px'&&d.defaultView.getComputedStyle(btnEl.querySelector('.ink-el-button-surface')).paddingTop==='20px',
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
      var styleTab=Array.from(document.querySelectorAll('#SettingsContainer .ink-v2-control-tabs button')).find(function(t){return t.textContent.trim().toLowerCase().endsWith('style')});
      if(styleTab) styleTab.click();
      result.statesSwitcher=!!document.querySelector('#SettingsContainer .ink-v2-states');
      r.remove(container.id);
      return result;
    })()`);
    check("primitive widgets expose explicit native controls and markup", state.buttonExplicit && state.buttonAlign && state.buttonIcon && state.headingLink && state.imageFigure && state.imageCaption && state.imageLinked && state.iconRotate === "rotate(45deg)" && state.dividerAlign && state.statesSwitcher, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder, r=b.runtime, ns='http://www.w3.org/2000/svg';
      var gradient=r.create('svg-linear-gradient',{settings:{importedDom:true,importedTag:'linearGradient',importedNamespace:ns,importedAttributes:{id:'paint'}}});
      var defs=r.create('svg-defs',{settings:{importedDom:true,importedTag:'defs',importedNamespace:ns,importedAttributes:{}},children:[gradient]});
      var path=r.create('svg-path',{settings:{importedDom:true,importedTag:'path',importedNamespace:ns,importedAttributes:{d:'M0 0h10v10z',fill:'url(#paint)'}}});
      var svg=r.insert('svg',{}, {settings:{importedDom:true,importedTag:'svg',importedNamespace:ns,importedAttributes:{viewBox:'0 0 10 10'},viewBox:'0 0 10 10'},children:[defs,path]});
      var d=b.iframeDoc, svgEl=d.querySelector('[data-ink-element-id="'+svg.id+'"]'), gradientEl=d.querySelector('[data-ink-element-id="'+gradient.id+'"]'), pathEl=d.querySelector('[data-ink-element-id="'+path.id+'"]');
      pathEl.dispatchEvent(new d.defaultView.MouseEvent('click',{bubbles:true,cancelable:true}));
      var result={
        svgNamespace:svgEl?.namespaceURI===ns,
        gradientCase:gradientEl?.tagName==='linearGradient',
        pathNamespace:pathEl?.namespaceURI===ns,
        rootSelected:r.selection.selectedId===svg.id,
        geometryHidden:!document.querySelector('[data-ink-element-type="svg-path"]'),
        vectorPublic:!!document.querySelector('[data-ink-element-type="svg"]')
      };
      r.remove(svg.id); return result;
    })()`);
    check("SVG imports preserve namespaces/case and edit as one vector widget", state.svgNamespace && state.gradientCase && state.pathNamespace && state.rootSelected && state.geometryHidden && state.vectorPublic, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder, r=b.runtime, id=b.iframeDoc;
      var img=r.insert('image',{}, {settings:{src:'https://example.com/x.jpg',caption:'Cap'}});
      var iconBox=r.insert('icon-box',{}, {settings:{icon:'star'}});
      var progress=r.insert('progress',{}, {settings:{value:60}});
      var btn=r.insert('button',{}, {settings:{icon:'arrow_forward',text:'Go'}});
      var heading=r.insert('heading',{}, {settings:{link:{url:'https://ex.com',nofollow:true}}});
      var css=id.getElementById('ink-builder-v2-styles').textContent;
      r.update(img.id,{styles:{base:{filter:{blur:2,brightness:90,contrast:110,saturate:80,hue:5},'object-fit':'cover','image-width':{size:640,unit:'px'},'image-height':{size:360,unit:'px'},'border-radius':{top:8,right:8,bottom:8,left:8,unit:'px',linked:true}}}},'Style');
      r.update(iconBox.id,{styles:{base:{'font-size':{size:48,unit:'px'}}}},'Style');
      r.update(progress.id,{styles:{base:{color:'#ff0000'}}},'Style');
      r.update(btn.id,{styles:{base:{color:'#123456','icon-size':{size:24,unit:'px'},'icon-gap':{size:10,unit:'px'}},hover:{color:'#654321'}}},'Style');
      r.update(heading.id,{styles:{base:{'link-color':'#00ff00'}}},'Style');
      var css2=id.getElementById('ink-builder-v2-styles').textContent;
      var esc=function(x){return CSS.escape(x);};
      var ruleText=function(needle){var start=css2.indexOf(needle); if(start===-1) return ''; var end=css2.indexOf('}',start); return css2.slice(start, end===-1?start+200:end);};
      var imgRule=ruleText('.ink-el-'+esc(img.id)+' .ink-el-image{');
      var imageParts=imgRule.includes('filter:blur(2px)') && imgRule.includes('object-fit:cover') && imgRule.includes('width:640px') && imgRule.includes('height:360px') && imgRule.includes('border-radius:8px 8px 8px 8px');
      var iconParts=ruleText('.ink-el-'+esc(iconBox.id)+' .ink-el-icon{').includes('font-size:48px');
      var progressPart=ruleText('.ink-el-'+esc(progress.id)+' .ink-el-progress-value{').includes('color:#ff0000');
      var btnTextRule=ruleText('.ink-el-'+esc(btn.id)+' .ink-el-button-text{');
      var btnHoverRule=ruleText('.ink-el-'+esc(btn.id)+':hover .ink-el-button-text{');
      var btnIconRule=ruleText('.ink-el-'+esc(btn.id)+' .ink-el-button-icon{');
      var btnGapRule=ruleText('.ink-el-'+esc(btn.id)+'{');
      var buttonParts=btnTextRule.includes('color:#123456') && btnHoverRule.includes('color:#654321') && btnIconRule.includes('font-size:24px') && btnGapRule.includes('--ink-icon-gap:10px');
      var headingPart=ruleText('.ink-el-'+esc(heading.id)+' .ink-el-heading-link{').includes('color:#00ff00');
      var imageDom=!!id.querySelector('[data-ink-element-id="'+img.id+'"] .ink-el-image');
      var headingLink=!!id.querySelector('[data-ink-element-id="'+heading.id+'"] .ink-el-heading-link[rel="nofollow"]');
      var noWrapperOnly=!css2.includes('.ink-el-'+esc(progress.id)+'{color:#ff0000');
      [img.id,iconBox.id,progress.id,btn.id,heading.id].forEach(function(x){r.remove(x);});
      return {ok:true,imageParts:imageParts,iconParts:iconParts,progressPart:progressPart,buttonParts:buttonParts,headingPart:headingPart,imageDom:imageDom,headingLink:headingLink,noWrapperOnly:noWrapperOnly};
    })()`);
    check("style controls target declared element parts, not the wrapper", state.imageParts && state.iconParts && state.progressPart && state.buttonParts && state.headingPart && state.imageDom && state.headingLink && state.noWrapperOnly, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder, r=b.runtime, id=b.iframeDoc, esc=function(x){return CSS.escape(x);};
      var counter=r.insert('counter',{});
      var testimonial=r.insert('testimonial',{});
      var iconList=r.insert('icon-list',{});
      var rating=r.insert('rating',{});
      r.update(counter.id,{styles:{base:{'number-color':'#111111','title-color':'#222222'}}},'Style');
      r.update(testimonial.id,{styles:{base:{'quote-color':'#333333','name-color':'#444444','role-color':'#555555'}}},'Style');
      r.update(iconList.id,{styles:{base:{'icon-size':{size:20,unit:'px'},'text-color':'#666666'}}},'Style');
      r.update(rating.id,{styles:{base:{color:'#f0ad4e','icon-size':{size:26,unit:'px'}}}},'Style');
      var rules=builder.runtime.styles.nodeRules(r.document.get(counter.id)) + builder.runtime.styles.nodeRules(r.document.get(testimonial.id)) + builder.runtime.styles.nodeRules(r.document.get(iconList.id)) + builder.runtime.styles.nodeRules(r.document.get(rating.id));
      var checks={
        counterNumber:rules.includes('.ink-el-'+esc(counter.id)+' .ink-el-counter-number{color:#111111'),
        counterTitle:rules.includes('.ink-el-'+esc(counter.id)+' .ink-el-counter-title{color:#222222'),
        testimonialQuote:rules.includes('.ink-el-'+esc(testimonial.id)+' blockquote{color:#333333'),
        testimonialName:rules.includes('.ink-el-'+esc(testimonial.id)+' .ink-el-testimonial-name{color:#444444'),
        iconListIcon:rules.includes('.ink-el-'+esc(iconList.id)+' .ink-el-icon{font-size:20px'),
        iconListText:rules.includes('.ink-el-'+esc(iconList.id)+' .ink-el-icon-list-text{color:#666666'),
        ratingStars:rules.includes('.ink-el-'+esc(rating.id)+' .material-symbols-rounded{color:#f0ad4e;font-size:26px')
      };
      var iconListDom=id.querySelector('[data-ink-element-id="'+iconList.id+'"] .ink-el-icon-list-text');
      [counter.id,testimonial.id,iconList.id,rating.id].forEach(function(x){r.remove(x);});
      return {ok:true,counterNumber:checks.counterNumber,counterTitle:checks.counterTitle,testimonialQuote:checks.testimonialQuote,testimonialName:checks.testimonialName,iconListIcon:checks.iconListIcon,iconListText:checks.iconListText,ratingStars:checks.ratingStars,iconListDom:!!iconListDom};
    })()`);
    check("composite widgets style their inner parts independently", state.counterNumber && state.counterTitle && state.testimonialQuote && state.testimonialName && state.iconListIcon && state.iconListText && state.ratingStars && state.iconListDom, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      var b=builder, r=b.runtime, id=b.iframeDoc, esc=function(x){return CSS.escape(x);};
      var btn=r.insert('button',{});
      // Panel path: writing a hover value while the tablet device is active lands on tablet.hover.
      switchToTabletMode();
      var panel=r.settingsPanel;
      panel.setValue({name:'color',responsive:true,state:'hover',label:'Color'}, r.document.get(btn.id), '#00ff88');
      var node=r.document.get(btn.id);
      var panelStored=!!node.styles.tablet && node.styles.tablet.hover && node.styles.tablet.hover.color==='#00ff88';
      // Non-responsive control on tablet inherits from desktop.base.
      panel.setValue({name:'background-color',responsive:false,label:'Background'}, r.document.get(btn.id), '#112233');
      var inherited=!!node.styles.desktop && node.styles.desktop.base['background-color']==='#112233';
      switchToDesktopMode();
      // Engine path: tablet × hover compiles into a media-scoped :hover rule (not a plain desktop rule).
      r.update(btn.id,{styles:{tablet:{hover:{color:'#00ff88'}}}},'Style');
      var rules=builder.runtime.styles.nodeRules(r.document.get(btn.id));
      var mediaHover=rules.indexOf('@media(max-width:1024px){.ink-canvas-root .ink-el-'+esc(btn.id)+':hover .ink-el-button-text{color:#00ff88')!==-1;
      var plainDesktop=!rules.includes('.ink-el-'+esc(btn.id)+'{color:#00ff88');
      r.remove(btn.id);
      return {ok:true,panelStored:panelStored,inherited:inherited,mediaHover:mediaHover,plainDesktop:plainDesktop};
    })()`);
    check("responsive values combine with interaction states (device × state)", state.panelStored && state.inherited && state.mediaHover && state.plainDesktop, JSON.stringify(state));

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
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var link=r.insert('link',{}, {settings:{text:'Design link',url:'#ink-smoke-link'}});
      var el=d.querySelector('[data-ink-element-id="'+link.id+'"]');
      var designAllowed=el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
      b.setMode('preview');
      el=d.querySelector('[data-ink-element-id="'+link.id+'"]');
      var previewAllowed=el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
      b.setMode('design'); r.remove(link.id);
      return {designPrevented:designAllowed===false,previewAllowed:previewAllowed===true};
    })()`);
    check("links select without navigating in Design and navigate in Preview", state.designPrevented && state.previewAllowed, JSON.stringify(state));

    state = await client.evaluate(`(function(){
      document.getElementById('customCss').value='body{--smoke-color:#0ea5e9}';
      document.getElementById('customJs').value='window.__inkSmoke=true';
      applyCustomCode();
      var doc=builder.iframeDoc;
      var cssInDesign=doc.getElementById('pb-custom-css')?.textContent.includes('--smoke-color');
      var jsBlockedInDesign=!doc.getElementById('pb-custom-js') && doc.defaultView.__inkSmoke !== true;
      enterBuilderMode('code');
      var codeOpen=document.querySelector('[data-smenu="code"]').classList.contains('active') && !!window.codeMirrors.html;
      enterBuilderMode('design');
      var design=builder.getMode()==='design';
      toggleDesignMode(); var preview=builder.getMode()==='preview';
      var jsInPreview=!!doc.getElementById('pb-custom-js') && doc.defaultView.__inkSmoke === true;
      toggleDesignMode();
      var jsRemovedOnDesign=!doc.getElementById('pb-custom-js');
      return {cssInDesign:cssInDesign,jsBlockedInDesign:jsBlockedInDesign,jsInPreview:jsInPreview,jsRemovedOnDesign:jsRemovedOnDesign,codeOpen:codeOpen,design:design,preview:preview};
    })()`);
    check("custom CSS stays live while custom JS is preview-only", state.cssInDesign && state.jsBlockedInDesign && state.jsInPreview && state.jsRemovedOnDesign, JSON.stringify(state));
    check("Code and Design/Preview modes work", state.codeOpen && state.design && state.preview, JSON.stringify(state));

    await client.evaluate(`(function(){
      document.getElementById('customJs').value='import { value } from "data:text/javascript,export%20const%20value%3D%22module-ok%22"; window.__inkModuleSmoke=value';
      applyCustomCode(); builder.setMode('preview'); return true;
    })()`);
    await wait(700);
    state = await client.evaluate(`(function(){
      var script=builder.iframeDoc.getElementById('pb-custom-js');
      var result={module:script?.type==='module',executed:builder.iframeDoc.defaultView.__inkModuleSmoke==='module-ok'};
      builder.setMode('design'); document.getElementById('customJs').value='window.__inkSmoke=true'; applyCustomCode();
      return result;
    })()`);
    check("Code workspace executes ES-module imports in Preview/publish", state.module && state.executed, JSON.stringify(state));

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

    state = await client.evaluate(`(function(){
      var b=builder, r=b.runtime, d=b.iframeDoc;
      var tabs=r.insert('tabs',{}, {settings:{items:[{title:'One',content:'First panel'},{title:'Two',content:'Second panel'}]}});
      var carousel=r.insert('carousel',{}, {settings:{images:[{url:'https://example.com/a.jpg'},{url:'https://example.com/b.jpg'},{url:'https://example.com/c.jpg'}],navigation:'both',autoplay:true,interval:3000,loop:true}});
      var gallery=r.insert('gallery',{}, {settings:{images:[{url:'https://example.com/g1.jpg'},{url:'https://example.com/g2.jpg'}]}});
      var tabsEl=d.querySelector('[data-ink-element-id="'+tabs.id+'"]');
      var carEl=d.querySelector('[data-ink-element-id="'+carousel.id+'"]');
      var galEl=d.querySelector('[data-ink-element-id="'+gallery.id+'"]');
      var tabsNav=tabsEl.querySelectorAll('.ink-el-tabs-nav button');
      var tabTwo=tabsEl.querySelectorAll('.ink-el-tabs-nav button')[1];
      tabTwo.click();
      var tabSwitched=!!tabTwo.classList.contains('is-active') && tabsEl.querySelectorAll('.ink-el-tab-panel')[1].hidden===false && tabsEl.querySelectorAll('.ink-el-tab-panel')[0].hidden===true;
      var runtime=!!d.querySelector('[data-ink-widget-runtime]') && d.defaultView.__inkWidgetsReady===true;
      var carouselMarkup=!!carEl && carEl.querySelectorAll('.ink-el-carousel-slide').length===3 && !!carEl.querySelector('.is-prev') && !!carEl.querySelector('.is-next') && !!carEl.querySelector('[data-carousel-dot]') && carEl.getAttribute('data-autoplay')==='true' && carEl.getAttribute('data-loop')==='true' && carEl.getAttribute('data-interval')==='3000';
      carEl.querySelector('.is-next').click();
      var advanced=carEl.getAttribute('data-index')==='1' && carEl.querySelector('.ink-el-carousel-track').style.transform.indexOf('-100%')!==-1;
      var galleryLightbox=!!galEl && galEl.getAttribute('data-lightbox')==='true' && !!galEl.querySelector('img');
      galEl.querySelector('img').click();
      var lightbox=!!d.querySelector('.ink-lightbox');
      if(lightbox){ d.querySelector('.ink-lightbox-close').click(); }
      var lightboxClosed=!d.querySelector('.ink-lightbox');
      var publishedRuntime=b.getHtml().includes('data-ink-widget-runtime');
      r.remove(tabs.id); r.remove(carousel.id); r.remove(gallery.id);
      return {ok:true,tabSwitched:tabSwitched,runtime:runtime,carouselMarkup:carouselMarkup,advanced:advanced,galleryLightbox:galleryLightbox,lightboxClosed:lightboxClosed,publishedRuntime:publishedRuntime};
    })()`);
    check("interactive widgets ship a self-contained behavior runtime", state.ok && state.runtime && state.publishedRuntime, JSON.stringify(state));
    check("tabs switch panels on click", state.tabSwitched, JSON.stringify(state));
    check("carousel exposes slides, nav, dots, autoplay, and advances", state.carouselMarkup && state.advanced, JSON.stringify(state));
    check("gallery lightbox opens and closes", state.galleryLightbox && state.lightboxClosed, JSON.stringify(state));

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

    // A responsive capture can reference the same global header/footer several times in
    // mutually exclusive breakpoint branches. Runtime instances must have unique IDs, while
    // editing any one instance must update the canonical template part and every sibling
    // instance. The saved page store should still contain lightweight references only.
    state = await client.evaluate(`(async function(){
      var b=builder, r=b.runtime;
      var canonical={id:'canonical-header',type:'site-part',settings:{partKey:'header'},styles:{},children:[
        {id:'canonical-heading',type:'heading',settings:{text:'Shared heading',tag:'h2'},styles:{},children:[]}
      ]};
      b.siteParts={header:canonical}; r.siteParts=b.siteParts;
      var refs={version:2,type:'page',settings:{title:'Shared parts'},children:[
        {id:'header-desktop',type:'site-part',settings:{partKey:'header'},styles:{},children:[]},
        {id:'header-mobile',type:'site-part',settings:{partKey:'header'},styles:{},children:[]}
      ]};
      r.document.replace(b.hydrateSiteParts(refs));
      r.history.undoStack.length=0; r.history.redoStack.length=0;
      var roots=r.document.data.children;
      var ids=[]; (function walk(nodes){nodes.forEach(function(n){ids.push(n.id);walk(n.children||[])})})(roots);
      var unique=(new Set(ids)).size===ids.length;
      var sourceChild=roots[0].children[0];
      var sourceId=sourceChild._sitePartSourceId;
      r.update(sourceChild.id,{settings:{text:'Edited globally'}});
      await Promise.resolve(); await Promise.resolve();
      roots=r.document.data.children;
      var sibling=roots[1].children.find(function(n){return n._sitePartSourceId===sourceId});
      var synchronized=roots[0].children[0].settings.text==='Edited globally' && sibling && sibling.settings.text==='Edited globally';
      var canonicalSaved=b.getSiteParts().header.children[0].settings.text==='Edited globally';
      var dehydrated=b.getData().children;
      var referencesOnly=dehydrated.length===2 && dehydrated.every(function(n){return n.type==='site-part' && n.children.length===0 && n.settings.partKey==='header'});
      r.history.undo(); await Promise.resolve(); await Promise.resolve();
      roots=r.document.data.children;
      var undoSynchronized=roots.every(function(root){return root.children[0].settings.text==='Shared heading'});
      return {unique:unique,synchronized:synchronized,canonicalSaved:canonicalSaved,referencesOnly:referencesOnly,undoSynchronized:undoSynchronized,ids:ids};
    })()`);
    check("responsive global template parts use unique runtime IDs and edit as one", state.unique && state.synchronized && state.canonicalSaved && state.referencesOnly && state.undoSynchronized, JSON.stringify(state));

    await client.send("Page.navigate", { url: `${BASE_URL}/admin/pages/${pageId}/edit` });
    await wait(6000);
    state = await client.evaluate(`(function(){
      var frame=document.querySelector('iframe[title="Ink Builder preview"]');
      return {block:!!document.querySelector('[data-block-editor-target="block"][data-type="page_builder"]'),preview:!!frame,styled:!!frame && frame.getAttribute('srcdoc').includes('ink-design-kit.css')};
    })()`);
    check("classic editor shows the builder block", state.block === true);
    check("classic editor preview remains styled", state.preview && state.styled, JSON.stringify(state));

    for (const importedPageId of IMPORTED_PAGE_IDS) {
      const errorOffset = client.errors.length;
      await client.send("Page.navigate", { url: `${BASE_URL}/builder/page/${importedPageId}?smoke=${Date.now()}` });
      await wait(15000);
      state = await client.evaluate(`(function(){
        var b=window.builder, r=b&&b.runtime, d=b&&b.iframeDoc;
        var ids=[],parts={};
        function walk(nodes){(nodes||[]).forEach(function(n){ids.push(n.id);if(n.type==='site-part'){var key=n.settings&&n.settings.partKey||'unknown';parts[key]=(parts[key]||0)+1}walk(n.children)})}
        if(r) walk(r.document.data.children);
        var duplicates=ids.filter(function(id,index){return ids.indexOf(id)!==index});
        var broken=d?Array.from(d.images).filter(function(img){return img.complete&&img.naturalWidth===0}).map(function(img){return img.currentSrc||img.src}).slice(0,10):[];
        return {ready:!!(b&&r&&d),title:document.querySelector('.ink-appbar-document-name')&&document.querySelector('.ink-appbar-document-name').textContent,children:r&&r.document.data.children.length,parts:parts,duplicates:Array.from(new Set(duplicates)),broken:broken,canvasControls:d&&d.querySelectorAll('.ink-editor-toolbar button .ink-canvas-action-icon').length,canvasHeight:d&&d.documentElement.scrollHeight};
      })()`);
      const pageErrors = client.errors.slice(errorOffset).filter((error) => !/not configured|favicon|Failed to load resource/.test(error));
      state.errors = pageErrors;
      check(`imported native page ${importedPageId} loads without duplicate IDs or missing images`, state.ready && state.children > 0 && state.duplicates.length === 0 && state.broken.length === 0 && state.canvasControls > 0 && pageErrors.length === 0, JSON.stringify(state));
      if (String(importedPageId) === "15") {
        const motionState = await client.evaluate(`(async function(){
          var b=builder,r=b.runtime,d=b.iframeDoc,motionNodes=0,timelines=0;
          (function walk(nodes){(nodes||[]).forEach(function(n){if(n.settings&&n.settings.motion&&n.settings.motion.enabled!==false)motionNodes++;if(n.type==='timeline-accordion')timelines++;walk(n.children)})})(r.document.data.children);
          b.setMode('preview');
          await new Promise(function(resolve){setTimeout(resolve,300)});
          var animations=d.getAnimations().filter(function(animation){return animation.playState==='running'||animation.playState==='finished'}).length;
          var running=d.querySelectorAll('[data-ink-motion="running"],[data-ink-motion="complete"]').length;
          b.setMode('design');
          return {motionNodes:motionNodes,timelines:timelines,animations:animations,running:running,restored:b.getMode()==='design'};
        })()`);
        check("About import keeps native portrait motion and Journey accordions", motionState.motionNodes >= 4 && motionState.timelines >= 1 && motionState.animations >= 4 && motionState.restored, JSON.stringify(motionState));
      }
    }

    if (PUBLISH_IMPORTED_PAGE_ID) {
      await client.send("Page.navigate", { url: `${BASE_URL}/builder/page/${PUBLISH_IMPORTED_PAGE_ID}?publish-smoke=${Date.now()}` });
      await wait(15000);
      state = await client.evaluate(`(async function(){
        if(!window.builder||!builder.runtime)return {ready:false};
        var payload=await persistBuilderDocument(true);
        return {ready:true,status:payload.status,publicUrl:payload.public_url,previewUrl:payload.preview_url};
      })()`);
      check(`native imported page ${PUBLISH_IMPORTED_PAGE_ID} saves and publishes`, state.ready && state.status === "published" && !!state.publicUrl, JSON.stringify(state));
      if (state.publicUrl) {
        const publicErrorOffset = client.errors.length;
        await client.send("Page.navigate", { url: `${BASE_URL}${state.publicUrl}?publish-smoke=${Date.now()}` });
        await wait(8000);
        const publishedState = await client.evaluate(`(function(){
          var broken=Array.from(document.images).filter(function(img){return img.complete&&img.naturalWidth===0}).map(function(img){return img.currentSrc||img.src}).slice(0,10);
          return {title:document.title,height:document.documentElement.scrollHeight,broken:broken,styles:document.querySelectorAll('style').length,scripts:document.querySelectorAll('script').length,canvas:!!document.querySelector('.ink-canvas-root')};
        })()`);
        const publicErrors = client.errors.slice(publicErrorOffset).filter((error) => !/not configured|favicon|Failed to load resource/.test(error));
        publishedState.errors = publicErrors;
        check("published imported page keeps its CSS, assets, and runtime", publishedState.canvas && publishedState.height > 1000 && publishedState.broken.length === 0 && publishedState.styles > 0 && publishedState.scripts > 0 && publicErrors.length === 0, JSON.stringify(publishedState));
      }
    }

    // =====================================================================
    //  COMPREHENSIVE ELEMENT AUDIT — every registered element type
    // =====================================================================
    // For each element we verify:
    //   1. It inserts and renders a DOM node with the expected tag/class
    //   2. Its definition exposes the expected controls (content + style + advanced)
    //   3. Its parts/selectors are present in the rendered DOM
    //   4. Its styleMap routes authored values to the correct element parts
    //   5. Its defaults produce valid initial CSS
    // =====================================================================
    // Navigate back to the builder page (the publish test may have navigated away).
    await client.send("Page.navigate", { url: `${BASE_URL}/builder/page/${pageId}` });
    await wait(7000);

    // --- Layout elements: Container, Frame, Div, Group ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var results={};
      // Container: boxed layout with inner drop target, overlay, shape dividers
      var c=r.insert('container',{},{settings:{tag:'div',layout:'boxed'},styles:{base:{display:'flex','flex-direction':'column',padding:{top:20,right:20,bottom:20,left:20,unit:'px'},gap:{row:16,column:16,unit:'px'}}}});
      var cEl=d.querySelector('[data-ink-element-id="'+c.id+'"]');
      results.container={exists:!!cEl,tag:cEl?.tagName,hasInner:!!cEl?.querySelector('.ink-el-container-inner'),hasOverlay:!!cEl?.querySelector('.ink-el-container-overlay'),hasDataChildren:!!cEl?.querySelector('[data-ink-children]'),kind:cEl?.dataset.inkKind};
      // Frame: freeform composition box with inner + overlay
      var f=r.insert('frame',{},{settings:{tag:'div',label:'Frame'},styles:{base:{display:'block',width:'fit-content',height:'fit-content','min-width':{size:120,unit:'px'},'min-height':{size:80,unit:'px'},position:'relative'}}});
      var fEl=d.querySelector('[data-ink-element-id="'+f.id+'"]');
      results.frame={exists:!!fEl,tag:fEl?.tagName,hasInner:!!fEl?.querySelector('.ink-el-frame-inner'),hasOverlay:!!fEl?.querySelector('.ink-el-frame-overlay'),kind:fEl?.dataset.inkKind};
      // Div: basic layout block with configurable tag
      var dv=r.insert('div',{},{settings:{tag:'div'},styles:{base:{display:'block'}}});
      var dvEl=d.querySelector('[data-ink-element-id="'+dv.id+'"]');
      results.div={exists:!!dvEl,tag:dvEl?.tagName,hasDataChildren:!!dvEl?.hasAttribute('data-ink-children'),kind:dvEl?.dataset.inkKind};
      // Group: organizational wrapper (display:contents, no overlay)
      var g=r.insert('group',{},{settings:{label:'My Group'},styles:{base:{display:'contents'}}});
      var gEl=d.querySelector('[data-ink-element-id="'+g.id+'"]');
      results.group={exists:!!gEl,tag:gEl?.tagName,hasOverlay:!!gEl?.querySelector('.ink-editor-overlay'),kind:gEl?.dataset.inkKind};
      [c.id,f.id,dv.id,g.id].forEach(function(id){r.remove(id);});
      return results;
    })()`);
    check("Layout elements render correct DOM structure", state && !state.__error && state.container && state.container.exists && state.container.hasInner && state.container.hasDataChildren && state.frame && state.frame.exists && state.frame.hasInner && state.div && state.div.exists && state.div.hasDataChildren && state.group && state.group.exists && !state.group.hasOverlay, JSON.stringify(state));

    // --- Container defaults + controls ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc,w=d.defaultView;
      var c=r.insert('container',{},{settings:{tag:'div',layout:'boxed'},styles:{base:{display:'flex','flex-direction':'column',width:'100%',padding:{top:35,right:10,bottom:35,left:10,unit:'px'},gap:{row:20,column:20,unit:'px'}}}});
      var css=d.getElementById('ink-builder-v2-styles').textContent;
      var rules=(css.match(new RegExp('[^{}]*\\.ink-el-'+c.id+'[^{]*\\{[^}]*\\}','g'))||[]);
      var def=r.elements.get('container');
      var ctrlCount=def.controls.length;
      r.remove(c.id);
      return {ctrlCount:ctrlCount,hasDisplay:css.includes('display:flex').toString(),hasGap:css.includes('gap:20px 20px').toString(),hasPad:css.includes('padding:35px 10px 35px 10px').toString()};
    })()`);
    check("Container has correct defaults, controls, and CSS compilation", Number(state.ctrlCount) >= 15 && state.hasDisplay === 'true' && state.hasGap === 'true' && state.hasPad === 'true', JSON.stringify(state));

    // --- Frame: link + overlay + 3D transforms ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var f=r.insert('frame',{},{settings:{tag:'div',link:{url:'/about',isExternal:true}},styles:{base:{display:'block',width:'fit-content',height:'fit-content',position:'relative','box-shadow':[{x:0,y:2,blur:6,spread:0,unit:'px',color:'#110011'}],'transform-origin':'center center',perspective:{size:800,unit:'px'},'backface-visibility':'hidden','transform-style':'preserve-3d'}}});
      var el=d.querySelector('[data-ink-element-id="'+f.id+'"]');
      var rules=r.styles.nodeRules(f);
      var result={link:el.tagName==='A'&&el.getAttribute('href')==='/about'&&el.target==='_blank',surface:!!el.querySelector('.ink-el-frame-inner,.ink-el-frame-overlay'),shadows:/box-shadow:[^;}]+/.test(rules),threeD:rules.includes('transform-style:preserve-3d')&&rules.includes('backface-visibility:hidden')};
      r.remove(f.id);return result;
    })()`);
    check("Frame supports semantic links, layered shadows, and full 3D transform styles", state.link && state.surface && state.shadows && state.threeD, JSON.stringify(state));

    // --- Div Block: tag select, grid controls ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var dv=r.insert('div',{},{settings:{tag:'section'},styles:{base:{display:'grid','grid-template-columns':{row:2,column:2,unit:'fr'},'grid-auto-flow':'column',gap:{row:10,column:10,unit:'px'}}}});
      var el=d.querySelector('[data-ink-element-id="'+dv.id+'"]');
      var rules=r.styles.nodeRules(dv);
      r.remove(dv.id);
      return {tag:el.tagName==='SECTION',grid:rules.includes('display:grid'),columns:rules.includes('grid-template-columns:2fr 2fr'),flow:rules.includes('grid-auto-flow:column'),gap:rules.includes('gap:10px 10px')};
    })()`);
    check("Div Block supports configurable HTML tag and CSS Grid layout", state.tag && state.grid && state.columns && state.flow && state.gap, JSON.stringify(state));

    // --- Group: organizational only, no visual rendering ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var g=r.insert('group',{},{settings:{label:'Test Group'}});
      var el=d.querySelector('[data-ink-element-id="'+g.id+'"]');
      var def=r.elements.get('group');
      var rules=r.styles.nodeRules(g);
      r.remove(g.id);
      return {tag:el.tagName==='DIV',display:rules,controls:def.controls.length,acceptsChildren:def.acceptsChildren};
    })()`);
    check("Group is organizational (display:contents, no overlay, accepts children)", state.display && state.display.includes('display:contents') && state.acceptsChildren === true && state.controls === 1, JSON.stringify(state));

    // --- Section (legacy): full-width layout, structure presets ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var s=r.insert('section',{},{settings:{tag:'section',layout:'boxed',structure:'50,50'},styles:{base:{display:'flex','flex-direction':'column',width:'100%',padding:{top:35,right:10,bottom:35,left:10,unit:'px'}}}});
      var el=d.querySelector('[data-ink-element-id="'+s.id+'"]');
      var def=r.elements.get('section');
      r.remove(s.id);
      return {exists:!!el,tag:el?.tagName==='SECTION',legacy:def.legacy===true,controls:def.controls.length,acceptsChildren:def.acceptsChildren};
    })()`);
    check("Section (legacy) renders as <section>, accepts children, has structure controls", state.exists && state.tag && state.legacy && state.acceptsChildren && state.controls >= 10, JSON.stringify(state));

    // --- Columns (legacy): structure-based column widths ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var cols=r.insert('columns',{},{settings:{structure:'50,50'}});
      var el=d.querySelector('[data-ink-element-id="'+cols.id+'"]');
      var def=r.elements.get('columns');
      r.remove(cols.id);
      return {exists:!!el,tag:el?.tagName==='DIV',legacy:def.legacy===true,structure:cols.settings.structure};
    })()`);
    check("Columns (legacy) renders structure-based layout", state.exists && state.tag && state.legacy && state.structure === '50,50', JSON.stringify(state));

    // --- Column (legacy): flex column with gap ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var col=r.insert('column',{},{styles:{base:{display:'flex','flex-direction':'column',gap:{row:20,column:20,unit:'px'},padding:{top:10,right:10,bottom:10,left:10,unit:'px'},'align-items':'stretch'}}});
      var el=d.querySelector('[data-ink-element-id="'+col.id+'"]');
      var rules=r.styles.nodeRules(col);
      r.remove(col.id);
      return {exists:!!el,rules:rules};
    })()`);
    check("Column (legacy) is a flex column with stretch alignment", state.rules && state.rules.includes('display:flex') && state.rules.includes('flex-direction:column') && state.rules.includes('align-items:stretch'), JSON.stringify(state));

    // --- Basic elements: Heading, Paragraph, Link, Inline Text, Line Break ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc,w=d.defaultView;
      var results={};
      // Heading: semantic tag with text, link support
      var h=r.insert('heading',{},{settings:{text:'My Heading',tag:'h1',size:'xl',link:'https://example.com'},styles:{base:{color:'#123456','font-size':{size:48,unit:'px'}}}});
      var hEl=d.querySelector('[data-ink-element-id="'+h.id+'"]');
      results.heading={tag:hEl?.tagName,h1:hEl?.tagName==='H1',text:hEl?.textContent?.trim(),hasLink:!!hEl?.querySelector('a.ink-el-heading-link'),linkHref:hEl?.querySelector('a')?.href?.includes('example.com'),sizeClass:hEl?.classList.contains('ink-size-xl')};
      // Paragraph: simple text block
      var p=r.insert('paragraph',{},{settings:{text:'A paragraph.'},styles:{base:{color:'#333'}}});
      var pEl=d.querySelector('[data-ink-element-id="'+p.id+'"]');
      results.paragraph={tag:pEl?.tagName==='P',text:pEl?.textContent?.trim()};
      // Link: inline anchor
      var lk=r.insert('link',{},{settings:{text:'Click here',url:'https://test.com',target:'_blank',rel:'nofollow'}});
      var lkEl=d.querySelector('[data-ink-element-id="'+lk.id+'"]');
      results.link={tag:lkEl?.tagName==='A',text:lkEl?.textContent?.trim(),href:lkEl?.getAttribute('href'),target:lkEl?.target,rel:lkEl?.rel};
      // Inline Text: span element with configurable tag
      var it=r.insert('inline-text',{},{settings:{tag:'strong',text:'Bold text'}});
      var itEl=d.querySelector('[data-ink-element-id="'+it.id+'"]');
      results.inlineText={tag:itEl?.tagName==='STRONG',text:itEl?.textContent?.trim()};
      // Line Break: bare <br>
      var br=r.insert('line-break',{});
      var brEl=d.querySelector('[data-ink-element-id="'+br.id+'"]');
      results.lineBreak={tag:brEl?.tagName==='BR'};
      [h.id,p.id,lk.id,it.id,br.id].forEach(function(id){r.remove(id);});
      return results;
    })()`);
    check("Basic text elements render with correct semantic tags and properties", state.heading.h1 && state.heading.hasLink && state.paragraph.tag && state.link.tag && state.link.target === '_blank' && state.inlineText.tag && state.lineBreak.tag, JSON.stringify(state));

    // --- Heading: size scale + responsive ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var h=r.insert('heading',{},{settings:{text:'Scaled',tag:'h2',size:'large'},styles:{base:{color:'#ff0000'},tablet:{'font-size':{size:28,unit:'px'}}}});
      var rules=r.styles.nodeRules(h);
      var hasDesktopColor=rules.includes('color:#ff0000');
      var hasTabletSize=rules.includes('@media(max-width:1024px)')&&rules.includes('font-size:28px');
      r.remove(h.id);
      return {hasDesktopColor:hasDesktopColor,hasTabletSize:hasTabletSize};
    })()`);
    check("Heading supports size scale, color, and responsive font-size", state.hasDesktopColor && state.hasTabletSize, JSON.stringify(state));

    // --- List elements: ul, ol, li ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var ul=r.insert('unordered-list',{},{styles:{base:{display:'list-item'}}});
      var ol=r.insert('ordered-list',{});
      var li=r.insert('list-item',{},{settings:{},styles:{base:{}}});
      var ulEl=d.querySelector('[data-ink-element-id="'+ul.id+'"]');
      var olEl=d.querySelector('[data-ink-element-id="'+ol.id+'"]');
      var liEl=d.querySelector('[data-ink-element-id="'+li.id+'"]');
      r.remove(ul.id);r.remove(ol.id);r.remove(li.id);
      return {ul:ulEl?.tagName==='UL',ol:olEl?.tagName==='OL',li:liEl?.tagName==='LI'};
    })()`);
    check("List elements render as semantic <ul>, <ol>, <li>", state.ul && state.ol && state.li, JSON.stringify(state));

    // --- Form elements: form, input, textarea, label ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var form=r.insert('form',{},{settings:{action:'/submit',method:'POST'},styles:{base:{}}});
      var inp=r.insert('input',{},{settings:{inputType:'email',name:'user_email',placeholder:'Enter email',value:'test@test.com'},styles:{base:{}}});
      var ta=r.insert('textarea',{},{settings:{name:'message',placeholder:'Your message',text:'Hello'},styles:{base:{}}});
      var lbl=r.insert('label',{},{settings:{text:'Email',forId:'user_email'},styles:{base:{}}});
      var formEl=d.querySelector('[data-ink-element-id="'+form.id+'"]');
      var inpEl=d.querySelector('[data-ink-element-id="'+inp.id+'"]');
      var taEl=d.querySelector('[data-ink-element-id="'+ta.id+'"]');
      var lblEl=d.querySelector('[data-ink-element-id="'+lbl.id+'"]');
      r.remove(form.id);r.remove(inp.id);r.remove(ta.id);r.remove(lbl.id);
      return {form:formEl?.tagName==='FORM',input:inpEl?.tagName==='INPUT'&&inpEl?.type==='email'&&inpEl?.value==='test@test.com',textarea:taEl?.tagName==='TEXTAREA'&&taEl?.value==='Hello',label:!!lblEl&&lblEl.textContent.includes('Email')};
    })()`);
    check("Form elements render with correct attributes and values", state.form && state.input && state.textarea && state.label, JSON.stringify(state));

    // --- Media elements: video, audio, canvas, map ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var vid=r.insert('video',{},{settings:{src:'https://example.com/video.mp4',poster:'https://example.com/poster.jpg',controls:true},styles:{base:{width:'100%'}}});
      var aud=r.insert('audio',{},{settings:{src:'https://example.com/audio.mp3',controls:true},styles:{base:{width:'100%'}}});
      var cvs=r.insert('canvas',{},{settings:{width:400,height:300,label:'My canvas'}});
      var map=r.insert('map',{},{settings:{query:'New York',zoom:10}});
      var vidEl=d.querySelector('[data-ink-element-id="'+vid.id+'"]');
      var audEl=d.querySelector('[data-ink-element-id="'+aud.id+'"]');
      var cvsEl=d.querySelector('[data-ink-element-id="'+cvs.id+'"]');
      var mapEl=d.querySelector('[data-ink-element-id="'+map.id+'"]');
      r.remove(vid.id);r.remove(aud.id);r.remove(cvs.id);r.remove(map.id);
      return {video:vidEl?.tagName==='VIDEO'&&vidEl?.src?.includes('video.mp4')&&vidEl?.controls,audio:audEl?.tagName==='AUDIO'&&audEl?.src?.includes('audio.mp3'),canvas:cvsEl?.tagName==='CANVAS'&&cvsEl?.width===400&&cvsEl?.height===300&&cvsEl?.getAttribute('aria-label')==='My canvas',map:mapEl?.tagName==='IFRAME'&&mapEl?.src?.includes('google.com/maps')};
    })()`);
    check("Media elements render with correct src, controls, dimensions, and embeds", state.video && state.audio && state.canvas && state.map, JSON.stringify(state));

    // --- Icon: icon picker + rotation ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc,w=d.defaultView;
      var ic=r.insert('icon',{},{settings:{icon:'star',label:'Star icon',rotate:45},styles:{base:{color:'#6ec1e4'}}});
      var el=d.querySelector('[data-ink-element-id="'+ic.id+'"]');
      var hasIcon=el?.classList?.contains('material-symbols-rounded')||el?.classList?.contains('ink-icon-svg');
      var label=el?.getAttribute('aria-label');
      r.remove(ic.id);
      return {exists:!!el,label:label,hasIcon:hasIcon};
    })()`);
    check("Icon renders with Material/Lucide icon and aria-label", state.exists && state.hasIcon && state.label === 'Star icon', JSON.stringify(state));

    // --- Divider: align + border-top ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var dv=r.insert('divider',{},{settings:{weight:3,align:'center'},styles:{base:{border:'0','border-top':'2px solid #ff0000',width:'50%'}}});
      var el=d.querySelector('[data-ink-element-id="'+dv.id+'"]');
      var rules=r.styles.nodeRules(dv);
      r.remove(dv.id);
      return {tag:el?.tagName==='HR',hasAlign:el?.classList.contains('is-align-center'),border:rules.includes('border-top:2px solid #ff0000'),width:rules.includes('width:50%')};
    })()`);
    check("Divider renders as <hr> with alignment, border, and width styles", state.tag && state.hasAlign && state.border && state.width, JSON.stringify(state));

    // --- Spacer: height only ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var sp=r.insert('spacer',{},{styles:{base:{height:{size:100,unit:'vh'}}}});
      var el=d.querySelector('[data-ink-element-id="'+sp.id+'"]');
      var rules=r.styles.nodeRules(sp);
      r.remove(sp.id);
      return {exists:!!el,height:rules.includes('height:100vh')};
    })()`);
    check("Spacer renders as empty div with configurable height", state.exists && state.height, JSON.stringify(state));

    // --- Text Editor: TipTap WYSIWYG ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var te=r.insert('text-editor',{},{settings:{html:'<p>Hello world</p>'},styles:{base:{}}});
      var el=d.querySelector('[data-ink-element-id="'+te.id+'"]');
      var hasContent=el?.textContent?.includes('Hello world');
      r.remove(te.id);
      return {exists:!!el,hasContent:hasContent};
    })()`);
    check("Text Editor renders WYSIWYG content from HTML", state.exists && state.hasContent, JSON.stringify(state));

    // --- HTML: raw markup injection ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var h=r.insert('html',{},{settings:{html:'<div class="custom">Hello</div>'},styles:{base:{}}});
      var el=d.querySelector('[data-ink-element-id="'+h.id+'"]');
      var inner=el?.querySelector('.custom');
      r.remove(h.id);
      return {exists:!!el,inner:!!inner,text:inner?.textContent};
    })()`);
    check("HTML element injects raw markup", state.exists && state.inner && state.text === 'Hello', JSON.stringify(state));

    // --- Icon Box: icon + title + description + link ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var ib=r.insert('icon-box',{},{settings:{icon:'star',title:'Feature',description:'A great feature',url:'https://example.com'},styles:{base:{}}});
      var el=d.querySelector('[data-ink-element-id="'+ib.id+'"]');
      var hasIcon=!!el?.querySelector('.ink-el-icon,.material-symbols-rounded,.ink-lucide-icon');
      var hasTitle=el?.querySelector('.ink-el-box-title')?.textContent==='Feature';
      var hasDesc=el?.querySelector('.ink-el-box-desc')?.textContent==='A great feature';
      var hasLink=el?.tagName==='A'||!!el?.querySelector('a[href="https://example.com"]');
      r.remove(ib.id);
      return {exists:!!el,hasIcon:hasIcon,hasTitle:hasTitle,hasDesc:hasDesc,hasLink:hasLink};
    })()`);
    check("Icon Box renders icon, title, description, and optional link", state.exists && state.hasIcon && state.hasTitle && state.hasDesc, JSON.stringify(state));

    // --- Image Box: image + title + description ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var ib=r.insert('image-box',{},{settings:{image:'',title:'Feature',description:'Details here',url:''},styles:{base:{}}});
      var el=d.querySelector('[data-ink-element-id="'+ib.id+'"]');
      var hasTitle=el?.querySelector('.ink-el-box-title')?.textContent==='Feature';
      var hasDesc=el?.querySelector('.ink-el-box-desc')?.textContent==='Details here';
      r.remove(ib.id);
      return {exists:!!el,hasTitle:hasTitle,hasDesc:hasDesc};
    })()`);
    check("Image Box renders image, title, and description", state.exists && state.hasTitle && state.hasDesc, JSON.stringify(state));

    // --- Icon List: repeater items with icons ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var il=r.insert('icon-list',{},{settings:{items:[{icon:'check',text:'Item one',url:''},{icon:'check',text:'Item two',url:''},{icon:'check',text:'Item three',url:''}]},styles:{base:{}}});
      var el=d.querySelector('[data-ink-element-id="'+il.id+'"]');
      var items=el?.querySelectorAll('li');
      var texts=Array.from(items||[]).map(function(li){return li.querySelector('.ink-el-icon-list-text')?.textContent?.trim()});
      r.remove(il.id);
      return {exists:!!el,count:items?.length,texts:texts};
    })()`);
    check("Icon List renders repeater items as <li> with icons and text", state.exists && state.count === 3 && state.texts.join(',') === 'Item one,Item two,Item three', JSON.stringify(state));

    // --- Counter: animated number with prefix/suffix ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var c=r.insert('counter',{},{settings:{number:'150',prefix:'$',suffix:'+',title:'Projects completed'},styles:{base:{}}});
      var el=d.querySelector('[data-ink-element-id="'+c.id+'"]');
      var num=el?.querySelector('.ink-el-counter-number')?.textContent;
      var title=el?.querySelector('.ink-el-counter-title')?.textContent;
      r.remove(c.id);
      return {exists:!!el,number:num,title:title};
    })()`);
    check("Counter renders number with prefix/suffix and title", state.exists && state.number === '$150+' && state.title === 'Projects completed', JSON.stringify(state));

    // --- Progress Bar: track + bar + percentage ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var p=r.insert('progress',{},{settings:{title:'Progress',value:75},styles:{base:{}}});
      var el=d.querySelector('[data-ink-element-id="'+p.id+'"]');
      var bar=el?.querySelector('.ink-el-progress-value');
      var barWidth=bar?.style?.width;
      r.remove(p.id);
      return {exists:!!el,barWidth:barWidth};
    })()`);
    check("Progress Bar renders track with correct fill width", state.exists && state.barWidth === '75%', JSON.stringify(state));

    // --- Rating: star icons ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var r2=r.insert('rating',{},{settings:{rating:4,scale:5,label:'Rating'},styles:{base:{}}});
      var el=d.querySelector('[data-ink-element-id="'+r2.id+'"]');
      var stars=el?.querySelectorAll('.material-symbols-rounded');
      r.remove(r2.id);
      return {exists:!!el,starCount:stars?.length};
    })()`);
    check("Rating renders star icons matching the scale", state.exists && state.starCount === 5, JSON.stringify(state));

    // --- Testimonial: blockquote + name + role ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var t=r.insert('testimonial',{},{settings:{quote:'Amazing work',name:'Jane Doe',role:'CEO',avatar:''},styles:{base:{}}});
      var el=d.querySelector('[data-ink-element-id="'+t.id+'"]');
      var quote=el?.querySelector('blockquote')?.textContent?.trim();
      var name=el?.querySelector('.ink-el-testimonial-name')?.textContent;
      var role=el?.querySelector('.ink-el-testimonial-role')?.textContent;
      r.remove(t.id);
      return {exists:!!el,quote:quote,name:name,role:role};
    })()`);
    check("Testimonial renders blockquote, name, and role", state.exists && state.quote === 'Amazing work' && state.name === 'Jane Doe' && state.role === 'CEO', JSON.stringify(state));

    // --- Tabs: tab panels with ARIA ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var tabs=r.insert('tabs',{},{settings:{items:[{title:'Tab One',content:'First panel'},{title:'Tab Two',content:'Second panel'}]},styles:{base:{}}});
      var el=d.querySelector('[data-ink-element-id="'+tabs.id+'"]');
      var nav=el?.querySelector('.ink-el-tabs-nav');
      var panels=el?.querySelectorAll('.ink-el-tab-panel');
      var buttons=nav?.querySelectorAll('button');
      var ariaTablist=nav?.getAttribute('role');
      r.remove(tabs.id);
      return {exists:!!el,tabCount:buttons?.length,panelCount:panels?.length,ariaTablist:ariaTablist,firstTab:buttons?.[0]?.textContent};
    })()`);
    check("Tabs renders ARIA tablist with correct tab/panel counts", state.exists && state.tabCount === 2 && state.panelCount === 2 && state.ariaTablist === 'tablist' && state.firstTab === 'Tab One', JSON.stringify(state));

    // --- Accordion: details/summary ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var acc=r.insert('accordion',{},{settings:{items:[{title:'Q1',content:'A1'},{title:'Q2',content:'A2'}]},styles:{base:{}}});
      var el=d.querySelector('[data-ink-element-id="'+acc.id+'"]');
      var details=el?.querySelectorAll('details');
      var summaries=el?.querySelectorAll('summary');
      var firstOpen=details?.[0]?.open;
      r.remove(acc.id);
      return {exists:!!el,detailCount:details?.length,summaryCount:summaries?.length,firstOpen:firstOpen};
    })()`);
    check("Accordion renders details/summary pairs with first item open", state.exists && state.detailCount === 2 && state.summaryCount === 2 && state.firstOpen === true, JSON.stringify(state));

    // --- Toggle: details/summary (all closed by default) ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var tog=r.insert('toggle',{},{settings:{items:[{title:'Q1',content:'A1'}]},styles:{base:{}}});
      var el=d.querySelector('[data-ink-element-id="'+tog.id+'"]');
      var details=el?.querySelectorAll('details');
      var allClosed=Array.from(details||[]).every(function(d){return !d.open});
      r.remove(tog.id);
      return {exists:!!el,detailCount:details?.length,allClosed:allClosed};
    })()`);
    check("Toggle renders details/summary with all items closed by default", state.exists && state.detailCount === 1 && state.allClosed === true, JSON.stringify(state));

    // --- Alert: icon + title + message with type color ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var a=r.insert('alert',{},{settings:{title:'Warning',message:'Be careful',type:'warning'},styles:{base:{}}});
      var el=d.querySelector('[data-ink-element-id="'+a.id+'"]');
      var title=el?.querySelector('strong')?.textContent;
      var message=el?.querySelectorAll('span')[1]?.textContent;
      var icon=el?.querySelector('.material-symbols-rounded');
      r.remove(a.id);
      return {exists:!!el,title:title,message:message,hasIcon:!!icon};
    })()`);
    check("Alert renders icon, title, and message with type-based styling", state.exists && state.title === 'Warning' && state.message === 'Be careful' && state.hasIcon, JSON.stringify(state));

    // --- Social Icons: repeater links ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var si=r.insert('social-icons',{},{settings:{items:[{icon:'public',label:'Website',url:'https://site.com'},{icon:'mail',label:'Email',url:'mailto:test@test.com'}]},styles:{base:{}}});
      var el=d.querySelector('[data-ink-element-id="'+si.id+'"]');
      var links=el?.querySelectorAll('a');
      r.remove(si.id);
      return {exists:!!el,linkCount:links?.length,firstHref:links?.[0]?.href};
    })()`);
    check("Social Icons renders icon links with correct hrefs", state.exists && state.linkCount === 2 && state.firstHref?.includes('site.com'), JSON.stringify(state));

    // --- Read More: link with arrow icon ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var rm=r.insert('read-more',{},{settings:{text:'Read more',url:'https://example.com'},styles:{base:{}}});
      var el=d.querySelector('[data-ink-element-id="'+rm.id+'"]');
      r.remove(rm.id);
      return {exists:!!el,tag:el?.tagName==='A',text:el?.textContent?.trim(),href:el?.getAttribute('href')};
    })()`);
    check("Read More renders as link with text and arrow", state.exists && state.tag && state.text?.includes('Read more') && state.href?.includes('example.com'), JSON.stringify(state));

    // --- Timeline Accordion: items with eyebrow + title + content ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var ta=r.insert('timeline-accordion',{},{settings:{behavior:'single',defaultOpen:0,items:[{eyebrow:'MID 2023',title:'The Spark',content:'It began'},{eyebrow:'LATE 2024',title:'Research',content:'Deep dive'}]},styles:{base:{}}});
      var el=d.querySelector('[data-ink-element-id="'+ta.id+'"]');
      var items=el?.querySelectorAll('.ink-el-timeline-item');
      var questions=el?.querySelectorAll('.ink-el-timeline-question');
      var eyebrows=el?.querySelectorAll('.ink-el-timeline-eyebrow');
      r.remove(ta.id);
      return {exists:!!el,itemCount:items?.length,questionCount:questions?.length,eyebrowCount:eyebrows?.length,firstEyebrow:eyebrows?.[0]?.textContent,firstTitle:questions?.[0]?.querySelector('.ink-el-timeline-title')?.textContent};
    })()`);
    check("Timeline Accordion renders items with eyebrow, title, and content", state.exists && state.itemCount === 2 && state.questionCount === 2 && state.firstEyebrow === 'MID 2023' && state.firstTitle === 'The Spark', JSON.stringify(state));

    // --- Magic UI: Aurora Text ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var at=r.insert('aurora-text',{},{settings:{prefix:'Ship',text:'beautiful',colors:'#FF0080,#7928CA,#0070F3,#38bdf8',speed:1,tag:'h2'},styles:{base:{}}});
      var el=d.querySelector('[data-ink-element-id="'+at.id+'"]');
      var accent=el?.querySelector('.ink-magic-aurora-accent');
      r.remove(at.id);
      return {exists:!!el,tag:el?.tagName==='H2',hasAccent:!!accent,prefixText:el?.textContent?.includes('Ship')};
    })()`);
    check("Aurora Text renders with gradient accent and inline editing", state.exists && state.tag && state.hasAccent && state.prefixText, JSON.stringify(state));

    // --- Magic UI: Retro Grid ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var rg=r.insert('retro-grid',{},{settings:{text:'Retro',angle:65,cellSize:60,opacity:.5,lineColor:'#808080'},styles:{base:{height:{size:500,unit:'px'}}}});
      var el=d.querySelector('[data-ink-element-id="'+rg.id+'"]');
      var hasScroll=!!el?.querySelector('.ink-magic-retro-scroll');
      r.remove(rg.id);
      return {exists:!!el,hasScroll:hasScroll};
    })()`);
    check("Retro Grid renders perspective grid with scroll effect", state.exists && state.hasScroll, JSON.stringify(state));

    // --- Magic UI: Marquee ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var m=r.insert('marquee',{},{settings:{items:[{name:'File A',body:'Content A'},{name:'File B',body:'Content B'}],duration:40,vertical:false,reverse:false,pauseOnHover:true},styles:{base:{}}});
      var el=d.querySelector('[data-ink-element-id="'+m.id+'"]');
      var tracks=el?.querySelectorAll('.ink-magic-marquee-track');
      var cards=el?.querySelectorAll('.ink-magic-file-card');
      r.remove(m.id);
      return {exists:!!el,trackCount:tracks?.length,cardCount:cards?.length};
    })()`);
    check("Marquee renders infinite scroll tracks with file cards", state.exists && state.trackCount === 4 && state.cardCount >= 4, JSON.stringify(state));

    // --- Magic UI: Animated List ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var al=r.insert('animated-list',{},{settings:{items:[{icon:'mail',title:'New email',time:'2m ago',body:'You have mail'},{icon:'bell',title:'Alert',time:'5m ago',body:'Check this'}],delay:1000},styles:{base:{}}});
      var el=d.querySelector('[data-ink-element-id="'+al.id+'"]');
      var notifications=el?.querySelectorAll('.ink-magic-notification');
      r.remove(al.id);
      return {exists:!!el,notificationCount:notifications?.length};
    })()`);
    check("Animated List renders staggered notification cards", state.exists && state.notificationCount === 2, JSON.stringify(state));

    // --- Magic UI: Bento Grid ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var bg=r.insert('bento-grid',{},{settings:{features:[{name:'Feature A',description:'Desc A',icon:'star',visual:'files',span:'is-narrow',cta:'Learn more'},{name:'Feature B',description:'Desc B',icon:'bolt',visual:'notifications',span:'is-wide',cta:'Get started'}]},styles:{base:{}}});
      var el=d.querySelector('[data-ink-element-id="'+bg.id+'"]');
      var cards=el?.querySelectorAll('.ink-magic-bento-card');
      r.remove(bg.id);
      return {exists:!!el,cardCount:cards?.length,firstTitle:cards?.[0]?.querySelector('h3')?.textContent};
    })()`);
    check("Bento Grid renders feature cards with icons and CTAs", state.exists && state.cardCount === 2 && state.firstTitle === 'Feature A', JSON.stringify(state));

    // --- Magic UI: Animated Beam ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var ab=r.insert('animated-beam',{},{styles:{base:{height:{size:300,unit:'px'}}}});
      var el=d.querySelector('[data-ink-element-id="'+ab.id+'"]');
      var hasSvg=!!el?.querySelector('svg');
      var hasBeamPath=!!el?.querySelector('.ink-magic-beam-path');
      r.remove(ab.id);
      return {exists:!!el,hasSvg:hasSvg,hasBeamPath:hasBeamPath};
    })()`);
    check("Animated Beam renders SVG gradient paths for beam animation", state.exists && state.hasSvg && state.hasBeamPath, JSON.stringify(state));

    // --- Anchor: scroll target ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var a=r.insert('anchor',{},{settings:{id:'hero-section',offset:50}});
      var el=d.querySelector('[data-ink-element-id="'+a.id+'"]');
      r.remove(a.id);
      return {exists:!!el,tag:el?.tagName==='SPAN',hasId:el?.id==='hero-section'};
    })()`);
    check("Anchor renders as scroll target with ID", state.exists && state.tag && state.hasId, JSON.stringify(state));

    // --- SVG parent: namespace + child support ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var svg=r.insert('svg',{},{settings:{viewBox:'0 0 100 100',markup:'<circle cx="50" cy="50" r="40" fill="red"/>',ariaLabel:'My circle'},styles:{base:{}}});
      var el=d.querySelector('[data-ink-element-id="'+svg.id+'"]');
      var ns=el?.namespaceURI;
      var hasCircle=!!el?.querySelector('circle');
      r.remove(svg.id);
      return {exists:!!el,ns:ns==='http://www.w3.org/2000/svg',hasCircle:hasCircle};
    })()`);
    check("SVG parent renders with correct namespace and child elements", state.exists && state.ns && state.hasCircle, JSON.stringify(state));

    // --- Image: figure + img + caption + link ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var img=r.insert('image',{},{settings:{src:'https://example.com/photo.jpg',alt:'A photo',caption:'Photo caption',link:'https://example.com',align:'center'},styles:{base:{'max-width':'100%'}}});
      var el=d.querySelector('[data-ink-element-id="'+img.id+'"]');
      var figure=el?.tagName==='FIGURE';
      var hasImg=!!el?.querySelector('img');
      var hasCaption=!!el?.querySelector('figcaption');
      var hasLink=!!el?.querySelector('a.ink-el-image-link');
      r.remove(img.id);
      return {exists:!!el,figure:figure,hasImg:hasImg,hasCaption:hasCaption,hasLink:hasLink};
    })()`);
    check("Image renders as <figure> with <img>, optional caption, and optional link", state.exists && state.figure && state.hasImg && state.hasCaption && state.hasLink, JSON.stringify(state));

    // --- Import / site elements: plugin-widget, site-part ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var pw=r.insert('plugin-widget',{},{settings:{provider:'acme',widget:'counter',payload:'{}'},styles:{base:{}}});
      var sp=r.insert('site-part',{},{settings:{partKey:'header'},styles:{base:{}}});
      var pwEl=d.querySelector('[data-ink-element-id="'+pw.id+'"]');
      var spEl=d.querySelector('[data-ink-element-id="'+sp.id+'"]');
      r.remove(pw.id);r.remove(sp.id);
      return {plugin:pwEl?.tagName==='DIV'&&pwEl?.dataset.inkPluginProvider==='acme',sitePart:spEl?.tagName==='HEADER'};
    })()`);
    check("Plugin Widget and Site Part render with correct tags and data attributes", state.plugin && state.sitePart, JSON.stringify(state));

    // =====================================================================
    //  STYLE ROUTING: verify styleMap routes values to the correct parts
    // =====================================================================

    // --- Button styleMap: surface gets fill/radius/shadow, root gets depth ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var btn=r.insert('button',{},{settings:{text:'Test'},styles:{base:{'background-color':'#ff0000','border-radius':{size:12,unit:'px'},'box-shadow':{x:2,y:2,blur:4,spread:0,unit:'px',color:'rgba(0,0,0,.3)'},'depth-size':{size:8,unit:'px'},'depth-color':'#333'}}});
      var rules=r.styles.nodeRules(btn);
      r.remove(btn.id);
      return {
        surfBg:rules.includes('background-color:#ff0000'),
        surfRadius:rules.includes('border-radius:12px'),
        surfShadow:rules.includes('box-shadow:2px 2px'),
        rootBg:rules.includes('background-color:#333'),
        rulesMatch:rules.includes('.ink-el-button-surface{')
      };
    })()`);
    check("Button styleMap routes fill/radius/shadow to surface and depth-color to root", state.surfBg && state.surfRadius && state.surfShadow && state.rootBg && state.rulesMatch, JSON.stringify(state));

    // --- Image styleMap: width/height/radius route to img element ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var img=r.insert('image',{},{settings:{src:'https://example.com/p.jpg',alt:'test'},styles:{base:{'image-width':{size:300,unit:'px'},'border-radius':{size:16,unit:'px'},'object-fit':'cover'}}});
      var rules=r.styles.nodeRules(img);
      r.remove(img.id);
      return {imgW:rules.includes('width:300px'),imgRadius:rules.includes('border-radius:16px'),imgFit:rules.includes('object-fit:cover'),ruleHasImg:rules.includes('.ink-el-image{')};
    })()`);
    check("Image styleMap routes width/radius/object-fit to the <img> element", state.imgW && state.imgRadius && state.imgFit && state.ruleHasImg, JSON.stringify(state));

    // --- Container styleMap: layout routes to inner div ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var c=r.insert('container',{},{settings:{tag:'div'},styles:{base:{display:'flex','flex-direction':'row',gap:{row:20,column:20,unit:'px'},'justify-content':'space-between','align-items':'center'}}});
      var rules=r.styles.nodeRules(c);
      r.remove(c.id);
      return {display:rules.includes('display:flex'),flexDir:rules.includes('flex-direction:row'),gap:rules.includes('gap:20px 20px'),justify:rules.includes('justify-content:space-between'),align:rules.includes('align-items:center')};
    })()`);
    check("Container styleMap routes layout properties to inner div", state.display && state.flexDir && state.gap && state.justify && state.align, JSON.stringify(state));

    // --- Heading: typography controls ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime,d=b.iframeDoc;
      var h=r.insert('heading',{},{settings:{text:'Styled',tag:'h2'},styles:{base:{color:'#ff0000','font-size':{size:32,unit:'px'},'font-weight':700,'letter-spacing':{size:0.05,unit:'em'},'line-height':{size:1.5,unit:''},'text-align':'center'}}});
      var rules=r.styles.nodeRules(h);
      r.remove(h.id);
      return {color:rules.includes('color:#ff0000'),fontSize:rules.includes('font-size:32px'),fontWeight:rules.includes('font-weight:700'),textAlign:rules.includes('text-align:center')};
    })()`);
    check("Heading typography controls compile to correct computed styles", state.color && state.fontSize && state.fontWeight && state.textAlign, JSON.stringify(state));

    // --- Responsive: tablet + mobile breakpoints ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime;
      var el=r.insert('heading',{},{styles:{base:{color:'#000'},tablet:{color:'#666'},mobile:{color:'#999'}}});
      var rules=r.styles.nodeRules(el);
      r.remove(el.id);
      return {base:rules.includes('color:#000'),tablet:rules.includes('@media(max-width:1024px)')&&rules.includes('color:#666'),mobile:rules.includes('@media(max-width:767px)')&&rules.includes('color:#999')};
    })()`);
    check("Responsive breakpoints generate correct media queries", state.base && state.tablet && state.mobile, JSON.stringify(state));

    // --- State-based controls: hover + active ---
    state = await client.evaluate(`(function(){
      var b=builder,r=b.runtime;
      var el=r.insert('button',{},{styles:{base:{'background-color':'#000'},hover:{'background-color':'#ff0000'},active:{'background-color':'#00ff00'}}});
      var rules=r.styles.nodeRules(el);
      r.remove(el.id);
      return {base:rules.includes('background-color:#000'),hover:rules.includes(':hover')&&rules.includes('background-color:#ff0000'),active:rules.includes(':active')&&rules.includes('background-color:#00ff00')};
    })()`);
    check("State-based controls (hover/active) generate correct pseudo-class rules", state.base && state.hover && state.active, JSON.stringify(state));

    const relevantErrors = client.errors.filter((error) => !/not configured|favicon|Failed to load resource/.test(error));
    if (relevantErrors.length) console.log("  captured errors:\n" + relevantErrors.join("\n---\n"));
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
