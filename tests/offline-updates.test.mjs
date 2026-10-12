import test from 'node:test';
import assert from 'node:assert/strict';
import {watchEditionUpdates} from '../src/ui/offline-updates.js';

class Worker extends EventTarget {
  constructor(state = 'installing') { super(); this.state = state; }
  transition(state) { this.state = state; this.dispatchEvent(new Event('statechange')); }
}
class Registration extends EventTarget {
  installing = null;
  waiting = null;
  discover(worker) { this.installing = worker; this.dispatchEvent(new Event('updatefound')); }
}

test('OFFLINE-01 captured installing worker reports even after registration pointer is cleared', () => {
  const registration = new Registration(), worker = new Worker(), notices = [];
  registration.installing = worker;
  watchEditionUpdates(registration, {hadController:true,onReady:value => notices.push(value)});
  registration.installing = null;
  registration.waiting = worker;
  worker.transition('installed');
  worker.dispatchEvent(new Event('statechange'));
  registration.dispatchEvent(new Event('updatefound'));
  assert.deepEqual(notices, [worker]);
});

test('OFFLINE-02 an edition already waiting when the observer attaches is reported immediately', () => {
  const registration = new Registration(), worker = new Worker('installed'), notices = [];
  registration.waiting = worker;
  watchEditionUpdates(registration, {hadController:true,onReady:value => notices.push(value)});
  assert.deepEqual(notices, [worker]);
});

test('OFFLINE-03 first installation does not announce a new edition', () => {
  const registration = new Registration(), worker = new Worker(), notices = [];
  registration.installing = worker;
  registration.waiting = new Worker('installed');
  const stop = watchEditionUpdates(registration, {hadController:false,onReady:value => notices.push(value)});
  worker.transition('installed');
  registration.discover(new Worker('installed'));
  assert.deepEqual(notices, []);
  stop();
});

test('OFFLINE-04 future installations are observed and notify once per worker', () => {
  const registration = new Registration(), first = new Worker(), second = new Worker(), notices = [];
  watchEditionUpdates(registration, {hadController:true,onReady:value => notices.push(value)});
  registration.discover(first);
  registration.discover(first);
  first.transition('installed');
  registration.discover(second);
  second.transition('installed');
  assert.deepEqual(notices, [first, second]);
});

test('OFFLINE-05 unsubscribe stops pending and future worker notifications', () => {
  const registration = new Registration(), worker = new Worker(), notices = [];
  registration.installing = worker;
  const stop = watchEditionUpdates(registration, {hadController:true,onReady:value => notices.push(value)});
  stop(); stop();
  worker.transition('installed');
  registration.discover(new Worker('installed'));
  assert.deepEqual(notices, []);
});

test('OFFLINE-06 an unsuccessful installation does not announce an available edition', () => {
  const registration = new Registration(), worker = new Worker(), notices = [];
  registration.installing = worker;
  watchEditionUpdates(registration, {hadController:true,onReady:value => notices.push(value)});
  worker.transition('redundant');
  assert.deepEqual(notices, []);
});
