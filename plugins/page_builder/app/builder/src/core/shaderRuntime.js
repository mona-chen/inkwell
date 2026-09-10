import { SHADER_FRAGMENT, SHADER_HEADER } from './shaderPresets.js';
// This same source runs in the editor and published pages. No external library or network.
export const SHADER_RUNTIME = String.raw`
(function () {
  if (window.__inkShaderRuntimeReady) return;
  window.__inkShaderRuntimeReady = true;
  var mounted = new Map();
  function mount(canvas) {
    var root = canvas.parentElement, settings;
    try { settings = JSON.parse(root.dataset.inkShader || '{}'); } catch (_) { return function() {}; }
    var gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
    if (!gl) {root.dataset.shaderStatus='fallback';return function() {};}
    var frame = 0, disposed = false, visible = true, lost = false, last = 0;
    var reduced = matchMedia('(prefers-reduced-motion: reduce)');
    var vertex = gl.createShader(gl.VERTEX_SHADER), fragment = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(vertex, 'attribute vec2 p; void main(){gl_Position=vec4(p,0.,1.);}');
    var source = ${JSON.stringify(SHADER_FRAGMENT)};
    if(settings.preset==='custom') source=${JSON.stringify(SHADER_HEADER)}+(settings.customCode||'')+'\nvoid main(){gl_FragColor=clamp(inkShader(gl_FragCoord.xy/resolution,time,resolution),0.,1.);}';
    gl.shaderSource(fragment, source);
    gl.compileShader(vertex); gl.compileShader(fragment);
    var program = gl.createProgram(); gl.attachShader(program,vertex); gl.attachShader(program,fragment); gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) { root.dataset.shaderStatus='error';root.dataset.shaderError=gl.getShaderInfoLog(fragment)||gl.getProgramInfoLog(program)||'Shader compilation failed'; gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);return function() {}; }
    gl.useProgram(program);
    var buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    var position=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    var uniforms={};['resolution','time','mode','intensity','grain','a','b','c'].forEach(function(name){uniforms[name]=gl.getUniformLocation(program,name);});
    function color(hex){return [1,3,5].map(function(i){return parseInt(hex.slice(i,i+2),16)/255;});}
    gl.uniform3fv(uniforms.a,color(settings.colorA));gl.uniform3fv(uniforms.b,color(settings.colorB));gl.uniform3fv(uniforms.c,color(settings.colorC));
    gl.uniform1f(uniforms.mode,Math.max(0,['aurora','liquid','waves','grain','moving-gradient','mesh-gradient','water-caustic','nebula','clouds','fractal-noise','moire','glowing-wave','concentric-patterns','pattern-grid'].indexOf(settings.preset)));
    gl.uniform1f(uniforms.intensity,Math.max(0,Math.min(1,Number(settings.intensity)||0)));
    gl.uniform1f(uniforms.grain,Math.max(0,Math.min(.3,Number(settings.grain)||0)));
    function draw(now) {
      frame=0;if(disposed||lost||!visible||document.hidden)return;
      if(now-last>=32||!last){
        last=now;
        var ratio=Math.min(window.devicePixelRatio||1,1.5);var width=Math.max(1,Math.min(1920,Math.round(root.clientWidth*ratio)));var height=Math.max(1,Math.min(1080,Math.round(root.clientHeight*ratio)));
        if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);}
        gl.uniform2f(uniforms.resolution,width,height);gl.uniform1f(uniforms.time,reduced.matches||settings.animate===false?4:now*.001*Math.max(0,Math.min(2,Number(settings.speed)||0)));
        gl.drawArrays(gl.TRIANGLES,0,6);canvas.style.opacity='1';root.dataset.shaderStatus='ready';
      }
      if(!reduced.matches&&settings.animate!==false&&Number(settings.speed)>0)frame=requestAnimationFrame(draw);
    }
    function wake(){cancelAnimationFrame(frame);last=0;frame=requestAnimationFrame(draw);}
    var resize=new ResizeObserver(wake);resize.observe(root);
    var intersection=new IntersectionObserver(function(entries){visible=entries[0].isIntersecting;wake();});intersection.observe(root);
    function onLost(event){event.preventDefault();lost=true;cancelAnimationFrame(frame);canvas.style.opacity='0';root.dataset.shaderStatus='fallback';}
    function onRestore(){dispose(false);mounted.delete(canvas);mounted.set(canvas,mount(canvas));}
    canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestore);
    reduced.addEventListener('change',wake);document.addEventListener('visibilitychange',wake);wake();
    function dispose(release){if(disposed)return;disposed=true;cancelAnimationFrame(frame);resize.disconnect();intersection.disconnect();reduced.removeEventListener('change',wake);document.removeEventListener('visibilitychange',wake);canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestore);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);if(release!==false&&!lost){var extension=gl.getExtension('WEBGL_lose_context');if(extension)extension.loseContext();}}
    return dispose;
  }
  function scan(){mounted.forEach(function(dispose,canvas){if(!canvas.isConnected){dispose();mounted.delete(canvas);}});document.querySelectorAll('[data-ink-shader] > canvas').forEach(function(canvas){if(!mounted.has(canvas))mounted.set(canvas,mount(canvas));});}
  var observer=new MutationObserver(scan);observer.observe(document.body,{childList:true,subtree:true});scan();
})();
`;
