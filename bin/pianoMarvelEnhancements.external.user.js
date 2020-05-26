// ==UserScript==
// @name          Piano Marvel Enhancements
// @namespace     http://yo1.dog
// @version       4.1.0
// @description   Adds enhancements to painomarvel.com (external)
// @author        Mike "yo1dog" Moore
// @homepageURL   https://github.com/yo1dog/piano-marvel-enhancements#readme
// @icon          https://github.com/yo1dog/piano-marvel-enhancements/raw/master/icon.ico
// @match         *://pianomarvel.com/nextgen/*
// @run-at        document-start
// @resource      jzzResource ../lib/JZZ.js?v=1
// @resource      styleResource ../app/style.css?v=1
// @grant         GM.getResourceURL
// @grant         GM.getResourceUrl
// ==/UserScript==


console.log('yo1dog-pme: Piano Marvel Enhancements loaded');

(async () => {
  // inject a script tag that contains the AMD app
  const script = window.document.createElement('script');
  script.textContent = `(${amdApp})().catch(err => console.error('yo1dog-pme:', err));`;
  document.head.prepend(script);
  
  const jzzUrl = await (GM.getResourceUrl || GM.getResourceURL)('jzzResource');
  const jzzUrlMeta = document.createElement('meta');
  jzzUrlMeta.id = 'yo1dog-pme-jzz-url';
  jzzUrlMeta.content = jzzUrl;
  document.head.appendChild(jzzUrlMeta);
  
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

async function amdApp() {
/**
 * @typedef AMDModule
 * @property {string} name
 * @property {string[]} depNames
 * @property {(...args: any[]) => void} resolveFn
 * @property {object} export
 * @property {boolean} resolved
 */
/** @type {Object<string, AMDModule>} */
const amdModuleMap = {};

/**
 * @param {string} name 
 * @param {string[]} depNames 
 * @param {(...args: any[]) => void} resolveFn 
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function define(name, depNames, resolveFn) {
  amdModuleMap[name] = {name, depNames, resolveFn, export: {}, resolved: false};
}

/**
 * @param {string} name 
 * @param {string[]} [depStack] 
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function require(name, depStack = []) {
  const amdModule = amdModuleMap[name];
  if (!amdModule) throw new Error(`AMD module '${name}' does not exist.`);
  
  if (amdModule.resolved || depStack.includes(name)) {
    return amdModule.export;
  }
  
  depStack = depStack.concat([name]);
  const deps = amdModule.depNames.slice(2).map(depName => require(depName));
  amdModule.resolveFn(require, amdModule.export, ...deps);
  amdModule.resolved = true;
  return amdModule.export;
}define("consts", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.pmMethodNameMap = exports.sharpNoteNames = void 0;
    exports.sharpNoteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    exports.pmMethodNameMap = {
        // from Piano Marvel JS
        pingPlugin: 1,
        startSession: 2,
        getListDevices: 3,
        userSelectDevice: 4,
        checkSongMidiCache: 5,
        saveSongMidi: 6,
        getCurrentDevice: 7,
        preparePlayingData: 9,
        stopPlayMidi: 10,
        playMidiSong: 12,
        saveMidiDeviceKeySetting: 14,
        getLatency: 15,
        getPluginInformation: 17,
        saveNotationData: 19,
        getNotationData: 20,
        userSaveEncryptionKey: 21,
        userGetEncryptionKey: 22,
        userSaveSpeakerOutput: 23,
        userStartSettingDevice: 27,
        userStopSettingDevice: 28,
        userGetDeviceKey: 29,
        keepAlive: 31,
        saveToken: 45,
        startWaitForMeMode: 46,
        stopWaitForMeMode: 47,
        getPianoKeysWaitForMeMode: 48,
        getPracticeMinutesByClientID: 49,
        savePracticeMinutesByClientID: 50,
        resetPracticeMinutesBySongID: 51,
        resetPracticeMinutesByClientID: 52,
        startSettingDeviceSingleConnection: 53,
        stopSettingDeviceSingleConnection: 54
    };
});
define("config", ["require", "exports", "consts"], function (require, exports, consts_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.pmRelayNotesMethodName = exports.restartClickDelayMs = exports.waitForPMWebSocketTimeoutMs = exports.messageBufferMaxLength = exports.noteBufferMaxLength = exports.noteEventBufferMaxLength = exports.shortcutMaxDurMs = exports.shortcutMaxNumNotes = void 0;
    exports.shortcutMaxNumNotes = 5;
    exports.shortcutMaxDurMs = 5000;
    exports.noteEventBufferMaxLength = 5;
    exports.noteBufferMaxLength = 5;
    exports.messageBufferMaxLength = 20;
    exports.waitForPMWebSocketTimeoutMs = 5000;
    exports.restartClickDelayMs = 1000;
    exports.pmRelayNotesMethodName = consts_1.pmMethodNameMap.startSettingDeviceSingleConnection;
});
define("utils", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.notesToString = exports.clampArrayFromEnd = exports.checkTag = exports.requireQuerySelector = exports.createHTML = void 0;
    function createHTML(html) {
        const template = document.createElement('template');
        template.innerHTML = html;
        return template.content;
    }
    exports.createHTML = createHTML;
    function requireQuerySelector(parent, selectors, tagName) {
        const elem = parent.querySelector(selectors);
        if (!elem) {
            throw new Error(`Unable to find ${selectors}`);
        }
        if (tagName && !checkTag(elem, tagName)) {
            throw new Error(`Found ${selectors} but it is a <${elem.tagName}> and not <${tagName}>`);
        }
        return elem;
    }
    exports.requireQuerySelector = requireQuerySelector;
    function checkTag(elem, tagName) {
        return elem.tagName.toUpperCase() === tagName.toUpperCase();
    }
    exports.checkTag = checkTag;
    function clampArrayFromEnd(arr, maxLength) {
        if (arr.length > maxLength) {
            arr.splice(0, arr.length - maxLength);
        }
    }
    exports.clampArrayFromEnd = clampArrayFromEnd;
    function notesToString(notes) {
        return notes.map(note => `${note.name}${note.octave}`).join(', ');
    }
    exports.notesToString = notesToString;
});
define("logger", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.logger = void 0;
    exports.logger = {
        info(message, ...optionalParams) {
            console.log('yo1dog-pme:', message, ...optionalParams);
        },
        error(message, ...optionalParams) {
            console.error('yo1dog-pme:', message, ...optionalParams);
        }
    };
});
define("pmeModule", ["require", "exports", "utils"], function (require, exports, utils_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PMEModule = void 0;
    class PMEModule {
        constructor(config, logger) {
            this.noteEventBuffer = [];
            this.noteBuffer = [];
            this.messageBuffer = [];
            // null means we are not recording
            this.curRecordingLength = null;
            this.curExecShortcut = null;
            this.config = config;
            this.logger = logger;
            this.shortcuts = [
                { name: 'Prepare', exec: () => this.doPrepare() },
                { name: 'Assess', exec: () => this.doAssess() },
                { name: 'Back', exec: () => this.doBack() },
                { name: 'Next', exec: () => this.doNext() },
                { name: 'Start/Stop', exec: () => this.doStartOrStop() },
                { name: 'Start/Restart', exec: () => this.doStartOrRestart() },
            ];
            // create and setup DOM
            const fragment = utils_1.createHTML(`
      <div class="yo1dog-pme-module">
        <div>
          <select class="yo1dog-pme-shortcuts"></select>
          <code class="yo1dog-pme-shortcutNotes"></code>
          <br>
          <button class="yo1dog-pme-recordToggle">${PMEModule.getRecordButtonInnerHTML(false)}</button>
        </div>
        <div><code class="yo1dog-pme-noteBuffer"></code></div>
        <div class="yo1dog-pme-messages"></div>
      </div>
    `);
            this.elem = utils_1.requireQuerySelector(fragment, '.yo1dog-pme-module');
            this.shortcutsElem = utils_1.requireQuerySelector(fragment, '.yo1dog-pme-shortcuts', 'select');
            this.shortcutNotesElem = utils_1.requireQuerySelector(fragment, '.yo1dog-pme-shortcutNotes');
            this.recordToggleButton = utils_1.requireQuerySelector(fragment, '.yo1dog-pme-recordToggle');
            this.noteBufferElem = utils_1.requireQuerySelector(fragment, '.yo1dog-pme-noteBuffer');
            this.messagesElem = utils_1.requireQuerySelector(fragment, '.yo1dog-pme-messages');
            for (const shortcut of this.shortcuts) {
                this.shortcutsElem.options.add(new Option(shortcut.name, shortcut.name));
            }
            this.shortcutsElem.addEventListener('change', () => this.showShortcut(this.getSelectedShortcut()));
            this.recordToggleButton.addEventListener('click', () => this.toggleRecording());
            this.showShortcut(this.getSelectedShortcut());
            this.refreshNoteBufferDisplay();
            this.refreshMessagesDisplay();
        }
        // ----------------------
        // Note Buffer
        // ----------------------
        refreshNoteBufferDisplay() {
            this.noteBufferElem.innerText = utils_1.notesToString(this.noteBuffer);
        }
        clearNoteEventBuffer() {
            this.noteEventBuffer.splice(0, this.noteEventBuffer.length);
        }
        onNote(noteEvent) {
            // add note to buffers
            this.noteEventBuffer.push(noteEvent);
            utils_1.clampArrayFromEnd(this.noteEventBuffer, this.config.noteEventBufferMaxLength);
            this.noteBuffer.push(noteEvent.note);
            utils_1.clampArrayFromEnd(this.noteBuffer, this.config.noteBufferMaxLength);
            this.refreshNoteBufferDisplay();
            // check if we are recording
            if (this.curRecordingLength !== null) {
                ++this.curRecordingLength;
                this.showShortcutNotes(this.getRecording(this.config.shortcutMaxNumNotes));
                return;
            }
            // check if any of the shortcuts where matched
            const matchedShortcut = this.getMatchingShortcut();
            if (matchedShortcut) {
                this.executeShortcutBackground(matchedShortcut);
                this.clearNoteEventBuffer();
            }
        }
        // ----------------------
        // Shortcuts
        // ----------------------
        getShortcuts() {
            return this.shortcuts.slice(0);
        }
        getShortcut(name) {
            return this.shortcuts.find(x => x.name === name);
        }
        setShortcutNotes(shortcut, notes) {
            shortcut.notes = notes;
        }
        getSelectedShortcut() {
            const selectedShortcutName = this.shortcutsElem.value;
            const shortcut = this.getShortcut(selectedShortcutName);
            if (!shortcut)
                throw new Error(`Shortcut with name '${selectedShortcutName}' does not exists.`);
            return shortcut;
        }
        showShortcut(shortcut) {
            if (!shortcut.notes || shortcut.notes.length === 0) {
                this.shortcutNotesElem.innerText = 'not set';
            }
            else {
                this.showShortcutNotes(shortcut.notes);
            }
        }
        showShortcutNotes(notes) {
            this.shortcutNotesElem.innerText = utils_1.notesToString(notes) || '--';
        }
        getMatchingShortcut() {
            // for each shorcut...
            for (const shortcut of this.shortcuts) {
                // make sure the shortcut has a note sequence set
                if (!shortcut.notes || shortcut.notes.length === 0) {
                    continue;
                }
                // new events are added to the end of the buffer. Backup from the end of the buffer to find
                // the first note to match to the shortcut's sequence
                const firstIndex = this.noteEventBuffer.length - shortcut.notes.length;
                if (firstIndex < 0) {
                    continue;
                }
                const firstNoteEvent = this.noteEventBuffer[firstIndex];
                const lastNoteEvent = this.noteEventBuffer[this.noteEventBuffer.length - 1];
                // check if the sequence of notes was played within the max allotted time to be concidered
                // (make sure the last note was not played too long after the first note)
                const shortcutDurMs = lastNoteEvent.timestampMs - firstNoteEvent.timestampMs;
                if (shortcutDurMs > this.config.shortcutMaxDurMs) {
                    continue;
                }
                // check if every note matches
                let didMatch = true;
                for (let i = 0; i < shortcut.notes.length; ++i) {
                    const shortcutNote = shortcut.notes[i];
                    const bufferNote = this.noteEventBuffer[firstIndex + i].note;
                    if (shortcutNote.number !== bufferNote.number) {
                        didMatch = false;
                        break;
                    }
                }
                if (didMatch) {
                    return shortcut;
                }
            }
            return null;
        }
        async executeShortcut(shortcut) {
            if (this.curExecShortcut) {
                this.showMessage(`Ignoring ${shortcut.name} shortcut. ${this.curExecShortcut.name} shortcut already running...`);
                return;
            }
            this.curExecShortcut = shortcut;
            try {
                const promise = shortcut.exec();
                if (promise) {
                    this.showMessage(`Executing ${shortcut.name} shortcut...`);
                }
                await promise;
                this.showMessage(`Executed ${shortcut.name} shortcut.`);
            }
            catch (err) {
                this.showErrorMessage(`Failed to execute ${shortcut.name} shortcut: ${err.message}`);
                this.logger.error(err);
            }
            finally {
                this.curExecShortcut = null;
            }
        }
        executeShortcutBackground(shortcut) {
            this.executeShortcut(shortcut)
                .catch(err => this.logger.error(err));
        }
        doBack() {
            this.pressKey({ key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, charCode: 0 });
        }
        doNext() {
            this.pressKey({ key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, charCode: 0 });
        }
        doPrepare() {
            this.pressKey({ key: '1', code: 'Digit1', keyCode: 49, charCode: 0 });
        }
        doAssess() {
            this.pressKey({ key: '2', code: 'Digit2', keyCode: 50, charCode: 0 });
        }
        doStartOrStop() {
            this.pressKey({ key: ' ', code: 'Space', keyCode: 32, charCode: 0 });
        }
        doStartOrRestart() {
            const appState = this.getAppState();
            const hadStarted = appState.isAssessing || appState.isPreparing;
            this.doStartOrStop();
            if (hadStarted) {
                return new Promise(resolve => setTimeout(() => {
                    this.doStartOrStop();
                    return resolve();
                }, this.config.restartClickDelayMs));
            }
        }
        getAppState() {
            const controlsContainer = document.getElementById('playerControlContainer');
            if (!controlsContainer)
                throw new Error(`Unable to find player control container.`);
            const controlButtons = Array.from(controlsContainer.querySelectorAll('.btn-control'));
            const playButtons = Array.from(controlsContainer.querySelectorAll('.btn-play'));
            const backButton = controlButtons.find(x => x.querySelector('.fa-backward'));
            if (!backButton)
                throw new Error(`Unable to find back button.`);
            const nextButton = controlButtons.find(x => x.querySelector('.fa-forward'));
            if (!nextButton)
                throw new Error(`Unable to find next button.`);
            const prepareButton = playButtons.find(x => x.innerText.toLowerCase() === 'prepare');
            if (!prepareButton)
                throw new Error(`Unable to find prepare button.`);
            const assessButton = playButtons.find(x => x.innerText.toLowerCase() === 'assess');
            if (!assessButton)
                throw new Error(`Unable to find assess button.`);
            const isPreparing = prepareButton.querySelector('.fa-square') ? true : false;
            const isAssessing = assessButton.querySelector('.fa-square') ? true : false;
            const activeButton = isPreparing ? prepareButton : isAssessing ? assessButton : null;
            return {
                controlsContainer,
                backButton,
                nextButton,
                prepareButton,
                assessButton,
                isPreparing,
                isAssessing,
                activeButton
            };
        }
        pressKey(options) {
            document.dispatchEvent(new KeyboardEvent('keydown', options));
        }
        // ----------------------
        // Recording
        // ----------------------
        static getRecordButtonInnerHTML(isRecording) {
            return (isRecording
                ? '&#x23f9;&#xFE0E; Stop'
                : '&#x23fa;&#xFE0E; Record');
        }
        toggleRecording() {
            let isRecording = this.curRecordingLength !== null;
            if (isRecording) {
                const recordedNotes = this.getRecording(this.config.shortcutMaxNumNotes);
                this.stopRecording();
                this.clearNoteEventBuffer();
                this.refreshNoteBufferDisplay();
                const shortcut = this.getSelectedShortcut();
                this.setShortcutNotes(shortcut, recordedNotes);
                if (this.onShortcutUpdated) {
                    this.onShortcutUpdated(shortcut);
                }
                this.showMessage(`Updated ${shortcut.name} shortcut`);
                this.showShortcut(shortcut);
            }
            else {
                this.startRecording();
                this.showShortcutNotes([]);
            }
            isRecording = !isRecording;
            this.recordToggleButton.innerHTML = PMEModule.getRecordButtonInnerHTML(isRecording);
            this.shortcutsElem.disabled = isRecording;
        }
        startRecording() {
            this.showMessage(`Recording started.`);
            this.curRecordingLength = 0;
        }
        stopRecording() {
            this.showMessage(`Recording stoped.`);
            this.curRecordingLength = null;
        }
        getRecording(maxLength) {
            if (this.curRecordingLength === null) {
                throw new Error(`Not recording.`);
            }
            const length = (maxLength === undefined
                ? this.curRecordingLength
                : Math.min(this.curRecordingLength, maxLength));
            if (length < 1) {
                return [];
            }
            return this.noteEventBuffer.slice(-length).map(x => x.note);
        }
        // ----------------------
        // Messages
        // ----------------------
        showMessage(text, isError) {
            if (isError) {
                this.logger.error(text);
            }
            else {
                this.logger.info(text);
            }
            this.messageBuffer.push({
                text,
                isError: isError || false
            });
            utils_1.clampArrayFromEnd(this.messageBuffer, this.config.messageBufferMaxLength);
            this.refreshMessagesDisplay();
        }
        showErrorMessage(text) {
            this.showMessage(text, true);
        }
        refreshMessagesDisplay() {
            // remove all message elements
            while (this.messagesElem.firstChild) {
                this.messagesElem.removeChild(this.messagesElem.firstChild);
            }
            // create message elements
            for (const message of this.messageBuffer) {
                const divElem = document.createElement('div');
                divElem.innerText = message.text;
                if (message.isError) {
                    divElem.classList.add('yo1dog-pme-bad');
                }
                this.messagesElem.appendChild(divElem);
            }
            // scroll to bottom
            this.messagesElem.scrollTop = this.messagesElem.scrollHeight;
        }
    }
    exports.PMEModule = PMEModule;
});
define("settingsManager", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SettingsManager = void 0;
    class SettingsManager {
        constructor(logger) {
            this.logger = logger;
        }
        // NOTE: can't use local storage because Piano Marvel clears it
        async setupDB() {
            this.logger.info('Setting up IDBDatabase...');
            return new Promise((resolve, reject) => {
                const request = indexedDB.open('yo1dog-pme', 3);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    this.db = request.result;
                    this.logger.info('IDBDatabase setup.');
                    return resolve();
                };
                request.onupgradeneeded = () => {
                    const db = request.result;
                    db.deleteObjectStore('settings');
                    db.createObjectStore('settings');
                };
            });
        }
        async saveSettings(key, settings) {
            if (!this.db)
                throw new Error(`Not connected to IDBDatabase.`);
            this.logger.info(`Saving ${key} settings...`);
            const objectStore = this.db.transaction(['settings'], 'readwrite').objectStore('settings');
            return new Promise((resolve, reject) => {
                const request = objectStore.put(settings, key);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    this.logger.info(`Saved ${key} settings.`);
                    return resolve();
                };
            });
        }
        saveSettingsBackground(key, settings) {
            this.saveSettings(key, settings)
                .catch(err => this.logger.error(`Error saving ${key} settings.`, err));
        }
        async loadSettings(key) {
            if (!this.db)
                throw new Error(`Not connected to IDBDatabase.`);
            this.logger.info(`Loading ${key} settings...`);
            const objectStore = this.db.transaction(['settings']).objectStore('settings');
            return new Promise((resolve, reject) => {
                const request = objectStore.get(key);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    this.logger.info(`Loaded ${key} settings.`);
                    resolve(request.result);
                };
            });
        }
    }
    exports.SettingsManager = SettingsManager;
});
define("sharedAppSetup", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.sharedAppSetup = void 0;
    async function sharedAppSetup(pmeModule, containerElem, settingsManager, logger) {
        containerElem.addEventListener('click', event => {
            event.stopPropagation();
            return true;
        });
        // the menu element is destroyed and recreated so we must watch and reattach
        const observer = new MutationObserver(() => {
            const menuElem = document.querySelector('.lesson-menu-left .dropdown-menu.dropdownMenuButton');
            if (menuElem && !menuElem.contains(containerElem)) {
                logger.info('Attaching container to DOM.');
                menuElem.appendChild(containerElem);
            }
        });
        observer.observe(document, { subtree: true, childList: true });
        // setup settings manager
        await settingsManager.setupDB();
        try {
            // load shortcut settings
            const settings = await settingsManager.loadSettings('shortcuts');
            if (settings && Array.isArray(settings.shortcuts)) {
                for (const shortcutSetting of settings.shortcuts) {
                    if (!shortcutSetting ||
                        !Array.isArray(shortcutSetting.notes) ||
                        shortcutSetting.notes.length === 0) {
                        continue;
                    }
                    const shortcut = pmeModule.getShortcut(shortcutSetting.name);
                    if (!shortcut)
                        continue;
                    pmeModule.setShortcutNotes(shortcut, shortcutSetting.notes);
                }
            }
        }
        catch (err) {
            pmeModule.showErrorMessage(`Error loading shortcut settings: ${err.message}`);
            logger.error(err);
        }
        // save shortcut settings whenever a shortcut is updated
        pmeModule.onShortcutUpdated = () => {
            const settings = {
                shortcuts: pmeModule.getShortcuts().map(shortcut => ({
                    name: shortcut.name,
                    notes: shortcut.notes
                }))
            };
            settingsManager.saveSettingsBackground('shortcuts', settings);
        };
    }
    exports.sharedAppSetup = sharedAppSetup;
});
define("externalApp", ["require", "exports", "utils", "consts", "config", "logger", "pmeModule", "settingsManager", "sharedAppSetup"], function (require, exports, utils_2, consts_2, config, logger_1, pmeModule_1, settingsManager_1, sharedAppSetup_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.run = void 0;
    let jzz;
    let pmeModule;
    let containerElem;
    let midiInputsElem;
    let refreshMidiInputsElem;
    let settingsManager;
    let curMidiConnection;
    let preferredMidiInputName;
    async function run() {
        logger_1.logger.info('Piano Marvel Enhancements started');
        pmeModule = new pmeModule_1.PMEModule(config, logger_1.logger);
        const fragment = utils_2.createHTML(`
    <div class="yo1dog-pme-container">
      <div class="yo1dog-pme-header">MIDI Shortcuts</div>
      <div>
        <select class="yo1dog-pme-midiInputs"></select>
        <button class="yo1dog-pme-refreshMidiInputs">Refresh</button>
      </div>
    </div>
  `);
        containerElem = utils_2.requireQuerySelector(fragment, '.yo1dog-pme-container');
        midiInputsElem = utils_2.requireQuerySelector(fragment, '.yo1dog-pme-midiInputs', 'select');
        refreshMidiInputsElem = utils_2.requireQuerySelector(fragment, '.yo1dog-pme-refreshMidiInputs');
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
        settingsManager = new settingsManager_1.SettingsManager(logger_1.logger);
        await sharedAppSetup_1.sharedAppSetup(pmeModule, containerElem, settingsManager, logger_1.logger);
        // load MIDI settings
        try {
            await loadAndApplyMidiSettings();
        }
        catch (err) {
            pmeModule.showErrorMessage(`Error loading MIDI settings: ${err.message}`);
            logger_1.logger.error(err);
        }
        // setup JZZ and Jazz plugin
        pmeModule.showMessage('Loading JZZ...');
        // get the JZZ script URL from meta element
        const jzzUrlMeta = document.getElementById('yo1dog-pme-jzz-url');
        if (!jzzUrlMeta) {
            throw new Error(`Unable to find JZZ URL meta element.`);
        }
        const jzzUrl = jzzUrlMeta.content;
        // inject the script element
        const jzzScriptElem = document.createElement('script');
        jzzScriptElem.src = jzzUrl;
        document.head.appendChild(jzzScriptElem);
        // wait for the JZZ script to load
        if (!window.JZZ) {
            await new Promise(resolve => jzzScriptElem.addEventListener('load', () => resolve()));
        }
        // load JZZ
        try {
            jzz = await window.JZZ();
        }
        catch (err) {
            pmeModule.showErrorMessage(`Error loading JZZ: ${err.message}`);
            logger_1.logger.error(err);
            return;
        }
        const jzzInfo = jzz.info();
        pmeModule.showMessage(`JZZ v${jzzInfo.ver} loaded.`);
        logger_1.logger.info(Object.assign(Object.assign({}, jzzInfo), { inputs: undefined, outputs: undefined }));
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
        if (jzzElem)
            jzzElem.remove();
    }
    exports.run = run;
    function getMidiInputs() {
        const midiInputs = jzz.info().inputs;
        return midiInputs;
    }
    function getSelectedMidiInput() {
        const selectedMidiInputName = midiInputsElem.value;
        if (!selectedMidiInputName)
            return null;
        const midiInputs = getMidiInputs();
        const midiInput = midiInputs.find(x => x.name === selectedMidiInputName);
        if (!midiInput)
            throw new Error(`MIDI input with ID '${selectedMidiInputName}' does not exists.`);
        return midiInput;
    }
    function refreshMidiInputsList() {
        logger_1.logger.info('Refreshing MIDI input list.');
        const midiInputs = getMidiInputs();
        // remove all options
        while (midiInputsElem.options.length > 0) {
            midiInputsElem.options.remove(0);
        }
        // create options for each MIDI input
        for (const midiInput of midiInputs) {
            midiInputsElem.options.add(new Option(midiInput.name, midiInput.name));
        }
        let selectMidiInput;
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
    async function setMidiInput(midiInput) {
        if (curMidiConnection) {
            if (midiInput && midiInput.name === curMidiConnection.input.name) {
                return;
            }
            // remove all listeners from old input
            try {
                await curMidiConnection.port.disconnect();
                await curMidiConnection.port.close();
            }
            catch (err) {
                logger_1.logger.error(`Error closing old midi input.`, err);
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
    function setMidiInputBackground(midiInput) {
        setMidiInput(midiInput)
            .catch(err => {
            pmeModule.showErrorMessage(`Error setting midi input to ${midiInput ? `'${midiInput.name}'` : 'null'}: ${err.message}`);
        });
    }
    function onMidiMessage(msg) {
        if (msg.isNoteOn && msg.isNoteOn()) {
            pmeModule.onNote({
                timestampMs: Date.now(),
                note: createNote(msg.getNote())
            });
        }
    }
    function createNote(noteNumber) {
        return {
            name: consts_2.sharpNoteNames[noteNumber % 12],
            octave: Math.floor(noteNumber / 12),
            number: noteNumber
        };
    }
    async function loadAndApplyMidiSettings() {
        const settings = await settingsManager.loadSettings('midi');
        if (!settings)
            return;
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
});
define("integratedApp", ["require", "exports", "utils", "consts", "config", "logger", "pmeModule", "settingsManager", "sharedAppSetup"], function (require, exports, utils_3, consts_3, config, logger_2, pmeModule_2, settingsManager_2, sharedAppSetup_2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.run = void 0;
    let pmeModule;
    let containerElem;
    let statusElem;
    let curPMWebSocket;
    let inPMWebSocketWaitingPeriod = true;
    async function run() {
        logger_2.logger.info('Piano Marvel Enhancements started');
        pmeModule = new pmeModule_2.PMEModule(config, logger_2.logger);
        const fragment = utils_3.createHTML(`
    <div class="yo1dog-pme-container">
      <div class="yo1dog-pme-header">MIDI Shortcuts</div>
      <div>Status: <span class="yo1dog-pme-status"></span></div>
    </div>
  `);
        containerElem = utils_3.requireQuerySelector(fragment, '.yo1dog-pme-container');
        statusElem = utils_3.requireQuerySelector(fragment, '.yo1dog-pme-status');
        containerElem.appendChild(pmeModule.elem);
        refreshStatusDisplay();
        const settingsManager = new settingsManager_2.SettingsManager(logger_2.logger);
        await sharedAppSetup_2.sharedAppSetup(pmeModule, containerElem, settingsManager, logger_2.logger);
        // monkey patch the WebSocket class so we can intercept the creation of WebSockets
        window.WebSocket = new Proxy(window.WebSocket, {
            construct(WebSocket, args) {
                // @ts-ignore
                const sock = new WebSocket(...args);
                onWebSocketCreated(sock);
                return sock;
            }
        });
        // Because of a race condition between the user script and the page's javascript execution time,
        // the above override may not occur until after the inital WebSocket was created. If this occurs
        // then we are unable to intercept it. In this case, show an error.
        // The only fix for this situation is to have Piano Marvel open a new WebSocket which we can
        // intercept. Disconnecting the WebSocket (by restarting the plugin, for example) accomplishes
        // this.
        pmeModule.showMessage(`Waiting to connect to Piano Marvel WebSocket...`);
        setTimeout(() => {
            inPMWebSocketWaitingPeriod = false;
            refreshStatusDisplay();
            // check if we have never had a WebSocket
            if (!curPMWebSocket) {
                pmeModule.showErrorMessage(`Unable to find Piano Marvel WebSocket. Try hard-refreshing the page or try closing and reopening the Piano Marvel plugin (use the "Exit" button and not the "Restart" button).`);
            }
        }, config.waitForPMWebSocketTimeoutMs);
    }
    exports.run = run;
    function refreshStatusDisplay() {
        let isGood = false;
        if (curPMWebSocket && curPMWebSocket.readyState === WebSocket.OPEN) {
            // we have a connected WebSocket
            statusElem.innerText = 'Connected';
            isGood = true;
        }
        else if (inPMWebSocketWaitingPeriod && !curPMWebSocket) {
            // we are in the waiting period for the first WebSocket AND we have never had a WebSocket
            statusElem.innerText = 'Waiting for connection...';
        }
        else {
            statusElem.innerText = 'Disconnected';
        }
        statusElem.classList.toggle('yo1dog-pme-good', isGood);
        statusElem.classList.toggle('yo1dog-pme-bad', !isGood);
    }
    function onWebSocketCreated(webSocket) {
        // assume it's a WebSocket to the Piano Marvel plugin
        logger_2.logger.info('Piano Marvel WebSocket created.');
        setPMWebSocket(webSocket);
    }
    function setPMWebSocket(webSocket) {
        let socketWasOpened = false;
        curPMWebSocket = webSocket;
        webSocket.addEventListener('message', event => {
            onPMMessage(event, webSocket);
        });
        webSocket.addEventListener('close', () => {
            if (!socketWasOpened)
                return;
            pmeModule.showErrorMessage(`Piano Marvel WebSocket closed.`);
            refreshStatusDisplay();
        });
        if (webSocket.readyState === WebSocket.OPEN) {
            onSocketOpen();
        }
        else {
            webSocket.addEventListener('open', () => onSocketOpen());
        }
        function onSocketOpen() {
            socketWasOpened = true;
            pmeModule.showMessage(`Listening to Piano Marvel WebSocket on '${webSocket.url}'.`);
            refreshStatusDisplay();
        }
    }
    function onPMMessage(event, webSocket) {
        let msg;
        try {
            msg = JSON.parse(event.data);
        }
        catch (err) {
            return;
        }
        if (!msg)
            return;
        if (msg.isNoteOn) {
            const noteEvent = {
                timestampMs: msg.pressTime,
                note: createNote(msg.pitch, msg.octave)
            };
            pmeModule.onNote(noteEvent);
        }
        if (msg.methodName) {
            onPMMethod(msg, webSocket);
        }
    }
    function onPMMethod(msg, webSocket) {
        // The Piano Marvel plugin only sends notes over the WebSocket at certain times. It starts
        // sending notes after certain actions/methods (like changing instrument settings, starting
        // prepare mode, etc.) and stops sending notes after others (like stoping prepare mode).
        // Therefore, to keep notes always sending, we will send a message with a method that causes the
        // plugin to start sending notes after every method response we receive. This way if the Piano
        // Marvel app sends a method that stops the notes from sending we automatically start it again.
        const methodName = config.pmRelayNotesMethodName;
        if (!msg || msg.methodName === methodName)
            return;
        if (webSocket.readyState !== WebSocket.OPEN)
            return;
        webSocket.send(JSON.stringify({ methodName }));
    }
    function createNote(pitch, octave) {
        const noteBaseName = pitch.charAt(0).toUpperCase();
        const noteSuffix = pitch.substring(1).toUpperCase();
        let pitchNumber = consts_3.sharpNoteNames.indexOf(noteBaseName);
        if (noteSuffix === 'SHARP' || noteSuffix === 'SHARD') {
            ++pitchNumber;
        }
        return {
            name: consts_3.sharpNoteNames[pitchNumber],
            octave: octave,
            number: (octave * 12) + pitchNumber
        };
    }
});
await require('externalApp').run();

}