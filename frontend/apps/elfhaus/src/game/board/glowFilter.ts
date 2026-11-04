// Silhouette win glow as a filter (merged / full-reel DragonBones wilds): the art's own alpha, dilated and blurred, in
// fluorescent teal-blue with a white core hugging the edge, drawn UNDER the art. Never a box: it follows the alpha.
import { Filter, GlProgram, defaultFilterVert } from 'pixi.js';
const frag = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize; // highp: must match the filter vertex shader or the program fails to link (the rig vanishes)
uniform float uDist;
uniform float uAmt;
void main(void){
	vec4 src = texture(uTexture, vTextureCoord);
	vec2 px = uInputSize.zw;
	float near = 0.0, far = 0.0;
	for (int i = 0; i < 16; i++) {
		float a = 6.2831853 * float(i) / 16.0; vec2 d = vec2(cos(a), sin(a));
		near = max(near, texture(uTexture, vTextureCoord + d * px * uDist * 0.3).a);
		far += texture(uTexture, vTextureCoord + d * px * uDist * 0.65).a + texture(uTexture, vTextureCoord + d * px * uDist).a;
	}
	far = clamp(far / 20.0, 0.0, 1.0);
	vec3 teal = vec3(0.10, 0.88, 1.0);
	float core = near;
	vec3 gc = mix(teal, vec3(1.0), core * 0.85);
	float ga = max(far, core) * uAmt;
	vec4 glow = vec4(gc * ga, ga);
	finalColor = src + glow * (1.0 - src.a);
}`;
export function glowFilter(dist = 14) {
	const f = new Filter({
		glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment: frag, name: 'elfGlow' }),
		resources: { u: { uDist: { value: dist, type: 'f32' }, uAmt: { value: 1, type: 'f32' } } },
	});
	f.padding = dist + 2;
	return f;
}
export const setGlow = (f: Filter, amt: number) => { (f.resources.u as any).uniforms.uAmt = amt; };
