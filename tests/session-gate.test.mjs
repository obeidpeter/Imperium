import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionGate, commitReplacement} from '../src/ui/session-gate.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}

test('SESSION-01 busy work is rejected without running or queueing its callback', async () => {
  const gate = createSessionGate(), save = deferred();
  const calls = [];
  const first = gate.run(async () => { calls.push('first'); await save.promise; return 'saved'; });
  assert.equal(gate.busy, true);
  await assert.rejects(gate.run(() => calls.push('stale hidden save')), {code:'SESSION_BUSY'});
  save.resolve();
  assert.equal(await first, 'saved');
  assert.equal(gate.busy, false);
  assert.deepEqual(calls, ['first']);
  assert.equal(await gate.run(() => 'fresh action'), 'fresh action');
});

test('SESSION-02 replacement excludes visibility saves and actions during both load and commit', async () => {
  const gate = createSessionGate(), loading = deferred(), saving = deferred(), saveStarted = deferred();
  const previous = {name:'Old in-memory campaign'}, candidate = {name:'Latest committed campaign'};
  let visible = previous, hiddenWrites = 0;
  const operation = gate.run(() => commitReplacement({
    load: () => loading.promise,
    save: async state => { assert.equal(state, candidate); saveStarted.resolve(); await saving.promise; },
    publish: state => { visible = state; }
  }));
  await assert.rejects(gate.run(() => { hiddenWrites++; }), {code:'SESSION_BUSY'});
  assert.equal(visible, previous);
  loading.resolve(candidate);
  await saveStarted.promise;
  await assert.rejects(gate.run(() => { hiddenWrites++; }), {code:'SESSION_BUSY'});
  assert.equal(visible, previous);
  saving.resolve();
  assert.equal(await operation, candidate);
  assert.equal(visible, candidate);
  assert.equal(hiddenWrites, 0);
  assert.equal(gate.busy, false);
});

test('SESSION-03 failed replacement save preserves published state and releases the gate', async () => {
  const gate = createSessionGate(), previous = {name:'Keep me'}, candidate = {name:'Import'};
  const saving = deferred(), saveStarted = deferred();
  let visible = previous, publishCount = 0;
  const operation = gate.run(() => commitReplacement({
    load: async () => candidate,
    save: async () => { saveStarted.resolve(); await saving.promise; },
    publish: state => { publishCount++; visible = state; }
  }));
  await saveStarted.promise;
  const failed = assert.rejects(operation, /Storage unavailable/);
  saving.reject(new Error('Storage unavailable'));
  await failed;
  assert.equal(visible, previous);
  assert.equal(publishCount, 0);
  assert.equal(gate.busy, false);
  assert.equal(await gate.run(() => 'can retry'), 'can retry');
});

test('SESSION-04 failed load never saves or publishes; confirmed atomic load can omit save', async () => {
  const gate = createSessionGate(), calls = [];
  await assert.rejects(gate.run(() => commitReplacement({
    load: async () => { throw new Error('Invalid recovery record'); },
    save: () => calls.push('save'),
    publish: () => calls.push('publish')
  })), /Invalid recovery record/);
  assert.deepEqual(calls, []);
  const state = {name:'Atomic recovery'};
  assert.equal(await gate.run(() => commitReplacement({
    load: async () => state,
    publish: restored => { assert.equal(restored, state); calls.push('publish'); }
  })), state);
  assert.deepEqual(calls, ['publish']);
});

test('SESSION-05 synchronous failure and nested entry cannot strand the gate', async () => {
  const gate = createSessionGate();
  await assert.rejects(gate.run(() => { throw new Error('Action failed'); }), /Action failed/);
  assert.equal(gate.busy, false);
  await gate.run(async () => {
    await assert.rejects(gate.run(() => assert.fail('Nested callback ran')), {code:'SESSION_BUSY'});
    assert.equal(gate.busy, true);
  });
  assert.equal(gate.busy, false);
});

test('SESSION-06 replacement holds the gate until delayed publication completes', async () => {
  const gate = createSessionGate(), publishing = deferred(), publishStarted = deferred();
  const operation = gate.run(() => commitReplacement({
    load: async () => 'saved',
    publish: async () => { publishStarted.resolve(); await publishing.promise; }
  }));
  await publishStarted.promise;
  await assert.rejects(gate.run(() => assert.fail('Work overlapped publication')), {code:'SESSION_BUSY'});
  publishing.resolve();
  assert.equal(await operation, 'saved');
  assert.equal(gate.busy, false);
});
