import assert from 'node:assert/strict';
// Shared browser-test navigation. Every disclosure/category is opened through
// its visible control; reading the DOM identifies the route, never changes it.
export async function menuCommand(page,command){
  if(command==='menu'){
    await page.locator('[data-cmd="menu"]:visible, [data-role="menuButton"]:visible').first().click();return;
  }
  const target=page.locator(`[data-cmd="${command}"]:visible`).first();
  if(!await target.count())await page.locator('[data-cmd="menu"]:visible, [data-role="menuButton"]:visible').first().click();
  if(!await target.count()){
    const group={character:'campaign',map:'campaign',journal:'campaign',ledger:'campaign',history:'about',credits:'about',privacy:'about',home:'about'}[command];
    if(group)await page.locator(`#modal [data-cmd="menu-section"][data-id="${group}"]`).click();
  }
  await target.click();
}

// dialog.close() dispatches its close event asynchronously. Observe that event
// before reading the resulting focus or pause state; never race its handler.
export async function closePanel(page){
  const closed=page.locator('#modal').evaluate(modal=>new Promise(resolve=>modal.addEventListener('close',()=>resolve(),{once:true})));
  await page.locator('#modal .modal-close').click();await closed;
}

export async function settingsPage(page,id){
  await page.locator(`#modal [data-cmd="settings-section"][data-id="${id}"]`).click();
  await page.locator(`#modal [data-settings-page="${id}"]`).waitFor({state:'visible'});
}

// Word wrapping can fit the modal while still splitting its short title.
// Check the rendered text lines, not just document width.
export async function verifyEnlargedSettingsGeometry(page){
  const result=await page.evaluate(()=>{
    const modal=document.querySelector('#modal'),title=document.querySelector('#panel-title'),close=modal.querySelector('.modal-close');
    const r=modal.getBoundingClientRect(),t=title.getBoundingClientRect(),c=close.getBoundingClientRect(),range=document.createRange();
    range.selectNodeContents(title);
    const visible=el=>el.checkVisibility({checkVisibilityCSS:true})&&el.getClientRects().length;
    return {viewport:innerWidth,textScale:getComputedStyle(document.documentElement).getPropertyValue('--text-scale').trim(),
      documentWidth:document.documentElement.scrollWidth,modalWidth:r.width,scrollWidth:modal.scrollWidth,clientWidth:modal.clientWidth,
      title:title.textContent,titleLines:range.getClientRects().length,
      titleCloseOverlap:Math.min(t.right,c.right)-Math.max(t.left,c.left)>1&&Math.min(t.bottom,c.bottom)-Math.max(t.top,c.top)>1,
      overflow:[...modal.querySelectorAll('*')].filter(visible).map(el=>{const b=el.getBoundingClientRect();return {tag:el.tagName,class:el.className,left:b.left,right:b.right};}).filter(b=>b.left<r.left-1||b.right>r.right+1)};
  });
  assert.equal(result.textScale,'2','The enlarged Settings check uses 200% text');
  assert.equal(result.title,'Settings');assert.equal(result.titleLines,1,'Settings stays a whole word on one line');
  assert.equal(result.titleCloseOverlap,false,'The Settings title and Close control never overlap');
  assert.ok(result.documentWidth<=result.viewport+1,'The enlarged Settings page fits the viewport');
  assert.ok(result.scrollWidth<=result.clientWidth+1,'The enlarged Settings modal has no horizontal overflow');
  assert.deepEqual(result.overflow,[],'All visible Settings content stays within the modal');
  return result;
}

export async function revealControl(page,selector){
  const target=page.locator(selector).first();
  await target.waitFor({state:'attached'});
  const category=await target.evaluate(el=>el.closest('[data-settings-page]')?.dataset.settingsPage);
  if(category&&!await page.locator(`#modal [data-settings-page="${category}"]`).isVisible())await settingsPage(page,category);
  // Outer disclosures precede inner ones in document order. Re-query after
  // every click because changing a setting can re-render the whole panel.
  for(let depth=0;depth<8;depth++){
    const closed=target.locator('xpath=ancestor::details[not(@open)]').first();
    if(!await closed.count())break;
    await closed.locator(':scope > summary').click();
  }
  await target.waitFor({state:'visible'});
  return target;
}

export async function settingsCommand(page,command){
  await menuCommand(page,'settings');
  await (await revealControl(page,`#modal [data-cmd="${command}"]`)).click();
}

// A real walkable-camp conversation must not leave stale dialog context.
export async function verifyCampPanelTransitions(page){
  // Back replaces the conversation context: opening Saves must permit a real
  // save, rather than keep the old conversation's save lock behind the Menu.
  await page.locator('#modal .modal-back').click();await page.locator('#modal [data-cmd="saves"]').click();
  await page.locator('#modal [data-cmd="slot-save"][data-id="2"]').click();
  await page.waitForSelector('#modal [data-cmd="slot-load"][data-id="2"]:not(:disabled)',{timeout:30000});
  await closePanel(page);
  await menuCommand(page,'settings');const panelPause=await revealControl(page,'#panel-pause'),wasPanelPaused=await panelPause.isChecked();
  await panelPause.uncheck();await closePanel(page);
  if(await page.evaluate(()=>window.__realtime.paused()))await page.locator('[data-role="pauseButton"]').click();
  await page.waitForFunction(()=>!window.__realtime.paused());
  await page.locator('#rt-board').focus();await page.keyboard.press('KeyQ');await page.waitForSelector('#modal .mission-orders');
  await page.locator('#modal .modal-close').focus();
  const missionControls=await page.evaluateHandle(()=>({head:document.querySelector('#modal .modal-head'),back:document.querySelector('#modal .modal-back'),close:document.querySelector('#modal .modal-close')}));
  const beforeRefresh=await page.evaluate(()=>({tick:window.__realtime.world().tick,paused:window.__realtime.paused(),at:performance.now()}));
  // Let the live HUD cross multiple one-second refreshes. The navigation must
  // remain connected throughout, including on a slow software-rendered stage.
  await page.waitForFunction(({tick,at})=>performance.now()-at>=2200&&window.__realtime.world().tick>tick,beforeRefresh,{timeout:30000}).catch(async error=>{
    const observed=await page.evaluate(()=>({tick:window.__realtime.world().tick,paused:window.__realtime.paused(),hidden:document.hidden,title:document.querySelector('#panel-title')?.textContent,focus:document.activeElement?.className,panel:document.querySelector('#modal')?.dataset,settings:JSON.parse(localStorage.getItem('sacramentum.settings')||'{}')}));
    throw new Error(`Camp mission refresh: ${error.message.split('\n')[0]}; ${JSON.stringify({beforeRefresh,observed})}`);
  });
  assert.equal(await page.evaluate(()=>window.__realtime.paused()),false,'Pause in panels off keeps the camp running behind Mission orders');
  assert.ok(await page.evaluate(()=>window.__realtime.world().tick)>beforeRefresh.tick,'The camp advances real simulation ticks behind the unpaused mission panel');
  assert.equal(await page.locator('#panel-title').textContent(),'Mission orders','The camp HUD refresh keeps the active mission panel');
  assert.equal(await missionControls.evaluate(({head,back,close})=>head===document.querySelector('#modal .modal-head')&&back===document.querySelector('#modal .modal-back')&&close===document.querySelector('#modal .modal-close')),true,'Live refreshes keep the same Back and Close controls');
  await missionControls.dispose();
  assert.equal(await page.locator('#modal .modal-close').evaluate(el=>el===document.activeElement),true,'A same-panel refresh preserves focus');
  await page.locator('#modal .modal-back').click({timeout:30000});await page.waitForTimeout(1300);
  assert.equal(await page.locator('#panel-title').textContent(),'Menu','The next HUD refresh never reopens a panel after Back');
  await page.locator('#modal [data-cmd="settings"]').click();await (await revealControl(page,'#panel-pause')).setChecked(wasPanelPaused);
  await closePanel(page);
}
