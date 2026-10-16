# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: orchestrator-consecutive-effects.spec.ts >> efeitos consecutivos com a mesma variação continuam visíveis
- Location: e2e/orchestrator-consecutive-effects.spec.ts:5:1

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0.9
Received:   0

Call Log:
- Timeout 1800ms exceeded while waiting on the predicate
```

# Test source

```ts
  1  | import {expect,test} from './fixtures';
  2  | import {twoSkipsDeck} from './deck';
  3  | import {createRoom,joinRoom,setNextDeck,readyAll,setEffectVariant,playCard} from './room';
  4  | 
  5  | test('efeitos consecutivos com a mesma variação continuam visíveis',async({browser})=>{
  6  |   const context=await browser.newContext({viewport:{width:1280,height:900}});
  7  |   const guest=await browser.newContext({viewport:{width:1280,height:900}});
  8  |   const a=await context.newPage();
  9  |   const b=await guest.newPage();
  10 |   const observations:unknown[]=[];
  11 |   try {
  12 |     const url=await createRoom(a,'Ana');
  13 |     await joinRoom(b,url,'Bia','tucano');
  14 |     await setNextDeck(a,twoSkipsDeck());
  15 |     await readyAll(a,b);
  16 |     await setEffectVariant(a,'brick-wall');
  17 |     await playCard(a,'red-skip-1');
  18 |     const node=a.getByTestId('auto-effect-blocked');
  19 |     await expect(node).toHaveAttribute('data-effect-variant','brick-wall');
  20 |     const firstId=await node.getAttribute('data-effect-id');
  21 |     await expect.poll(()=>node.evaluate(el=>Number.parseFloat(getComputedStyle(el).opacity)),{timeout:2000,intervals:[50]}).toBeGreaterThan(0.9);
  22 |     // Registra o nó e a instância CSS; segunda jogada entra enquanto a primeira animação está ativa.
  23 |     await node.evaluate(el=>{
  24 |       const w=window as unknown as {__firstEffect?:Element;__firstAnimation?:Animation};
  25 |       w.__firstEffect=el;w.__firstAnimation=el.getAnimations()[0];
  26 |     });
  27 |     await playCard(a,'red-skip-2');
  28 |     await expect.poll(()=>node.getAttribute('data-effect-id'),{timeout:5000,intervals:[50]}).not.toBe(firstId);
  29 |     const secondId=await node.getAttribute('data-effect-id');
  30 |     const start=await node.evaluate(el=>{
  31 |       const w=window as unknown as {__firstEffect?:Element;__firstAnimation?:Animation};
  32 |       const anim=el.getAnimations()[0];
  33 |       return {sameNode:w.__firstEffect===el,sameAnimation:w.__firstAnimation===anim,opacity:getComputedStyle(el).opacity,playState:anim?.playState,currentTime:anim?.currentTime};
  34 |     });
  35 |     observations.push({firstId,secondId,...start});
  36 |     console.log(JSON.stringify({scenario:'segunda apresentação consecutiva',...start}));
> 37 |     await expect.poll(()=>node.evaluate(el=>Number.parseFloat(getComputedStyle(el).opacity)),{timeout:1800,intervals:[50]}).toBeGreaterThan(0.9);
     |                                                                                                                             ^ Error: expect(received).toBeGreaterThan(expected)
  38 |   } finally {
  39 |     await test.info().attach('observations',{body:JSON.stringify(observations,null,2),contentType:'application/json'});
  40 |     await context.close();await guest.close();
  41 |   }
  42 | });
  43 | 
```