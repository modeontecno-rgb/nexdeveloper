// @vitest-environment happy-dom
import * as React from 'react';
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {useDictado} from './dictado';
vi.mock('sonner',()=>({toast:{error:vi.fn()}}));
let latest:ReturnType<typeof useDictado>,root:Root,node:HTMLDivElement;
let recognizer:FakeRecognition;
class FakeRecognition {
 lang='';continuous=false;interimResults=false;
 onstart:(()=>void)|null=null;onend:(()=>void)|null=null;onerror:(()=>void)|null=null;onresult:((e:unknown)=>void)|null=null;
 start=vi.fn(()=>this.onstart?.());stop=vi.fn();abort=vi.fn();
 constructor(){recognizer=this;}
}
const stop=vi.fn(),close=vi.fn(async()=>{});
const stream={getTracks:()=>[{stop}]};
const capture=vi.fn();
class FakeAudioContext {resume=async()=>{};close=close;createAnalyser=()=>({fftSize:0,frequencyBinCount:8,getByteTimeDomainData:()=>{}});createMediaStreamSource=()=>({connect:()=>{}})}
function Harness({received}:{received:(s:string)=>void}){latest=useDictado(received);return null;}
beforeEach(async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('AudioContext',FakeAudioContext);vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{});
 Object.defineProperty(window,'SpeechRecognition',{configurable:true,value:FakeRecognition});
 Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:capture}});
 capture.mockReset();stop.mockClear();close.mockClear();capture.mockResolvedValue(stream);
 node=document.createElement('div');document.body.appendChild(node);root=createRoot(node);
});
afterEach(async()=>{await act(async()=>root.unmount());node.remove();vi.unstubAllGlobals();});
describe('dictado y micrófono',()=>{
 it('parar cierra el micrófono y conserva solo transcripciones finales',async()=>{
  const received=vi.fn();await act(async()=>root.render(<Harness received={received}/>));
  await act(async()=>latest.alternar());expect(latest.escuchando).toBe(true);
  const final=Object.assign([{transcript:'Texto confirmado'}],{isFinal:true});
  const partial=Object.assign([{transcript:'Todavía hablando'}],{isFinal:false});
  await act(async()=>{recognizer.onresult?.({resultIndex:0,results:[final,partial]});recognizer.onresult?.({resultIndex:0,results:[final,partial]});});
  expect(received).toHaveBeenCalledExactlyOnceWith('Texto confirmado');
  await act(async()=>latest.alternar());expect(stop).toHaveBeenCalled();expect(close).toHaveBeenCalled();expect(latest.escuchando).toBe(false);
 });
 it('no empieza a grabar si el permiso llega después de salir de pantalla',async()=>{
  let permission!:(s:typeof stream)=>void;capture.mockReturnValue(new Promise(resolve=>{permission=resolve}));
  await act(async()=>root.render(<Harness received={()=>{}}/>));
  let pending!:Promise<void>;act(()=>{pending=latest.alternar()});
  await act(async()=>root.unmount());root=createRoot(node);
  await act(async()=>{permission(stream);await pending});
  expect(stop).toHaveBeenCalled();expect(recognizer.start).not.toHaveBeenCalled();
 });
 it('denegar permiso no inicia reconocimiento',async()=>{
  capture.mockRejectedValue(new Error('Denied'));await act(async()=>root.render(<Harness received={()=>{}}/>));
  await act(async()=>latest.alternar());expect(recognizer.start).not.toHaveBeenCalled();expect(latest.escuchando).toBe(false);expect(latest.iniciando).toBe(false);
 });
});
