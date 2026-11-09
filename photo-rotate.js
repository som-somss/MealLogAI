(function(root){'use strict';
 function rotate(source,turns){
  if(typeof source!=='string'||!source)return Promise.reject(Error('NO_PHOTO'));
  if(!Number.isInteger(turns))return Promise.reject(Error('INVALID_ROTATION'));
  const angle=((turns%4)+4)%4;if(!angle)return Promise.resolve(source);
  return new Promise((resolve,reject)=>{const im=new Image();
   if(/^https?:/i.test(source))im.crossOrigin='anonymous';
   im.onload=()=>{try{const w=im.naturalWidth||im.width,h=im.naturalHeight||im.height;if(!(w>0&&h>0))throw Error('IMAGE_DECODE');const canvas=document.createElement('canvas');canvas.width=angle%2?h:w;canvas.height=angle%2?w:h;const ctx=canvas.getContext('2d');if(!ctx)throw Error('CANVAS_UNAVAILABLE');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(angle*Math.PI/2);ctx.drawImage(im,-w/2,-h/2,w,h);const result=canvas.toDataURL('image/jpeg',.9);if(!result.startsWith('data:image/jpeg'))throw Error('IMAGE_ENCODE');resolve(result);}catch(e){reject(e);}};
   im.onerror=()=>reject(Error('IMAGE_DECODE'));im.src=source;
  });
 }
 root.MealLogPhoto={rotate};
})(typeof window==='object'?window:globalThis);
