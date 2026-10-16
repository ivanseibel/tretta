import {expect,test} from './fixtures';
import {twoSkipsDeck} from './deck';
import {createRoom,joinRoom,setNextDeck,readyAll,setEffectVariant,playCard} from './room';

test('efeitos consecutivos com a mesma variação continuam visíveis',async({browser})=>{
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const guest=await browser.newContext({viewport:{width:1280,height:900}});
  const a=await context.newPage();
  const b=await guest.newPage();
  const observations:unknown[]=[];
  try {
    const url=await createRoom(a,'Ana');
    await joinRoom(b,url,'Bia','tucano');
    await setNextDeck(a,twoSkipsDeck());
    await readyAll(a,b);
    await setEffectVariant(a,'brick-wall');
    await playCard(a,'red-skip-1');
    const node=a.getByTestId('auto-effect-blocked');
    await expect(node).toHaveAttribute('data-effect-variant','brick-wall');
    const firstId=await node.getAttribute('data-effect-id');
    await expect.poll(()=>node.evaluate(el=>Number.parseFloat(getComputedStyle(el).opacity)),{timeout:2000,intervals:[50]}).toBeGreaterThan(0.9);
    // Registra o nó e a instância CSS; segunda jogada entra enquanto a primeira animação está ativa.
    await node.evaluate(el=>{
      const w=window as unknown as {__firstEffect?:Element;__firstAnimation?:Animation};
      w.__firstEffect=el;w.__firstAnimation=el.getAnimations()[0];
    });
    await playCard(a,'red-skip-2');
    await expect.poll(()=>node.getAttribute('data-effect-id'),{timeout:5000,intervals:[50]}).not.toBe(firstId);
    const secondId=await node.getAttribute('data-effect-id');
    const start=await node.evaluate(el=>{
      const w=window as unknown as {__firstEffect?:Element;__firstAnimation?:Animation};
      const anim=el.getAnimations()[0];
      return {sameNode:w.__firstEffect===el,sameAnimation:w.__firstAnimation===anim,opacity:getComputedStyle(el).opacity,playState:anim?.playState,currentTime:anim?.currentTime};
    });
    observations.push({firstId,secondId,...start});
    console.log(JSON.stringify({scenario:'segunda apresentação consecutiva',...start}));
    await expect.poll(()=>node.evaluate(el=>Number.parseFloat(getComputedStyle(el).opacity)),{timeout:1800,intervals:[50]}).toBeGreaterThan(0.9);
  } finally {
    await test.info().attach('observations',{body:JSON.stringify(observations,null,2),contentType:'application/json'});
    await context.close();await guest.close();
  }
});
