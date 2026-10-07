import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parseSync, transformSync } from 'rolldown/utils';

const source = fs.readFileSync(new URL('../src/MetrologyLabV3.tsx', import.meta.url), 'utf8');
const ast = parseSync('simulator.tsx', source).program;
const declarations = new Map();
let stopEffect;
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'VariableDeclaration') {
    for (const declaration of node.declarations) {
      if (['clearSweepTimers', 'performSweep'].includes(declaration.id?.name)) {
        declarations.set(declaration.id.name, source.slice(node.start, node.end));
      }
    }
  }
  if (node.type === 'CallExpression' && node.callee?.name === 'useEffect') {
    const callback = node.arguments[0];
    const text = callback && source.slice(callback.start, callback.end);
    if (text?.includes('!state.experiment.active') && text.includes('clearSweepTimers()')) {
      assert.equal(stopEffect, undefined, 'Expected one inactive-run cleanup effect');
      stopEffect = text;
    }
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') visit(value);
  }
}
visit(ast);
assert.ok(stopEffect, 'Missing inactive-run cleanup effect');
assert.equal(declarations.size, 2, 'Missing sweep or timer cleanup implementation');
const extracted = `
${declarations.get('clearSweepTimers')}
globalThis.createSweep = (state) => {
  ${declarations.get('performSweep')}
  return performSweep;
};
globalThis.runStopEffect = (state) => (${stopEffect})();
`;
const code = transformSync('sweep-race.ts', extracted).code;

function fixture(reduced) {
  let now = 0, identity = 0, timerId = 0;
  const timers = new Map(), actions = [];
  let current = {
    facility: { mode: 'operator', power: true },
    experiment: { active: true, scanActive: false, id: 'run-A', captureCount: 0,
      currentScanIndex: 0, rescanCounts: {}, records: [],
      contract: { id: 'run-A', status: 'running', plan: { acquisitions: [] } } },
    vna: { sweeping: false, acquisitionPhase: 'idle', calibrated: true, power: true, rf: true },
    stage: { x: 0, y: 0, z: 0 },
    chamber: { pressure: 0.1, temperature: 22, faraday: true, isolation: true },
    clock: { locked: true, cableFault: false },
    failures: { clockDrift: false },
    ldv: { power: true, shutter: true, opticalQuality: 1 },
  };
  const context = {
    window: {
      setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, at: now + delay }); return id; },
      clearTimeout(id) { timers.delete(id); },
    },
    sweepTimers: { current: [] },
    sweepRunId: { current: null },
    FX: { reduced },
    BASE_FREQUENCY: 230500,
    MODEL_VERSION: 'test-model',
    validationResult: { overall: 'VALID' },
    buildSweep: () => [{ freq: 230500, s11: -20 }],
    captureSettings: () => ({}),
    createIdentifier: kind => `${kind}-${++identity}`,
    dispatch(action) {
      actions.push(action);
      if (action.type === 'PATCH') current = { ...current, [action.domain]: { ...current[action.domain], ...action.patch } };
      if (action.type === 'RECORD') current = { ...current, experiment: { ...current.experiment, records: [...current.experiment.records, action.record] } };
    },
  };
  vm.runInNewContext(code, context);
  return {
    context, setState(next) { current = next; },
    get state() { return current; },
    get pending() { return timers.size; },
    actions,
    sweep() { context.createSweep(current)(); },
    stop(status = 'cancelled') {
      current = { ...current, experiment: { ...current.experiment, active: false,
        contract: { ...current.experiment.contract, status } } };
      context.runStopEffect(current);
    },
    restart() {
      current = { ...current, experiment: { ...current.experiment, active: true,
        id: 'run-B', records: [], captureCount: 0,
        contract: { ...current.experiment.contract, id: 'run-B', status: 'running' } } };
      context.runStopEffect(current);
    },
    advance(target) {
      while (true) {
        const entry = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!entry) break;
        now = entry[1].at;
        timers.delete(entry[0]);
        entry[1].callback();
      }
      now = target;
    },
  };
}

import React, { act, useEffect, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createRequire } from 'node:module';
const { JSDOM } = createRequire(new URL('../tests/mounted/package.json', import.meta.url))('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window=dom.window; globalThis.document=dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let powerEffect;
function findPower(n){
 if(!n || typeof n!=='object')return;
 if(n.type==='CallExpression' && n.callee?.name==='useEffect'){const c=n.arguments[0];const t=c && source.slice(c.start,c.end);if(t?.includes('if (!state.facility.power) clearSweepTimers()'))powerEffect=t;}
 for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(findPower);else if(v && typeof v==='object')findPower(v);}
}
findPower(ast); assert.ok(powerEffect);
const powerCode=transformSync('power.ts','globalThis.runPowerEffect=(state)=>('+powerEffect+')();').code;
let passed=0;
for(const strict of [false,true])for(const reduced of [false,true])for(const scenario of ['partial-stop','completed-stop','restart','power-off','unmount','natural-completion']){
 const f=fixture(reduced); vm.runInNewContext(powerCode,f.context);
 const host=document.createElement('div'); document.body.appendChild(host);
 const root=createRoot(host); let mounted=true;
 function Lifecycle({state}){
  useEffect(()=>f.context.runPowerEffect(state),[state.facility.power]);
  useEffect(()=>f.context.runStopEffect(state),[state.experiment.active,state.experiment.contract?.status,state.experiment.id]);
  return null;
 }
 const refresh=()=>root.render(strict?React.createElement(StrictMode,null,React.createElement(Lifecycle,{state:f.state})):React.createElement(Lifecycle,{state:f.state}));
 const update=next=>{f.setState(next);refresh();};
 const duration=reduced?40:1650;
 try{
  await act(async()=>refresh());
  await act(async()=>{f.sweep();refresh();}); assert.equal(f.pending,4);
  if(scenario==='completed-stop'||scenario==='natural-completion')await act(async()=>{f.advance(duration);refresh();});
  if(scenario==='partial-stop')await act(async()=>{f.advance(duration*.75);refresh();});
  if(scenario==='partial-stop'||scenario==='completed-stop'||scenario==='natural-completion'){
   await act(async()=>update({...f.state,experiment:{...f.state.experiment,active:false,contract:{...f.state.experiment.contract,status:scenario==='natural-completion'?'completed':'cancelled'}}}));
  }else if(scenario==='restart'){
   await act(async()=>{update({...f.state,experiment:{...f.state.experiment,active:false,contract:{...f.state.experiment.contract,status:'cancelled'}}});update({...f.state,experiment:{...f.state.experiment,active:true,id:'run-B',records:[],contract:{...f.state.experiment.contract,id:'run-B',status:'running'}}});});
  }else if(scenario==='power-off'){
   await act(async()=>update({...f.state,facility:{...f.state.facility,power:false}}));
  }else{await act(async()=>root.unmount());mounted=false;}
  const actionCount=f.actions.length;
  assert.equal(f.pending,scenario==='natural-completion'?1:0);
  await act(async()=>{f.advance(duration+1000);if(mounted)refresh();});
  if(scenario!=='natural-completion')assert.equal(f.actions.length,actionCount,'No post-cancellation dispatch');
  assert.equal(f.state.experiment.records.length,['completed-stop','natural-completion'].includes(scenario)?1:0);
  if(scenario==='restart')assert.equal(f.state.experiment.id,'run-B');
  if(scenario==='natural-completion')assert.equal(f.state.vna.acquisitionPhase,'idle');
  passed++;console.log('PASS mounted lifecycle',scenario,'strict='+strict,'reduced='+reduced);
 }finally{if(mounted)await act(async()=>root.unmount());host.remove();}
}
console.log('Mounted lifecycle cases passed:',passed);dom.window.close();
