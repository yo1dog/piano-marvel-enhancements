import {
  createHTML,
  requireQuerySelector,
} from './utils';
import {sharpNoteNames} from './consts';
import * as config from './config';
import {logger} from './logger';
import {PMEModule} from './pmeModule';
import {SettingsManager} from './settingsManager';
import {sharedAppSetup} from './sharedAppSetup';
import type {JZZ} from '../lib/JZZ';

declare interface IMidiInput {
  readonly name        : string;
  readonly manufacturer: string;
  readonly version     : string;
  readonly engine      : string;
}

declare interface IMidiInputConnection {
  readonly input: IMidiInput;
  readonly port : JZZ.Port;
}


let jzz                  : JZZ.Engine.Async;
let pmeModule            : PMEModule;
let containerElem        : HTMLElement;
let midiInputsElem       : HTMLSelectElement;
let refreshMidiInputsElem: HTMLElement;
let settingsManager      : SettingsManager;

let curMidiConnection     : IMidiInputConnection | null;
let preferredMidiInputName: string | undefined;

export async function run() {
  logger.info('Piano Marvel Enhancements started');
  
  pmeModule = new PMEModule(config, logger);
  
  const fragment = createHTML(`
    <div class="yo1dog-pme-container">
      <div class="yo1dog-pme-header">MIDI Shortcuts</div>
      <div>
        <select class="yo1dog-pme-midiInputs"></select>
        <button class="yo1dog-pme-refreshMidiInputs">Refresh</button>
      </div>
    </div>
  `);
  containerElem         = requireQuerySelector(fragment, '.yo1dog-pme-container'           );
  midiInputsElem        = requireQuerySelector(fragment, '.yo1dog-pme-midiInputs', 'select');
  refreshMidiInputsElem = requireQuerySelector(fragment, '.yo1dog-pme-refreshMidiInputs'   );
  containerElem.appendChild(pmeModule.elem);
  
  midiInputsElem.addEventListener('change', () => {
    const midiInput = getSelectedMidiInput();
    
    if (midiInput) {
      preferredMidiInputName = midiInput.name;
      saveMidiSettingsBackground();
    }
    
    setMidiInputBackground(midiInput);
  });
  
  refreshMidiInputsElem.addEventListener('click', () => refreshMidiInputsList());
  
  settingsManager = new SettingsManager(logger);
  await sharedAppSetup(pmeModule, containerElem, settingsManager, logger);
  
  // load MIDI settings
  try {
    await loadAndApplyMidiSettings();
  } catch (err) {
    pmeModule.showErrorMessage(`Error loading MIDI settings: ${err.message}`);
    logger.error(err);
  }
  
  // setup JZZ and Jazz plugin
  pmeModule.showMessage('Loading JZZ...');
  
  // get the JZZ script URL from meta element
  const jzzUrlMeta = document.getElementById('yo1dog-pme-jzz-url') as HTMLMetaElement | null;
  if (!jzzUrlMeta) {
    throw new Error(`Unable to find JZZ URL meta element.`);
  }
  const jzzUrl = jzzUrlMeta.content;
  
  // inject the script element
  const jzzScriptElem = document.createElement('script');
  jzzScriptElem.src = jzzUrl;
  document.head.appendChild(jzzScriptElem);
  
  // wait for the JZZ script to load
  if (!(window as any).JZZ) {
    await new Promise(resolve => jzzScriptElem.addEventListener('load', () => resolve()));
  }
  
  // load JZZ
  try {
    jzz = await (window as any).JZZ();
  } catch(err) {
    pmeModule.showErrorMessage(`Error loading JZZ: ${err.message}`);
    logger.error(err);
    return;
  }
  
  const jzzInfo = jzz.info();
  pmeModule.showMessage(`JZZ v${jzzInfo.ver} loaded.`);
  logger.info({...jzzInfo, inputs: undefined, outputs: undefined});
  
  if (jzzInfo.engine === 'none') {
    pmeModule.showErrorMessage('Your browser is not supported without plugins. Please install Jazz-Plugin and Jazz-MIDI.');
    return;
  }
  if (jzzInfo.engine === 'webmidi') {
    pmeModule.showMessage('WARNING: Plugins not detected. If you have issues please install Jazz-Plugin and Jazz-MIDI. Regardless, we strongly suggest this for the best experience.');
  }
  
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  jzz.onChange(() => refreshMidiInputsList());
  refreshMidiInputsList();
  
  // remove auto-created element
  const jzzElem = document.getElementById('jazz-midi-msg');
  if (jzzElem) jzzElem.remove();
}

function getMidiInputs() {
  const midiInputs: IMidiInput[] = jzz.info().inputs;
  return midiInputs;
}

function getSelectedMidiInput() {
  const selectedMidiInputName = midiInputsElem.value;
  if (!selectedMidiInputName) return null;
  
  const midiInputs = getMidiInputs();
  const midiInput = midiInputs.find(x => x.name === selectedMidiInputName);
  if (!midiInput) throw new Error(`MIDI input with ID '${selectedMidiInputName}' does not exists.`);
  
  return midiInput;
}

function refreshMidiInputsList() {
  logger.info('Refreshing MIDI input list.');
  const midiInputs = getMidiInputs();
  
  // remove all options
  while (midiInputsElem.options.length > 0) {
    midiInputsElem.options.remove(0);
  }
  
  // create options for each MIDI input
  for (const midiInput of midiInputs) {
    midiInputsElem.options.add(new Option(midiInput.name, midiInput.name));
  }
  
  let selectMidiInput: IMidiInput | undefined;
  const curMidiInputName = curMidiConnection && curMidiConnection.input.name;
  if (curMidiInputName) {
    // select the current midi input (if it still exists)
    selectMidiInput = midiInputs.find(x => x.name === curMidiInputName);
  }
  if (!selectMidiInput && preferredMidiInputName) {
    // select the preferred midi input if there is no current input or the current input no longer
    // exists
    selectMidiInput = midiInputs.find(x => x.name === preferredMidiInputName);
  }
  if (selectMidiInput) {
    midiInputsElem.value = selectMidiInput.name;
  }
  
  setMidiInputBackground(getSelectedMidiInput());
}

async function setMidiInput(midiInput: IMidiInput | null) {
  if (curMidiConnection) {
    if (midiInput && midiInput.name === curMidiConnection.input.name) {
      return;
    }
    
    // remove all listeners from old input
    try {
      await curMidiConnection.port.disconnect();
      await curMidiConnection.port.close();
    } catch(err) {
      logger.error(`Error closing old midi input.`, err);
    }
    pmeModule.showMessage(`Stopped listening to MIDI input '${curMidiConnection.input.name}'.`);
  }
  
  curMidiConnection = null;
  
  if (midiInput) {
    pmeModule.showMessage(`Connecting to MIDI input '${midiInput.name}'...`);
    const midiInputPort = await jzz.openMidiIn(midiInput.name);
    await midiInputPort.connect(onMidiMessage);
    
    curMidiConnection = {
      input: midiInput,
      port: midiInputPort
    };
    
    pmeModule.showMessage(`Listening to MIDI input '${midiInput.name}'.`);
  }
}
function setMidiInputBackground(midiInput: IMidiInput | null) {
  setMidiInput(midiInput)
  .catch(err => {
    pmeModule.showErrorMessage(`Error setting midi input to ${midiInput? `'${midiInput.name}'` : 'null'}: ${err.message}`);
  });
}

function onMidiMessage(msg: any) {
  if (msg.isNoteOn && msg.isNoteOn()) {
    pmeModule.onNote({
      timestampMs: Date.now(), // JZZ currently does not support timestamps
      note: createNote(msg.getNote())
    });
  }
}

function createNote(noteNumber: number) {
  return {
    name  : sharpNoteNames[noteNumber % 12],
    octave: Math.floor(noteNumber / 12),
    number: noteNumber
  };
}

async function loadAndApplyMidiSettings() {
  const settings = await settingsManager.loadSettings('midi');
  if (!settings) return;
  
  if (typeof settings.preferredMidiInputName === 'string') {
    preferredMidiInputName = settings.preferredMidiInputName;
  }
}
function saveMidiSettingsBackground() {
  const settings = {
    preferredMidiInputName
  };
  settingsManager.saveSettingsBackground('midi', settings);
}