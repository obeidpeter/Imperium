/** Public, read-only render diagnostics. Query once per context; never persist
 * hardware identifiers or send them over the network. Masked browsers remain
 * explicitly unknown rather than being counted as hardware-qualified. */
export function renderDeviceReport(gl){
  try{
    const debug=gl.getExtension('WEBGL_debug_renderer_info');
    const renderer=String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)??'Unknown');
    return Object.freeze({renderer,vendor:String(gl.getParameter(debug?.UNMASKED_VENDOR_WEBGL??gl.VENDOR)??'Unknown'),version:String(gl.getParameter(gl.VERSION)??'Unknown'),identity:debug?'unmasked':'privacy-masked',software:/swiftshader|llvmpipe|software rasterizer|microsoft basic render/i.test(renderer),maxTextureSize:gl.getParameter(gl.MAX_TEXTURE_SIZE),maxRenderbufferSize:gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)});
  }catch{return Object.freeze({renderer:'Unavailable',identity:'unavailable',software:null});}
}
