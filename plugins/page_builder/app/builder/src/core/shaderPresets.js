export const SHADER_PRESETS = [
    ['moving-gradient', 'Moving gradient', '#291a53', '#b24fea', '#ffcd79'],
    ['mesh-gradient', 'Mesh gradient', '#080d35', '#5344df', '#f4bacd'],
    ['water-caustic', 'Water caustic', '#087cad', '#2cc5e9', '#d3fbff'],
    ['nebula', 'Nebula', '#030715', '#40347b', '#dcecff'],
    ['clouds', 'Clouds', '#448dcc', '#a9d6f0', '#ffffff'],
    ['fractal-noise', 'Fractal noise', '#172523', '#6d8b74', '#d9d9b6'],
    ['moire', 'Moiré', '#121320', '#9396bc', '#ffffff'],
    ['glowing-wave', 'Glowing wave', '#090e20', '#576be8', '#a8fff4'],
    ['concentric-patterns', 'Concentric patterns', '#201442', '#8d5ad2', '#ffd997'],
    ['pattern-grid', 'Pattern grid', '#112823', '#499b83', '#d3f4c1'],
    ['aurora', 'Aurora', '#171c36', '#8369d8', '#8fe3c5'],
    ['liquid', 'Liquid', '#361325', '#de6c9a', '#f5d4a5'],
    ['waves', 'Waves', '#17234c', '#677ed9', '#afeee1'],
    ['grain', 'Grain', '#282035', '#a383b7', '#eed2b2'],
];
export const CUSTOM_SHADER_EXAMPLE = `vec4 inkShader(vec2 uv, float time, vec2 resolution) {
    float wave = sin(uv.x * 8.0 + time) * 0.12;
    vec3 color = mix(a, b, smoothstep(0.0, 1.0, uv.y + wave));
    color = mix(color, c, 0.2 * sin(uv.x * 3.0 + time) + 0.2);
    return vec4(color, 1.0);
}`;
export function normalizeShader(source = {}) {
    const preset = SHADER_PRESETS.find(([id]) => id === source.preset) || SHADER_PRESETS[0];
    const hex = (value, fallback) => {
        const raw = String(value || '');
        if (/^#[\da-f]{6}$/i.test(raw)) return raw;
        if (/^#[\da-f]{3}$/i.test(raw)) return '#' + [...raw.slice(1)].map((digit) => digit + digit).join('');
        const rgb = /^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/i.exec(raw);
        return rgb ? '#' + rgb.slice(1).map((channel) => Math.min(255, Number(channel)).toString(16).padStart(2, '0')).join('') : fallback;
    };
    return { ...source, preset: source.preset === 'custom' ? 'custom' : preset[0], colorA: hex(source.colorA, preset[2]), colorB: hex(source.colorB, preset[3]), colorC: hex(source.colorC, preset[4]), speed: source.speed ?? .5, intensity: source.intensity ?? .7, grain: source.grain ?? .04, animate: source.animate !== false };
}
export const SHADER_HEADER = 'precision mediump float; uniform vec2 resolution; uniform float time,mode,intensity,grain; uniform vec3 a,b,c;\n';
export const SHADER_FRAGMENT = SHADER_HEADER + `
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,amp=.5;for(int i=0;i<5;i++){v+=amp*noise(p);p=p*2.03+3.7;amp*=.5;}return v;}
void main(){vec2 uv=gl_FragCoord.xy/resolution;vec2 p=(uv-.5)*vec2(resolution.x/resolution.y,1.);float t=time*.3;float v=0.,w=0.;
if(mode<.5){v=sin(p.x*3.+sin(p.y*3.+t)*1.2+t)*.5+.5;w=pow(max(0.,1.-abs(p.y+.18*sin(p.x*4.+t)))*.85,3.);}
else if(mode<1.5){v=sin(p.x*4.+cos(p.y*5.-t)+t)*sin(p.y*3.+sin(p.x*4.+t))*.5+.5;w=sin(length(p+vec2(sin(t),cos(t))*.2)*7.-t)*.5+.5;}
else if(mode<2.5){v=sin((p.y+.2*sin(p.x*3.+t))*10.+t)*.5+.5;w=smoothstep(-.6,.7,p.x+.3*sin(p.y*3.-t));}
else if(mode<3.5){v=smoothstep(-.7,.7,p.x+p.y+.2*sin(t));w=exp(-3.*length(p-vec2(.3*sin(t),.2*cos(t))));}
else if(mode<4.5){vec2 q=p*3.;float f=fbm(q+vec2(t,-t)*.4);v=sin((q.x+f*3.)*2.+t)*.5+.5;w=smoothstep(.4,.9,fbm(q+f*4.-t*.2));}
else if(mode<5.5){v=exp(-2.5*length(p-vec2(.4*sin(t),.25*cos(t))));w=exp(-3.*length(p-vec2(-.45*cos(t*.8),-.3*sin(t))));}
else if(mode<6.5){vec2 q=p*9.;float f=sin(q.x+sin(q.y+t))+sin(q.y+cos(q.x-t));v=.65+.25*sin(f);w=pow(1.-abs(sin(f*1.5+t*.3)),8.);}
else if(mode<7.5){v=pow(fbm(p*4.+t*.06),2.);vec2 cells=uv*vec2(180.,100.);float star=pow(hash(floor(cells)),80.)*pow(max(0.,1.-length(fract(cells)-.5)*2.),4.);w=star+pow(fbm(p*6.-t*.07),4.)*.6;}
else if(mode<8.5){v=fbm(p*3.+vec2(t*.15,0.));w=smoothstep(.35,.8,fbm(p*5.+v*2.+t*.08));}
else if(mode<9.5){v=fbm(p*8.+t*.12);w=fbm(p*16.+vec2(v*2.,t*.08));}
else if(mode<10.5){v=sin(length(p-vec2(.2*sin(t),0.))*100.)*sin(length(p+vec2(.2*cos(t),0.))*100.)*.5+.5;w=v*.4;}
else if(mode<11.5){float d=abs(p.y-.15*sin(p.x*5.+t));v=exp(-d*12.);w=exp(-d*80.);}
else if(mode<12.5){v=sin(length(p)*50.-t*2.)*.5+.5;w=smoothstep(.7,1.,v);}
else{vec2 grid=fract((p+vec2(t*.03))*12.);float d=length(grid-.5);v=smoothstep(.3,.28,d);w=v*(sin(p.x*3.+p.y*4.+t)*.5+.5);}
vec3 color=mix(a,b,clamp(v*intensity+.12,0.,1.));color=mix(color,c,clamp(w*intensity,0.,1.));color+=(hash(gl_FragCoord.xy)-.5)*grain;gl_FragColor=vec4(clamp(color,0.,1.),1.);}`;
export function customShaderSource(code) {
    if (typeof code !== 'string' || code.length > 16000 || !/vec4\s+inkShader\s*\(/.test(code)) throw new Error('Define vec4 inkShader(vec2 uv, float time, vec2 resolution), up to 16,000 characters.');
    if (/\b(while|do)\b/.test(code)) throw new Error('Use fixed, bounded for loops in custom shaders.');
    return SHADER_HEADER + code + '\nvoid main(){gl_FragColor=clamp(inkShader(gl_FragCoord.xy/resolution,time,resolution),0.,1.);}';
}
export function validateCustomShader(code, doc = document) {
    const source = customShaderSource(code); const gl = doc.createElement('canvas').getContext('webgl');
    if (!gl) throw new Error('WebGL is unavailable. Enable graphics acceleration to validate this shader.');
    const shader = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(shader, source); gl.compileShader(shader);
    const error = gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? null : gl.getShaderInfoLog(shader);
    gl.deleteShader(shader); gl.getExtension('WEBGL_lose_context')?.loseContext();
    if (error) throw new Error(error);
}
export function attachShaderFill(element, node) {
    const fill = node.settings.shaderFill;
    if (!fill?.enabled || element.namespaceURI !== 'http://www.w3.org/1999/xhtml' || ['IMG','INPUT','HR','BR','VIDEO','IFRAME','CANVAS'].includes(element.tagName)) return;
    const values = normalizeShader(fill); const host = element.ownerDocument.createElement('span'); host.className = 'ink-shader-fill'; host.dataset.inkShader = JSON.stringify(values); host.setAttribute('aria-hidden', 'true');
    host.style.background = `radial-gradient(ellipse at 75% 25%, ${values.colorC}, transparent 65%), radial-gradient(ellipse at 20% 80%, ${values.colorB}, ${values.colorA})`;
    host.appendChild(element.ownerDocument.createElement('canvas')); element.classList.add('ink-has-shader-fill'); element.prepend(host);
}
