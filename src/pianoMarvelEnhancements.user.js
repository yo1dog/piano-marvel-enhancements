// ==UserScript==
// @name          Piano Marvel Enhancements
// @namespace     http://yo1.dog
// @version       1.0.0
// @description   Adds enhancements to painomarvel.com
// @author        Mike "yo1dog" Moore
// @homepageURL   https://github.com/yo1dog/piano-marvel-enhancements#readme
// @icon          https://github.com/yo1dog/piano-marvel-enhancements/raw/master/icon.ico
// @match         *://pianomarvel.com/nextgen/*
// @run-at        document-end
// @resource      webmidiResource ../lib/webmidi.min.js?v=1
// @resource      styleResource style.css?v=2
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
 */

let __execIdSeq = 0; // eslint-disable-line @typescript-eslint/naming-convention

console.log('yo1dog-pme: Piano Marvel Enhancements loaded');

(async () => {
  const webmidiUrl = await (GM.getResourceUrl || GM.getResourceURL)('webmidiResource');
  const styleUrl   = await (GM.getResourceUrl || GM.getResourceURL)('styleResource');
  await execOnPage(window, pianoMarvelEnhancements, {webmidiUrl, styleUrl});
})().catch(err => console.error('yo1dog-pme:', err));

/**
 * @param {object} options 
 * @param {string} options.webmidiUrl 
 * @param {string} options.styleUrl 
 */
async function pianoMarvelEnhancements({webmidiUrl, styleUrl}) {
  const SHORTCUT_MAX_LENGTH = 5;
  const SHORTCUT_MAX_DUR_MS = 5000;
  const BUFFER_MAX_LENGTH = SHORTCUT_MAX_LENGTH;
  
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
  
  logger.log('Injecting webmidi...');
  const webmidiScriptElem = document.createElement('script');
  webmidiScriptElem.src = webmidiUrl;
  headElem.appendChild(webmidiScriptElem);
  if (!/** @type {any} */(window).WebMidi) {
    await new Promise(resolve => webmidiScriptElem.addEventListener('load', () => resolve()));
  }
  
  logger.log('Injecting style...');
  const styleLinkElem = document.createElement('link');
  styleLinkElem.rel = 'stylesheet';
  styleLinkElem.type = 'text/css';
  styleLinkElem.href = styleUrl;
  headElem.appendChild(styleLinkElem);
  
  /** @type {import('../lib/webmidi').WebMidi} */
  const webmidi = /** @type {any} */(window).WebMidi;
  
  /** @type {import('../lib/webmidi').Input | null} */
  let curMidiInput = null;
  
  /** @type {INoteEvent[]} */
  const noteEventBuffer = [];
  
  /** @type {number | null} */
  let curRecordingLength = null;
  
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
    await loadSettings(db);
  } catch(err) {
    logger.error(`Error loading settings.`, err);
  }
  
  const template = document.createElement('template');
  template.innerHTML = `
    <div class="yo1dog-pme-container">
      <div class="yo1dog-pme-header">MIDI Shortcuts</div>
      <select class="yo1dog-pme-inputs"></select><br>
      <br>
      <select class="yo1dog-pme-shortcuts"></select> <code class="yo1dog-pme-shortcutNotes"></code><br>
      <button class="yo1dog-pme-recordToggle">Record</button><br>
      <br>
      <code class="yo1dog-pme-noteBuffer"></code><br>
      <span class="yo1dog-pme-message"></span>
    </div>
  `;
  
  const pmeContainer       = requireQuerySelector   (template.content, '.yo1dog-pme-container');
  const inputsElem         = requireQuerySelectorTag(pmeContainer,     '.yo1dog-pme-inputs', 'select');
  const shortcutsElem      = requireQuerySelectorTag(pmeContainer,     '.yo1dog-pme-shortcuts', 'select');
  const shortcutNotesElem  = requireQuerySelector   (pmeContainer,     '.yo1dog-pme-shortcutNotes');
  const recordToggleButton = requireQuerySelector   (pmeContainer,     '.yo1dog-pme-recordToggle');
  const noteBufferElem     = requireQuerySelector   (pmeContainer,     '.yo1dog-pme-noteBuffer');
  const messageElem        = requireQuerySelector   (pmeContainer,     '.yo1dog-pme-message');
  
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
    const optElem = document.createElement('option');
    optElem.text = shortcut.name;
    optElem.value = shortcut.name;
    shortcutsElem.options.add(optElem);
  }
  
  shortcutsElem.addEventListener('change', () => showShortcut(getSelectedShortcut()));
  recordToggleButton.addEventListener('click', () => toggleRecording());
  
  
  showShortcut(getSelectedShortcut());
  showNoteBuffer();
  
  webmidi.enable(err => {
    if (err) {
      showMessage(`WebMidi could not be enabled.`);
      logger.error(err);
      return;
    }
    
    for (const midiInput of webmidi.inputs) {
      const optElem = document.createElement('option');
      optElem.text = midiInput.name;
      optElem.value = midiInput.id;
      inputsElem.options.add(optElem);
    }
    
    inputsElem.addEventListener('change', () => setMidiInput(getSelectedMidiInput()));
    setMidiInput(getSelectedMidiInput());
  });
  
  function getSelectedShortcut() {
    const selectedShortcutName = shortcutsElem.value;
    const shortcut = shortcuts.find(x => x.name === selectedShortcutName);
    if (!shortcut) throw new Error(`Shortcut with name '${selectedShortcutName}' does not exists.`);
    
    return shortcut;
  }
  
  function getSelectedMidiInput() {
    const selectedMidiInputId = inputsElem.value;
    const midiInput = webmidi.inputs.find(x => x.id === selectedMidiInputId);
    if (!midiInput) throw new Error(`MIDI input with ID '${selectedMidiInputId}' does not exists.`);
    
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
    noteBufferElem.innerText = notesToString(noteEventBuffer.map(x => x.note));
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
      
      recordToggleButton.innerText = 'Stop';
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
      saveSettingsBackground(db);
      
      recordToggleButton.innerText = 'Record';
      shortcutsElem.disabled = false;
      showShortcut(shortcut);
    }
  }
  
  /**
   * @param {import('../lib/webmidi').Input} midiInput 
   */
  function setMidiInput(midiInput) {
    if (curMidiInput) {
      // remove all listeners from old input
      curMidiInput.removeListener();
      showMessage(`Stopped listening to MIDI input '${curMidiInput.name}' (${curMidiInput.id})`);
    }
    
    curMidiInput = midiInput;
    midiInput.addListener('noteon', 'all', event => onNote(event));
    showMessage(`Listening to MIDI input '${midiInput.name}' (${midiInput.id})`);
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
  
  /** @param {string} msg */
  function showMessage(msg) {
    logger.log(msg);
    messageElem.innerText = msg;
  }
  
  /** @returns {Promise<IDBDatabase>} */
  async function setupDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('yo1dog-pme', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('shortcuts', {keyPath: 'name'});
      };
    });
  }
  
  /** @param {IDBDatabase} db */
  async function saveSettings(db) {
    return new Promise((resolve, reject) => {
      // NOTE: can't use local storage because Piano Marvel clears it
      const transaction = db.transaction(['shortcuts'], 'readwrite');
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
      
      const objectStore = transaction.objectStore('shortcuts');
      
      for (const shortcut of shortcuts) {
        const shortcutSetting = {
          name: shortcut.name,
          notes: shortcut.notes
        };
        objectStore.put(shortcutSetting);
      }
    });
  }
  /** @param {IDBDatabase} db */
  function saveSettingsBackground(db) {
    saveSettings(db)
    .catch(err => logger.error(`Error saving settings.`, err));
  }
  
  /** @param {IDBDatabase} db */
  function loadSettings(db) {
    return new Promise((resolve, reject) => {
      const request = (
        db
        .transaction(['shortcuts'])
        .objectStore('shortcuts')
        .getAll()
      );
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const shortcutSettings = request.result;
        
        for (const shortcut of shortcuts) {
          const shortcutSetting = shortcutSettings.find(x => x.name === shortcut.name);
          if (shortcutSetting && shortcutSetting.notes && shortcutSetting.notes.length > 0) {
            shortcut.notes = shortcutSetting.notes;
          }
        }
        
        return resolve();
      };
    });
  }

  /** @param {import('../lib/webmidi').InputEventNoteon} event */
  function onNote(event) {
    noteEventBuffer.push({
      timestampMs: event.timestamp,
      note: event.note
    });
    if (noteEventBuffer.length > BUFFER_MAX_LENGTH) {
      noteEventBuffer.splice(0, noteEventBuffer.length - BUFFER_MAX_LENGTH);
    }
    
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
      showMessage(`Failed to execute ${shortcut.name} shortcut: ${err.message}`);
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