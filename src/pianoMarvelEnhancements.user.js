// ==UserScript==
// @name          Piano Marvel Enhancements
// @namespace     http://yo1.dog
// @version       2.0.1
// @description   Adds enhancements to painomarvel.com
// @author        Mike "yo1dog" Moore
// @homepageURL   https://github.com/yo1dog/piano-marvel-enhancements#readme
// @icon          https://github.com/yo1dog/piano-marvel-enhancements/raw/master/icon.ico
// @match         *://pianomarvel.com/nextgen/*
// @run-at        document-end
// @resource      jzzResource ../lib/JZZ.js?v=1
// @resource      styleResource style.css?v=7
// @grant         GM.getResourceURL
// @grant         GM.getResourceUrl
// ==/UserScript==

/**
 * @typedef INote
 * @property {string} name
 * @property {number} octave
 * @property {number} number
 * 
 * @typedef INoteEvent
 * @property {INote} note
 * @property {number} timestampMs
 * 
 * @typedef IShortcut
 * @property {string} name
 * @property {INote[]} [notes]
 * @property {() => void} exec
 * 
 * @typedef IAppState
 * @property {HTMLElement} controlsContainer
 * @property {HTMLElement} backButton
 * @property {HTMLElement} nextButton
 * @property {HTMLElement} prepareButton
 * @property {HTMLElement} assessButton
 * @property {boolean} isPreparing
 * @property {boolean} isAssessing
 * 
 * @typedef IMidiInput
 * @property {string} name
 * @property {string} manufacturer
 * @property {string} version
 * @property {string} engine
 * 
 * @typedef IMidiInputConnection
 * @property {IMidiInput} input
 * @property {import('../lib/JZZ').Port} port
 * 
 * @typedef IMessage
 * @property {string} text
 * @property {boolean} isError
 */

let __execIdSeq = 0; // eslint-disable-line @typescript-eslint/naming-convention

console.log('yo1dog-pme: Piano Marvel Enhancements loaded');

(async () => {
  const jzzUrl   = await (GM.getResourceUrl || GM.getResourceURL)('jzzResource');
  const styleUrl = await (GM.getResourceUrl || GM.getResourceURL)('styleResource');
  await execOnPage(window, pianoMarvelEnhancements, {jzzUrl, styleUrl});
})().catch(err => console.error('yo1dog-pme:', err));

/**
 * @param {object} options 
 * @param {string} options.jzzUrl 
 * @param {string} options.styleUrl 
 */
async function pianoMarvelEnhancements({jzzUrl, styleUrl}) {
  const SHORTCUT_MAX_LENGTH = 5;
  const SHORTCUT_MAX_DUR_MS = 5000;
  const NOTE_EVENT_BUFFER_MAX_LENGTH = SHORTCUT_MAX_LENGTH;
  const NOTE_BUFFER_MAX_LENGTH = NOTE_EVENT_BUFFER_MAX_LENGTH;
  const MESSAGE_BUFFER_MAX_LENGTH = 20;
  
  const logger = {
    /** @param {any} message @param {any[]} optionalParams */
    log(message, ...optionalParams) {
      console.log('yo1dog-pme:', message, ...optionalParams);
    },
    /** @param {any} message @param {any[]} optionalParams */
    error(message, ...optionalParams) {
      console.error('yo1dog-pme:', message, ...optionalParams);
    }
  };
  
  
  logger.log('Piano Marvel Enhancements started');
  
  const headElem = document.getElementsByTagName('head')[0];
  
  logger.log('Injecting JZZ...');
  const jzzScriptElem = document.createElement('script');
  jzzScriptElem.src = jzzUrl;
  headElem.appendChild(jzzScriptElem);
  if (!/** @type {any} */(window).JZZ) {
    await new Promise(resolve => jzzScriptElem.addEventListener('load', () => resolve()));
  }
  
  logger.log('Injecting style...');
  const styleLinkElem = document.createElement('link');
  styleLinkElem.rel = 'stylesheet';
  styleLinkElem.type = 'text/css';
  styleLinkElem.href = styleUrl;
  headElem.appendChild(styleLinkElem);
  
  /** @type {import('../lib/JZZ')}        */ const JZZ                    = /** @type {any} */(window).JZZ;
  /** @type {IMidiInputConnection | null} */ let   curMidiConnection      = null;
  /** @type {string | null}               */ let   preferredMidiInputName = null;
  /** @type {INoteEvent[]}                */ const noteEventBuffer        = [];
  /** @type {INote[]}                     */ const noteBuffer             = [];
  /** @type {number | null}               */ let   curRecordingLength     = null;
  /** @type {IMessage[]}                  */ const messageBuffer          = [];
  
  /** @type {IShortcut[]} */
  const shortcuts = [
    {name: 'Back',    exec: doBack   },
    {name: 'Next',    exec: doNext   },
    {name: 'Prepare', exec: doPrepare},
    {name: 'Assess',  exec: doAssess },
    {name: 'Stop',    exec: doStop   },
  ];
  
  logger.log('Setting up DB...');
  const db = await setupDB();
  try {
    logger.log('Loading settings...');
    await loadSettings();
  } catch(err) {
    logger.error(`Error loading settings.`, err);
  }
  
  const template = document.createElement('template');
  template.innerHTML = `
    <div class="yo1dog-pme-container">
      <div class="yo1dog-pme-header">MIDI Shortcuts</div>
      <select class="yo1dog-pme-inputs"></select>
      <button class="yo1dog-pme-refreshInputs">Refresh</button><br>
      <br>
      <select class="yo1dog-pme-shortcuts"></select> <code class="yo1dog-pme-shortcutNotes"></code><br>
      <button class="yo1dog-pme-recordToggle">Record</button><br>
      <br>
      <code class="yo1dog-pme-noteBuffer"></code><br>
      <div class="yo1dog-pme-messages"></div>
    </div>
  `;
  
  const pmeContainer        = requireQuerySelector   (template.content, '.yo1dog-pme-container');
  const inputsElem          = requireQuerySelectorTag(pmeContainer,     '.yo1dog-pme-inputs', 'select');
  const refreshInputsButton = requireQuerySelector   (pmeContainer,     '.yo1dog-pme-refreshInputs');
  const shortcutsElem       = requireQuerySelectorTag(pmeContainer,     '.yo1dog-pme-shortcuts', 'select');
  const shortcutNotesElem   = requireQuerySelector   (pmeContainer,     '.yo1dog-pme-shortcutNotes');
  const recordToggleButton  = requireQuerySelector   (pmeContainer,     '.yo1dog-pme-recordToggle');
  const noteBufferElem      = requireQuerySelector   (pmeContainer,     '.yo1dog-pme-noteBuffer');
  const messagesElem        = requireQuerySelector   (pmeContainer,     '.yo1dog-pme-messages');
  
  // the menu element is destroyed and recreated so we must watch and reattach
  const observer = new MutationObserver(() => {
    const menuElem = document.querySelector('.lesson-menu-left .dropdown-menu.dropdownMenuButton');
    if (menuElem && !menuElem.contains(pmeContainer)) {
      logger.log('Attaching container to DOM.');
      menuElem.appendChild(pmeContainer);
    }
  });
  observer.observe(document, {subtree: true, childList: true});
  
  pmeContainer.addEventListener('click', event => {
    event.stopPropagation();
    return true;
  });
  
  for (const shortcut of shortcuts) {
    shortcutsElem.options.add(new Option(shortcut.name, shortcut.name));
  }
  
  shortcutsElem.addEventListener('change', () => showShortcut(getSelectedShortcut()));
  recordToggleButton.addEventListener('click', () => toggleRecording());
  
  
  showShortcut(getSelectedShortcut());
  showNoteBuffer();
  
  /** @type {import('../lib/JZZ').Engine} */
  let jzz;
  try {
    jzz = await JZZ();
  } catch(err) {
    showErrorMessage(`Failed to start MIDI engine.`);
    logger.error(err);
    return;
  }
  
  jzz.onChange(() => refreshMidiInputList());
  refreshMidiInputList();
  
  inputsElem.addEventListener('change', () => {
    const midiInput = getSelectedMidiInput();
    
    if (midiInput) {
      preferredMidiInputName = midiInput.name;
      saveSettingsBackground();
    }
    
    setMidiInputBackground(midiInput);
  });
  
  refreshInputsButton.addEventListener('click', () => refreshMidiInputList());
  
  
  function getMidiInputs() {
    /** @type {IMidiInput[]} */
    const midiInputs = jzz.info().inputs;
    return midiInputs;
  }
  
  function refreshMidiInputList() {
    logger.log('Refreshing MIDI input list.');
    const midiInputs = getMidiInputs();
    
    while (inputsElem.options.length > 0) {
      inputsElem.options.remove(0);
    }
    
    for (const midiInput of midiInputs) {
      inputsElem.options.add(new Option(midiInput.name, midiInput.name));
    }
    
    /** @type {IMidiInput | null} */
    let selectMidiInput = null;
    const curMidiInputName = curMidiConnection && curMidiConnection.input.name;
    if (curMidiInputName) {
      // select the current midi input (if it still exists)
      selectMidiInput = midiInputs.find(x => x.name === curMidiInputName) || null;
    }
    if (!selectMidiInput && preferredMidiInputName) {
      // select the preferred midi input if there is no current input or the current input no longer
      // exists
      selectMidiInput = midiInputs.find(x => x.name === preferredMidiInputName) || null;
    }
    if (selectMidiInput) {
      inputsElem.value = selectMidiInput.name;
    }
    
    setMidiInputBackground(getSelectedMidiInput());
  }
  
  function getSelectedShortcut() {
    const selectedShortcutName = shortcutsElem.value;
    const shortcut = shortcuts.find(x => x.name === selectedShortcutName);
    if (!shortcut) throw new Error(`Shortcut with name '${selectedShortcutName}' does not exists.`);
    
    return shortcut;
  }
  
  function getSelectedMidiInput() {
    const selectedMidiInputName = inputsElem.value;
    if (!selectedMidiInputName) return null;
    
    const midiInputs = getMidiInputs();
    const midiInput = midiInputs.find(x => x.name === selectedMidiInputName);
    if (!midiInput) throw new Error(`MIDI input with ID '${selectedMidiInputName}' does not exists.`);
    
    return midiInput;
  }
  
  /** @param {IShortcut} shortcut */
  function showShortcut(shortcut) {
    if (!shortcut.notes || shortcut.notes.length === 0) {
      shortcutNotesElem.innerText = 'not set';
    }
    else {
      showShortcutNotes(shortcut.notes);
    }
  }
  
  /** @param {INote[]} notes */
  function showShortcutNotes(notes) {
    shortcutNotesElem.innerText = notesToString(notes);
  }
  
  function showNoteBuffer() {
    noteBufferElem.innerText = notesToString(noteBuffer);
  }
  
  const NOTE_NAMES_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  /**
   * @param {number} noteNumber
   * @returns {INote}
   */
  function createNote(noteNumber) {
    return {
      name  : NOTE_NAMES_SHARP[noteNumber % 12],
      octave: Math.floor(noteNumber / 12),
      number: noteNumber
    };
  }
  
  /** @param {INote[]} notes */
  function notesToString(notes) {
    return (
      notes.length === 0
      ? '--'
      : notes.map(note => `${note.name}${note.octave}`).join(', ')
    );
  }

  function toggleRecording() {
    if (curRecordingLength === null) {
      startRecording();
      
      recordToggleButton.innerHTML = '&#x23f9; Stop';
      shortcutsElem.disabled = true;
      showShortcutNotes([]);
    }
    else {
      const recordedNotes = getRecording(SHORTCUT_MAX_LENGTH);
      stopRecording();
      clearNoteBuffer();
      showNoteBuffer();
      
      const shortcut = getSelectedShortcut();
      shortcut.notes = recordedNotes;
      showMessage(`Updated ${shortcut.name} shortcut`);
      saveSettingsBackground();
      
      recordToggleButton.innerHTML = '&#x23fa; Record';
      shortcutsElem.disabled = false;
      showShortcut(shortcut);
    }
  }
  
  /** @param {IMidiInput | null} midiInput  */
  async function setMidiInput(midiInput) {
    if (curMidiConnection) {
      if (midiInput && midiInput.name === curMidiConnection.input.name) {
        return;
      }
      
      // remove all listeners from old input
      await curMidiConnection.port.disconnect();
      showMessage(`Stopped listening to MIDI input '${curMidiConnection.input.name}'.`);
    }
    
    curMidiConnection = null;
    
    if (midiInput) {
      const midiInputPort = await jzz.openMidiIn(midiInput.name);
      await midiInputPort.connect(onMidiMessage);
      
      curMidiConnection = {
        input: midiInput,
        port: midiInputPort
      };
      
      showMessage(`Listening to MIDI input '${midiInput.name}'`);
    }
  }
  /** @param {IMidiInput | null} midiInput  */
  function setMidiInputBackground(midiInput) {
    setMidiInput(midiInput)
    .catch(err => logger.error(`Error setting midi input to '${midiInput?.name}'.`, err));
  }
  
  function startRecording() {
    showMessage(`Recording started.`);
    curRecordingLength = 0;
  }
  function stopRecording() {
    showMessage(`Recording stoped.`);
    curRecordingLength = null;
  }
  /** @param {number} maxLength */
  function getRecording(maxLength) {
    if (curRecordingLength === null) throw new Error(`Not recording.`);
    if (curRecordingLength === 0) return [];
    return noteEventBuffer.slice(-Math.min(curRecordingLength, maxLength)).map(x => x.note);
  }
  
  /**
   * @param {string} text
   * @param {boolean} [isError]
   */
  function showMessage(text, isError) {
    if (isError) logger.error(text);
    else logger.log(text);
    
    messageBuffer.push({
      text,
      isError: isError || false
    });
    clampArrayLeft(messageBuffer, MESSAGE_BUFFER_MAX_LENGTH);
    
    while (messagesElem.firstChild) {
      messagesElem.removeChild(messagesElem.firstChild);
    }
    
    for (const message of messageBuffer) {
      const divElem = document.createElement('div');
      divElem.innerText = message.text;
      if (message.isError) {
        divElem.classList.add('yo1dog-pme-error');
      }
      messagesElem.appendChild(divElem);
    }
    
    messagesElem.scrollTop = messagesElem.scrollHeight;
  }
  /** @param {string} text */
  function showErrorMessage(text) {
    showMessage(text, true);
  }
  
  /** @returns {Promise<IDBDatabase>} */
  async function setupDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('yo1dog-pme', 2);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('settings');
      };
    });
  }
  
  async function saveSettings() {
    return new Promise((resolve, reject) => {
      logger.log('Saving settings...');
      // NOTE: can't use local storage because Piano Marvel clears it
      const objectStore = db.transaction(['settings'], 'readwrite').objectStore('settings');
      
      const settings = {
        shortcuts: shortcuts.map(shortcut => ({
          name: shortcut.name,
          notes: shortcut.notes
        })),
        preferredMidiInputName
      };
      const request = objectStore.put(settings, 'primary');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        logger.log('Saved settings.');
        return resolve();
      };
    });
  }
  function saveSettingsBackground() {
    saveSettings()
    .catch(err => logger.error(`Error saving settings.`, err));
  }
  
  function loadSettings() {
    return new Promise((resolve, reject) => {
      const objectStore = db.transaction(['settings']).objectStore('settings');
      
      const request = objectStore.get('primary');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const settings = request.result;
        if (settings) {
          const shortcutSettings = settings.shortcuts;
          if (Array.isArray(shortcutSettings)) {
            for (const shortcut of shortcuts) {
              const shortcutSetting = shortcutSettings.find(x => x.name === shortcut.name);
              if (shortcutSetting && shortcutSetting.notes && shortcutSetting.notes.length > 0) {
                shortcut.notes = shortcutSetting.notes;
              }
            }
          }
          
          if (settings.preferredMidiInputName) {
            preferredMidiInputName = settings.preferredMidiInputName;
          }
        }
        
        return resolve();
      };
    });
  }
  
  /** @param {any} msg */
  function onMidiMessage(msg) {
    if (msg.isNoteOn()) {
      onNote(msg);
    }
  }
  /** @param {any} msg */
  function onNote(msg) {
    /** @type {INoteEvent} */
    const noteEvent = {
      timestampMs: Date.now(), // JZZ current does not support timestamps
      note: createNote(msg.getNote())
    };
    
    noteEventBuffer.push(noteEvent);
    clampArrayLeft(noteEventBuffer, NOTE_EVENT_BUFFER_MAX_LENGTH);
    
    noteBuffer.push(noteEvent.note);
    clampArrayLeft(noteBuffer, NOTE_BUFFER_MAX_LENGTH);
    
    showNoteBuffer();
    
    if (curRecordingLength !== null) {
      ++curRecordingLength;
      showShortcutNotes(getRecording(SHORTCUT_MAX_LENGTH));
      return;
    }
    
    for (const shortcut of shortcuts) {
      if (!shortcut.notes || shortcut.notes.length === 0) {
        continue;
      }
      
      const offset = noteEventBuffer.length - shortcut.notes.length;
      if (offset < 0) {
        continue;
      }
      
      const shortcutDurMs = noteEventBuffer[noteEventBuffer.length - 1].timestampMs - noteEventBuffer[offset].timestampMs;
      if (shortcutDurMs > SHORTCUT_MAX_DUR_MS) {
        continue;
      }
      
      let didMatch = true;
      for (let i = 0; i < shortcut.notes.length; ++i) {
        if (noteEventBuffer[offset + i].note.number !== shortcut.notes[i].number) {
          didMatch = false;
          break;
        }
      }
      
      if (didMatch) {
        executeShortcut(shortcut);
        clearNoteBuffer();
        break;
      }
    }
  }
  
  function clearNoteBuffer() {
    noteEventBuffer.splice(0, noteEventBuffer.length);
  }
  
  /** @param {IShortcut} shortcut */
  function executeShortcut(shortcut) {
    showMessage(`Executing ${shortcut.name} shortcut.`);
    try {
      shortcut.exec();
    }
    catch(err) {
      showErrorMessage(`Failed to execute ${shortcut.name} shortcut: ${err.message}`);
      logger.error(err);
    }
  }
  
  function doBack() {
    getAppState().backButton.click();
  }
  function doNext() {
    getAppState().nextButton.click();
  }
  function doPrepare() {
    getAppState().prepareButton.click();
  }
  function doAssess() {
    getAppState().assessButton.click();
  }
  function doStop() {
    const appState = getAppState();
    if (appState.isPreparing) {
      appState.prepareButton.click();
    }
    if (appState.isAssessing) {
      appState.assessButton.click();
    }
  }
  
  /** @returns {IAppState} */
  function getAppState() {
    const controlsContainer = document.getElementById('playerControlContainer');
    if (!controlsContainer) throw new Error(`Unable to find player control container.`);
    
    /** @type {HTMLElement[]} */
    const controlButtons = Array.from(controlsContainer.querySelectorAll('.btn-control'));
    /** @type {HTMLElement[]} */
    const playButtons = Array.from(controlsContainer.querySelectorAll('.btn-play'));
    
    const backButton = controlButtons.find(x => x.querySelector('.fa-backward'));
    if (!backButton) throw new Error(`Unable to find back button.`);
    const nextButton = controlButtons.find(x => x.querySelector('.fa-forward'));
    if (!nextButton) throw new Error(`Unable to find next button.`);
    const prepareButton = playButtons.find(x => x.innerText.toLowerCase() === 'prepare');
    if (!prepareButton) throw new Error(`Unable to find prepare button.`);
    const assessButton = playButtons.find(x => x.innerText.toLowerCase() === 'assess');
    if (!assessButton) throw new Error(`Unable to find assess button.`);
    
    return {
      controlsContainer,
      backButton,
      nextButton,
      prepareButton,
      assessButton,
      isPreparing: prepareButton.querySelector('.fa-square')? true : false,
      isAssessing: assessButton.querySelector('.fa-square')? true : false,
    };
  }
  
  /**
   * @param {ParentNode} parent 
   * @param {string} selectors 
   * @returns {HTMLElement}
   */
  function requireQuerySelector(parent, selectors) {
    const elem = parent.querySelector(selectors);
    if (!elem) throw new Error(`Unable to find ${selectors}`);
    return /** @type {any} */(elem);
  }
  
  /**
   * @template {keyof HTMLElementTagNameMap} T
   * @param {HTMLElement} parent 
   * @param {string} selectors 
   * @param {T} tagName 
   * @returns {HTMLElementTagNameMap[T]}
   */
  function requireQuerySelectorTag(parent, selectors, tagName) {
    const elem = requireQuerySelector(parent, selectors);
    if (elem.tagName.toUpperCase() !== tagName.toUpperCase()) throw new Error(`Found ${selectors} but it is a ${elem.tagName} and not ${tagName}`);
    return /** @type {any} */(elem);
  }
  
  /**
   * @param {any[]} arr 
   * @param {number} maxLength 
   */
  function clampArrayLeft(arr, maxLength) {
    if (arr.length > maxLength) {
      arr.splice(0, arr.length - maxLength);
    }
  }
}





/**
 * @param {Window} window 
 * @param {(param?: any) => void | Promise<void>} fn 
 * @param {any} [jsonParam] 
 */
async function execOnPage(window, fn, jsonParam) {
  const execId = __execIdSeq++;
  const eventName = 'exec-on-page-complete';
  
  const script = window.document.createElement('script');
  script.setAttribute('async', '');
  script.textContent = `
    (async () =>
      await (${fn})(${JSON.stringify(jsonParam)})
    )()
    .then (result => document.dispatchEvent(new CustomEvent(${JSON.stringify(eventName)}, {detail: {id: ${JSON.stringify(execId)}, result}})))
    .catch(error  => document.dispatchEvent(new CustomEvent(${JSON.stringify(eventName)}, {detail: {id: ${JSON.stringify(execId)}, error }})))
  `;
  
  const result = await new Promise((resolve, reject) => {
    /** @type {EventListener} */
    const eventListener = event => {
      if (
        !(event instanceof CustomEvent) ||
        !event.detail ||
        event.detail.id !== execId
      ) {
        return;
      }
      
      window.document.removeEventListener(eventName, eventListener);
      
      if (event.detail.error) {
        reject(event.detail.error);
        return;
      }
      resolve(event.detail.result);
    };
    
    window.document.addEventListener(eventName, eventListener);
    window.document.body.appendChild(script);
  });
  
  //window.document.body.removeChild(script);
  return result;
}