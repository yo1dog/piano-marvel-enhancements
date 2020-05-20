// ==UserScript==
// @name          Piano Marvel Enhancements
// @namespace     http://yo1.dog
// @version       3.0.1
// @description   Adds enhancements to painomarvel.com
// @author        Mike "yo1dog" Moore
// @homepageURL   https://github.com/yo1dog/piano-marvel-enhancements#readme
// @icon          https://github.com/yo1dog/piano-marvel-enhancements/raw/master/icon.ico
// @match         *://pianomarvel.com/nextgen/*
// @run-at        document-start
// @resource      styleResource style.css?v=11
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
 * @typedef IMessage
 * @property {string} text
 * @property {boolean} isError
 */

console.log('yo1dog-pme: Piano Marvel Enhancements loaded');

(async () => {
  // inject a script tag that contains the pianoMarvelEnhancements function
  const script = window.document.createElement('script');
  script.textContent = `(${pianoMarvelEnhancements})().catch(err => console.error('yo1dog-pme:', err));`;
  document.head.prepend(script);
  
  // inject CSS
  // There is some wierd bug with Violentmonkey on Chrome in which CSS is loaded but not applied
  // after the user script is updated. So instead of injecting a <link href="..."> we manually
  // fetch the CSS and inject it into a <style>
  const styleUrl = await (GM.getResourceUrl || GM.getResourceURL)('styleResource');
  const req = await fetch(styleUrl);
  if (!req.ok) throw new Error(`Failed to load CSS: ${req.status}`);
  const css = await req.text();
  
  const styleElem = document.createElement('style');
  styleElem.type = 'text/css';
  styleElem.textContent = css;
  document.head.appendChild(styleElem);
})().catch(err => console.error('yo1dog-pme:', err));


async function pianoMarvelEnhancements() {
  const SHORTCUT_MAX_LENGTH = 5;
  const SHORTCUT_MAX_DUR_MS = 5000;
  const NOTE_EVENT_BUFFER_MAX_LENGTH = SHORTCUT_MAX_LENGTH;
  const NOTE_BUFFER_MAX_LENGTH = NOTE_EVENT_BUFFER_MAX_LENGTH;
  const MESSAGE_BUFFER_MAX_LENGTH = 20;
  const FIRST_PM_WEB_SOCKET_TIMEOUT_MS = 5000;
  
  const NOTE_NAMES_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const PIANO_MARVEL_METHOD_NAME_MAP = {
    // from Piano Marvel JS
    pingPlugin:1,startSession:2,getListDevices:3,userSelectDevice:4,checkSongMidiCache:5,saveSongMidi:6,getCurrentDevice:7,preparePlayingData:9,stopPlayMidi:10,playMidiSong:12,saveMidiDeviceKeySetting:14,getLatency:15,getPluginInformation:17,saveNotationData:19,getNotationData:20,userSaveEncryptionKey:21,userGetEncryptionKey:22,userSaveSpeakerOutput:23,userStartSettingDevice:27,userStopSettingDevice:28,userGetDeviceKey:29,keepAlive:31,saveToken:45,startWaitForMeMode:46,stopWaitForMeMode:47,getPianoKeysWaitForMeMode:48,getPracticeMinutesByClientID:49,savePracticeMinutesByClientID:50,resetPracticeMinutesBySongID:51,resetPracticeMinutesByClientID:52,startSettingDeviceSingleConnection:53,stopSettingDeviceSingleConnection:54
  };
  const PIANO_MARVEL_SEND_NOTES_METHOD = PIANO_MARVEL_METHOD_NAME_MAP.startSettingDeviceSingleConnection;
  
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
  
  const template = document.createElement('template');
  template.innerHTML = `
    <div class="yo1dog-pme-container">
      <div class="yo1dog-pme-header">MIDI Shortcuts</div>
      <div>Status: <span class="yo1dog-pme-status"></span></div>
      <div>
        <select class="yo1dog-pme-shortcuts"></select>
        <code class="yo1dog-pme-shortcutNotes"></code>
        <br>
        <button class="yo1dog-pme-recordToggle">${getRecordButtonInnerHTML(false)}</button>
      </div>
      <div><code class="yo1dog-pme-noteBuffer"></code></div>
      <div class="yo1dog-pme-messages"></div>
    </div>
  `;
  
  const pmeContainer        = requireQuerySelector   (template.content, '.yo1dog-pme-container');
  const statusElem          = requireQuerySelector   (pmeContainer,     '.yo1dog-pme-status');
  const shortcutsElem       = requireQuerySelectorTag(pmeContainer,     '.yo1dog-pme-shortcuts', 'select');
  const shortcutNotesElem   = requireQuerySelector   (pmeContainer,     '.yo1dog-pme-shortcutNotes');
  const recordToggleButton  = requireQuerySelector   (pmeContainer,     '.yo1dog-pme-recordToggle');
  const noteBufferElem      = requireQuerySelector   (pmeContainer,     '.yo1dog-pme-noteBuffer');
  const messagesElem        = requireQuerySelector   (pmeContainer,     '.yo1dog-pme-messages');
  
  /** @type {WebSocket | null} */ let   curPMWebSocket     = null;
  /** @type {INoteEvent[]}     */ const noteEventBuffer    = [];
  /** @type {INote[]}          */ const noteBuffer         = [];
  /** @type {number | null}    */ let   curRecordingLength = null;
  /** @type {IMessage[]}       */ const messageBuffer      = [];
  
  // override the WebSocket class so we can intercept the creation of web sockets
  // @ts-ignore
  window.WebSocket = new Proxy(window.WebSocket, {
    construct(WebSocket, args) {
      // @ts-ignore
      const sock = new WebSocket(...args);
      onWebSocketCreated(sock);
      return sock;
    }
  });
  
  // Because of a race condition between the user script and the page's javascript execution time,
  // the above override may not occur until after the inital web socket was created. If this occurs
  // then we are unable to intercept it. In this case, show an error.
  // The only fix for this situation is to have Piano Marvel open a new web socket which we can
  // intercept. Disconnecting the web socket (by restarting the plugin, for example) accomplishes
  // this.
  showMessage(`Waiting to connect to Piano Marvel web socket...`);
  setTimeout(() => {
    if (!curPMWebSocket) {
      showErrorMessage(`Unable to connect to Piano Marvel web socket. Try hard-refreshing the page or try closing and reopening the Piano Marvel plugin (use the "Exit" button and not the "Restart" button).`);
    }
  }, FIRST_PM_WEB_SOCKET_TIMEOUT_MS);
  
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
  refreshNoteBufferDisplay();
  refreshMessagesDisplay();
  refreshStatus();
  
  
  /** @param {WebSocket} webSocket */
  function onWebSocketCreated(webSocket) {
    // assume it's a websocket to the Piano Marvel plugin
    setPianoMarvelWebSocket(webSocket);
  }
  
  /** @param {WebSocket} webSocket */
  function setPianoMarvelWebSocket(webSocket) {
    let socketWasOpened = false;
    curPMWebSocket = webSocket;
    
    webSocket.addEventListener('message', event => {
      onPianoMarvelMessage(event, webSocket);
    });
    webSocket.addEventListener('close', () => {
      if (!socketWasOpened) return;
      showErrorMessage(`Piano Marvel web socket closed.`);
      refreshStatus();
    });
    
    if (webSocket.readyState === WebSocket.OPEN) {
      onSocketOpen();
    }
    else {
      webSocket.addEventListener('open', () => onSocketOpen());
    }
    
    function onSocketOpen() {
      socketWasOpened = true;
      showMessage(`Listening to Piano Marvel web socket on '${webSocket.url}'.`);
      refreshStatus();
    }
  }
  
  function refreshStatus() {
    const isConnected = curPMWebSocket && curPMWebSocket.readyState === WebSocket.OPEN;
    if (isConnected) {
      statusElem.innerText = 'Connected';
      statusElem.classList.remove('yo1dog-pme-bad');
      statusElem.classList.add   ('yo1dog-pme-good');
    }
    else {
      statusElem.innerText = 'Disconnected';
      statusElem.classList.remove('yo1dog-pme-good');
      statusElem.classList.add   ('yo1dog-pme-bad');
    }
  }
  
  function getSelectedShortcut() {
    const selectedShortcutName = shortcutsElem.value;
    const shortcut = shortcuts.find(x => x.name === selectedShortcutName);
    if (!shortcut) throw new Error(`Shortcut with name '${selectedShortcutName}' does not exists.`);
    
    return shortcut;
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
  
  function refreshNoteBufferDisplay() {
    noteBufferElem.innerText = notesToString(noteBuffer);
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
      
      recordToggleButton.innerHTML = getRecordButtonInnerHTML(true);
      shortcutsElem.disabled = true;
      showShortcutNotes([]);
    }
    else {
      const recordedNotes = getRecording(SHORTCUT_MAX_LENGTH);
      stopRecording();
      clearNoteBuffer();
      refreshNoteBufferDisplay();
      
      const shortcut = getSelectedShortcut();
      shortcut.notes = recordedNotes;
      showMessage(`Updated ${shortcut.name} shortcut`);
      saveSettingsBackground();
      
      recordToggleButton.innerHTML = getRecordButtonInnerHTML(false);
      shortcutsElem.disabled = false;
      showShortcut(shortcut);
    }
  }
  /** @param {boolean} isRecording */
  function getRecordButtonInnerHTML(isRecording) {
    return isRecording? '&#x23f9;&#xFE0E; Stop' : '&#x23fa;&#xFE0E; Record';
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
    refreshMessagesDisplay();
  }
  /** @param {string} text */
  function showErrorMessage(text) {
    showMessage(text, true);
  }
  function refreshMessagesDisplay() {
    while (messagesElem.firstChild) {
      messagesElem.removeChild(messagesElem.firstChild);
    }
    
    for (const message of messageBuffer) {
      const divElem = document.createElement('div');
      divElem.innerText = message.text;
      if (message.isError) {
        divElem.classList.add('yo1dog-pme-bad');
      }
      messagesElem.appendChild(divElem);
    }
    
    messagesElem.scrollTop = messagesElem.scrollHeight;
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
        }))
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
        }
        
        return resolve();
      };
    });
  }
  
  /**
   * @param {MessageEvent} event
   * @param {WebSocket} webSocket
   */
  function onPianoMarvelMessage(event, webSocket) {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch (err) { return; }
    if (!msg) return;
    
    if (msg.isNoteOn) {
      onNote(msg);
    }
    if (msg.methodName) {
      onPianoMarvelMethod(msg, webSocket);
    }
  }
  
  /** @param {any} msg */
  function onNote(msg) {
    /** @type {INoteEvent} */
    const noteEvent = {
      timestampMs: msg.pressTime, 
      note: createNote(msg.pitch, msg.octave)
    };
    
    noteEventBuffer.push(noteEvent);
    clampArrayLeft(noteEventBuffer, NOTE_EVENT_BUFFER_MAX_LENGTH);
    
    noteBuffer.push(noteEvent.note);
    clampArrayLeft(noteBuffer, NOTE_BUFFER_MAX_LENGTH);
    
    refreshNoteBufferDisplay();
    
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
  
  /**
   * @param {any} msg
   * @param {WebSocket} webSocket
   */
  function onPianoMarvelMethod(msg, webSocket) {
    if (webSocket.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // The Piano Marvel plugin only sends notes over the websocket at certain times. It starts
    // sending notes after certain actions/methods (like changing instrument settings, starting
    // prepare mode, etc.) and stops sending notes after others (like stoping prepare mode).
    // Therefore, to keep notes always sending, we will send a message with a method that causes the
    // plugin to start sending notes after every method response we receive. This way if the Piano
    // Marvel app sends a method that stops the notes from sending we automatically start it again.
    if (msg.methodName && msg.methodName !== PIANO_MARVEL_SEND_NOTES_METHOD) {
      webSocket.send(JSON.stringify({
        methodName: PIANO_MARVEL_SEND_NOTES_METHOD
      }));
    }
  }
  
  function clearNoteBuffer() {
    noteEventBuffer.splice(0, noteEventBuffer.length);
  }
  
  /** @param {IShortcut} shortcut */
  function executeShortcut(shortcut) {
    try {
      shortcut.exec();
    }
    catch(err) {
      showErrorMessage(`Failed to execute ${shortcut.name} shortcut: ${err.message}`);
      logger.error(err);
      return;
    }
    showMessage(`Executed ${shortcut.name} shortcut.`);
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
  
  /**
   * @param {string} pitch
   * @param {number} octave
   * @returns {INote}
   */
  function createNote(pitch, octave) {
    const noteBaseName = pitch.charAt(0).toUpperCase();
    const noteSuffix = pitch.substring(1).toUpperCase();
    
    let pitchNumber = NOTE_NAMES_SHARP.indexOf(noteBaseName);
    if (noteSuffix === 'SHARP' || noteSuffix === 'SHARD') {
      ++pitchNumber;
    }
    
    return {
      name  : NOTE_NAMES_SHARP[pitchNumber],
      octave: octave,
      number: (octave*12) + pitchNumber
    };
  }
}