import json,pathlib,time,base64
root=pathlib.Path('docs/work/reports/assets/T016/concepts')
results=[]
for concept in 'abc':
 for w,h,state in [(412,915,'s2'),(1280,800,'s2'),(412,915,'s1')]:
  cdp('Emulation.setDeviceMetricsOverride',width=w,height=h,deviceScaleFactor=1,mobile=False)
  cdp('Page.navigate',url='file://'+str((root/'source/concepts.html').resolve())+'?concept='+concept+'&state='+state)
  time.sleep(.2)
  m=js('window.__measure()');m.update(concept=concept,state=state)
  m['details']=js("""(()=>{const b=e=>{const a=e.getBoundingClientRect();return {x:a.x,y:a.y,w:a.width,h:a.height}};return {seats:[...document.querySelectorAll('.seat')].map(b),cards:[...document.querySelectorAll('.cards .card')].map(b),targets:[...document.querySelectorAll('button')].filter(e=>e.getClientRects().length).map(b),fonts:[...document.querySelectorAll('.turn-text,.dir-text,.count-num,.count-lbl,.seat-name,.tag-turn,.card-name,.pile-lbl')].map(e=>({type:e.className,font:parseFloat(getComputedStyle(e).fontSize),text:e.textContent.trim()})),strip:b(document.querySelector('.strip')),handScroll:document.querySelector('.cards')?{client:document.querySelector('.cards').clientWidth,scroll:document.querySelector('.cards').scrollWidth}:null}})()""")
  name=f'{concept}-{w}-s0{state[-1]}.png'
  (root/name).write_bytes(base64.b64decode(cdp('Page.captureScreenshot',format='png',captureBeyondViewport=False)['data']))
  if w==412 and state=='s2':
   b=m['details']['strip']
   cdp('Emulation.setDeviceMetricsOverride',width=w,height=h,deviceScaleFactor=2,mobile=False)
   (root/f'{concept}-closeup.png').write_bytes(base64.b64decode(cdp('Page.captureScreenshot',format='png',captureBeyondViewport=False,clip={'x':b['x']-8,'y':b['y']-8,'width':b['w']+16,'height':b['h']+16,'scale':1})['data']))
  results.append(m)
(root/'measurements.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print([{'concept':m['concept'],'w':m['viewport']['w'],'s':m['state'],'slack':m['slack']} for m in results])
