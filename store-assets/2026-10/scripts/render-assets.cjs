const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os');
const root=path.resolve(__dirname,'../../..'),out=path.resolve(__dirname,'..');
const font=path.join(root,'assets/fonts/Inter.ttf'),cache=fs.mkdtempSync(path.join(os.tmpdir(),'pendum-font-'));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
fs.writeFileSync(path.join(cache,'fonts.conf'),`<fontconfig><dir>${path.dirname(font)}</dir><cachedir>${cache}</cachedir></fontconfig>`);process.env.FONTCONFIG_FILE=path.join(cache,'fonts.conf');
const sharp=require(path.join(root,'node_modules/sharp')),d=JSON.parse(fs.readFileSync(path.join(out,'listing.json'))),body=d.brand==='Pendum Body';
const svg=(w,h,s)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${s}</svg>`);
async function text(s,size,color,weight=400,max=1200){const r=await sharp({text:{text:`<span foreground="${color}" weight="${weight}">${esc(s)}</span>`,font:`Inter ${size}`,fontfile:font,rgba:true,dpi:72}}).png().toBuffer({resolveWithObject:true});if(r.info.width>max)throw Error('Text too wide: '+s);return r.data;}
const heads=body?[['See the','direction.'],['Beyond','the scale.'],['Your progress,','in perspective.'],['Put numbers','in context.'],['Make it','yours.']]:[['Every drink,','in view.'],['Your favorites.','One tap.'],['See your','daily rhythm.'],['Keep your','log accurate.'],['A routine','that fits.']];
const manifest=[],composition=[];
async function check(file,w,h){const p=path.join(out,file),m=await sharp(p).metadata();if(m.width!==w||m.height!==h||m.hasAlpha||m.channels!==3)throw Error('Invalid '+file);manifest.push({file,width:w,height:h,mode:'RGB',bytes:fs.statSync(p).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')});}
(async()=>{
for(const platform of ['ios','android']){
 const ios=platform==='ios',w=ios?1320:1080,h=ios?2868:1920,sw=ios?1016:776,b=ios?20:17,y=ios?544:445,r=ios?124:80,folder=ios?'apple/iphone-6.9':'google-play/phone';fs.mkdirSync(path.join(out,folder),{recursive:true});const thumbs=[];
 for(const [i,s] of d.screenshotCaptions.entries()){
  const source=path.join(out,'raw',platform,s.file+'.png');if(!fs.existsSync(source))continue;
  const m=await sharp(source).metadata();if(m.width!==w||m.height!==h)throw Error('Capture size '+source);
  const screen=await sharp(source).resize({width:sw}).png().toBuffer({resolveWithObject:true}),sh=screen.info.height,bw=sw+2*b,bh=sh+2*b,x=(w-bw)/2;
  const img=await sharp(screen.data).ensureAlpha().composite([{input:svg(sw,sh,`<rect width="${sw}" height="${sh}" rx="${r-b}" fill="white"/>`),blend:'dest-in'}]).png().toBuffer();
  const layers=[{input:svg(w,h,`<rect x="${x-3}" y="${y-3}" width="${bw+6}" height="${bh+6}" rx="${r}" fill="#82939b"/><rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="${r}" fill="#080d12"/>`),left:0,top:0},{input:img,left:x+b,top:y+b}];
  const margin=ios?100:78,sz=ios?100:78;
  layers.push({input:await text(d.brand.toUpperCase(),ios?27:21,'#A9BDC8',600,w-2*margin),left:margin,top:ios?66:48});
  for(let j=0;j<2;j++)layers.push({input:await text(heads[i][j],sz,j?'#54DCEB':'#F6FAFC',700,w-2*margin),left:margin,top:(ios?156:123)+j*(ios?122:94)});
  layers.push({input:await text(s.subhead.replace('Personal goals, units and reminder settings.','Personal goals, units and settings.'),ios?30:24,'#BED1D9',400,w-2*margin),left:margin,top:ios?424:335});
  const file=folder+'/'+s.file+'.png';await sharp(path.join(out,'design/teal-background.png')).resize(w,h,{fit:'cover'}).composite(layers).flatten({background:'#071017'}).removeAlpha().png().toFile(path.join(out,file));await check(file,w,h);
  composition.push({file,source:`raw/${platform}/${s.file}.png`,source_sha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),treatment:'Native capture, proportional scaling and rounded frame. No app UI redrawn.'});
  thumbs.push({input:await sharp(path.join(out,file)).resize(264).png().toBuffer(),left:i*284,top:0});
 }
 if(thumbs.length)await sharp({create:{width:1400,height:ios?574:470,channels:3,background:'#10202A'}}).composite(thumbs).jpeg({quality:92}).toFile(path.join(out,platform+'-preview.jpg'));
}
const watchSource=path.join(out,'raw/watch/01-favorites.png');
if(fs.existsSync(watchSource)){
 const file='apple/watch-46mm/01-favorites.png';fs.mkdirSync(path.dirname(path.join(out,file)),{recursive:true});
 await sharp(watchSource).flatten({background:'#000000'}).removeAlpha().png().toFile(path.join(out,file));await check(file,416,496);
 composition.push({file,source:'raw/watch/01-favorites.png',source_sha256:crypto.createHash('sha256').update(fs.readFileSync(watchSource)).digest('hex'),treatment:'Native watchOS capture with fictional cached companion data, exported as opaque RGB. No UI redrawn.'});
}
for(const [file,size] of [['apple/icon-1024.png',1024],['google-play/icon-512.png',512]]){await sharp(path.join(root,'assets/images/icon.png')).resize(size,size).flatten({background:'#22d3ee'}).removeAlpha().png().toFile(path.join(out,file));await check(file,size,size);}
const feature=svg(1024,500,`<defs><linearGradient id="bg"><stop stop-color="#071017"/><stop offset="1" stop-color="#0a3542"/></linearGradient></defs><rect width="1024" height="500" fill="url(#bg)"/><g opacity=".18" stroke="#54DCEB" stroke-width="2"><path d="M700 120V390M750 120V390M800 120V390M850 120V390M900 120V390"/><path d="M690 350H940M690 300H940M690 250H940M690 200H940"/></g>${body?'<path d="M690 325L735 310L780 318L825 270L870 280L920 235" stroke="#54DCEB" stroke-width="6" fill="none"/>':'<path d="M735 380V285M795 380V240M855 380V180M915 380V210" stroke="#54DCEB" stroke-width="38"/>'}`);
const slogan=body?['More than','the scale.']:['Every drink.','Your routine.'];
await sharp(feature).composite([{input:await text(d.brand,31,'#A9BDC8',600,560),left:74,top:81},{input:await text(slogan[0],65,'#F6FAFC',700,560),left:70,top:161},{input:await text(slogan[1],65,'#54DCEB',700,560),left:70,top:239},{input:await text(body?'Weight · Measurements · Photos':'Drinks · Goals · Reminders',24,'#BED1D9',400,560),left:74,top:353}]).flatten().removeAlpha().png().toFile(path.join(out,'google-play/feature-graphic.png'));await check('google-play/feature-graphic.png',1024,500);
fs.writeFileSync(path.join(out,'asset-manifest.json'),JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(path.join(out,'design/composition.json'),JSON.stringify(composition,null,2)+'\n');fs.rmSync(cache,{recursive:true,force:true});console.log(`Validated ${manifest.length} assets for ${d.brand}.`);
})();
