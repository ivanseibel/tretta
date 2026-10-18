import { writeFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import { createRoom, joinRoom, readyAll, setNextDeck } from './room';
import { circuitFourDeck, eightSeatValidationDeck } from './deck';

const evidence = '/var/folders/r_/xrvhskhx45l6n66k99kzs61r0000gn/T/tretta-t012-validation-fq0mhz5a';

test('revisão: badges e texto em oito assentos no celular durante pausa', async ({ browser }) => {
  const contexts = await Promise.all(Array.from({length: 8}, () => browser.newContext({viewport: {width: 320, height: 900}})));
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  const host = pages[0]!;
  try {
    const invite = await createRoom(host, 'Ana');
    for (let i=1;i<8;i++) await joinRoom(pages[i]!,invite, i === 7 ? 'WWWWWWWWWWWWWWWWWWWWWWWx' : `Participante ${i}`,'lobo');
    await setNextDeck(host,eightSeatValidationDeck());
    await readyAll(host,...pages.slice(1));
    await expect(host.getByTestId('seat-circuit').locator('.seat')).toHaveCount(8);
    await pages[2]!.evaluate(() => window.__trettaTest!.disconnect());
    await expect(host.getByTestId('pause-panel')).toBeVisible();
    const data = await host.getByTestId('seat-circuit').evaluate(circuit => {
      const box = (node: Element) => {const r=node.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      const seats = [...circuit.querySelectorAll('.seat')].map(seat => ({
        name:seat.querySelector('.participant-name')?.textContent,
        box:box(seat),
        children:[...seat.querySelectorAll('.participant-name,.hand-count,.tag,.status')].map(child => ({text:child.textContent,box:box(child),font:getComputedStyle(child).fontSize})),
      }));
      const outside = seats.flatMap(seat => seat.children.filter(child => child.box.left < seat.box.left-1 || child.box.right > seat.box.right+1).map(child=>({seat:seat.name,text:child.text,child:child.box,parent:seat.box})));
      return {seats,outside};
    });
    writeFileSync(`${evidence}/mobile-badges.json`,JSON.stringify(data,null,2));
    await host.screenshot({path:`${evidence}/mobile-pause.png`,fullPage:true});
    expect(data.outside).toEqual([]);
  } finally {await Promise.all(contexts.map(context=>context.close()));}
});

test('revisão: resumo textual indica o percurso no sentido invertido',async ({browser}) => {
  const contexts = await Promise.all(Array.from({length:4},()=>browser.newContext()));
  const pages=await Promise.all(contexts.map(context=>context.newPage()));
  const host=pages[0]!;
  try {
    const invite=await createRoom(host,'Ana');
    for(const [i,name] of ['Bia','Cai','Davi'].entries())await joinRoom(pages[i+1]!,invite,name);
    await setNextDeck(host,circuitFourDeck());
    await readyAll(host,...pages.slice(1));
    await expect(host.getByTestId('turn-indicator')).toHaveText('Sua vez');
    const before=await host.getByTestId('circuit-order').textContent();
    await host.getByTestId('card-red-reverse-1').click();
    await host.getByTestId('play-button').click();
    await expect(host.getByTestId('circuit-direction')).toContainText('anti-horário');
    const after=await host.getByTestId('circuit-order').textContent();
    writeFileSync(`${evidence}/accessible-order.json`,JSON.stringify({before,after,expectedRoute:['Ana','Davi','Cai','Bia']},null,2));
    expect(after).toMatch(/Ana.*Davi.*Cai.*Bia/);
  } finally {await Promise.all(contexts.map(context=>context.close()));}
});
