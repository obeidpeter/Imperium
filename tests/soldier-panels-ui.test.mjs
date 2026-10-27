import test from 'node:test';
import assert from 'node:assert/strict';
import {bootApp} from './inert-app.mjs';

// Presses a key on the page as a player would: the panel keys work in camp.
function press(app,code,key){
  const event=new Event('keydown',{bubbles:true,cancelable:true});
  Object.defineProperties(event,{code:{value:code},key:{value:key},shiftKey:{value:false},ctrlKey:{value:false},metaKey:{value:false},altKey:{value:false},repeat:{value:false}});
  app.doc.body.dispatchEvent(event);return event;
}

async function beginTurnBased(app){
  await app.click('new');
  // These panel tests use an inert DOM without a live canvas. Choose the
  // classic controls explicitly; normal real-time onboarding has browser QA.
  app.find('input[name="new-play-mode"][value="realtime"]').checked=false;
  await app.change('input[name="new-play-mode"][value="turns"]',{checked:true});
  await app.click('begin');
}

test('the soldier panels open from the camp card and the panel keys, and their commands go through the rules',async t=>{
  const app=await bootApp(t,{name:'soldier-panels',settings:{battleView:'2d'}});
  await beginTurnBased(app);
  assert.match(app.page(),/YOUR SOLDIER/,'the camp shows the soldier card');
  // I opens the kit; the pack grid and the worn places are there.
  assert.equal(press(app,'KeyI','i').defaultPrevented,true);await app.settle();
  assert.equal(app.modal().open,true);assert.match(app.modal().innerHTML,/Pack/);assert.match(app.modal().innerHTML,/Wool tunic/);
  await app.click('close-modal');
  // C shows the attributes and the numbers they produce.
  press(app,'KeyC','c');await app.settle();assert.match(app.modal().innerHTML,/Strength/);assert.match(app.modal().innerHTML,/Defence/);
  await app.click('close-modal');
  // The quartermaster: draw pay, buy a cloak, wear it from the pack.
  await app.click('soldier-panel','quartermaster');
  const before=app.saved().soldier.denarii;
  app.find('[data-cmd="soldier"][data-kind="pay"]').dispatchEvent(new Event('click',{bubbles:true,cancelable:true}));await app.settle();
  assert.equal(app.saved().soldier.denarii,before+20,'pay drawn and saved');
  app.find('[data-cmd="soldier"][data-kind="buy"][data-item="sagum"]').dispatchEvent(new Event('click',{bubbles:true,cancelable:true}));await app.settle();
  const cloak=app.saved().soldier.pack.find(p=>p.id==='sagum');assert.ok(cloak,'the cloak is in the pack');
  await app.click('close-modal');press(app,'KeyI','i');await app.settle();
  await app.click('kit-select',cloak.uid);
  app.find('[data-cmd="soldier"][data-kind="wear"]').dispatchEvent(new Event('click',{bubbles:true,cancelable:true}));await app.settle();
  assert.equal(app.saved().soldier.worn['body:3'],'sagum','worn and saved');
  // A refused command changes nothing: there is no fourth chapter's helmet at the quartermaster's.
  const saved=app.raw();await app.command('soldier');assert.equal(app.raw(),saved);
  await app.click('close-modal');
  // R: the company and standing orders; a preset is saved for the fights to come.
  press(app,'KeyR','r');await app.settle();assert.match(app.modal().innerHTML,/Standing orders/);
  const preset=app.doc.querySelector('[data-cmd="soldier"][data-kind="orders"][data-preset="orderly"]');
  if(preset){preset.dispatchEvent(new Event('click',{bubbles:true,cancelable:true}));await app.settle();
    assert.equal(app.saved().soldier.orders[preset.dataset.companion][0][0],'bind_wounds');}
});

test('refreshing Mission orders keeps navigation, focus and scroll while updating its contents',async t=>{
  const app=await bootApp(t,{name:'mission-refresh-navigation',settings:{battleView:'2d'}});
  await beginTurnBased(app);
  await app.command('soldier-panel','mission');
  const modal=app.modal(),head=app.find('.modal-head'),back=app.find('.modal-back'),close=app.find('.modal-close'),body=app.find('.modal-body');
  const objective=app.find('.mission-orders h3'),title=objective.textContent,saved=app.raw();
  for(const focused of [close,back]){
    focused.focus();modal.scrollTop=120;objective.textContent='Stale orders';
    // The live HUD calls the same panel refresh without opening a new dialog.
    await app.command('soldier-panel','mission');
    assert.ok(app.find('.modal-head')===head,'Refreshing orders must not detach the navigation controls');
    assert.ok(app.find('.modal-back')===back);assert.ok(app.find('.modal-close')===close);
    assert.ok(app.find('.modal-body')===body);assert.ok(app.find('.mission-orders h3')===objective);
    assert.equal(objective.textContent,title,'The contents are still refreshed');
    assert.ok(app.doc.activeElement===focused,'Refresh never steals focus');assert.equal(modal.scrollTop,120);
  }
  assert.equal(app.raw(),saved,'Reading orders does not change the saved game');
  back.dispatchEvent(new Event('click',{bubbles:true,cancelable:true}));await app.settle();
  assert.equal(app.find('#panel-title').textContent,'Menu');assert.equal(modal.dataset.soldier,undefined,'Back ends the mission refresh context');
  await app.click('close-modal');assert.equal(modal.open,false);
});
