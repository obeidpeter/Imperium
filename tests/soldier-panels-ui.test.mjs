import test from 'node:test';
import assert from 'node:assert/strict';
import {bootApp} from './inert-app.mjs';

// Presses a key on the page as a player would: the panel keys work in camp.
function press(app,code,key){
  const event=new Event('keydown',{bubbles:true,cancelable:true});
  Object.defineProperties(event,{code:{value:code},key:{value:key},shiftKey:{value:false},ctrlKey:{value:false},metaKey:{value:false},altKey:{value:false},repeat:{value:false}});
  app.doc.body.dispatchEvent(event);return event;
}

test('the soldier panels open from the camp card and the panel keys, and their commands go through the rules',async t=>{
  const app=await bootApp(t,{name:'soldier-panels'});
  await app.click('new');await app.click('begin');
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
