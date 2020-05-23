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


let pmeModule      : PMEModule;
let containerElem  : HTMLElement;
let statusElem     : HTMLElement;
let curPMWebSocket: WebSocket | undefined;
let inPMWebSocketWaitingPeriod = true;

export async function run() {
  logger.info('Piano Marvel Enhancements started');
  
  pmeModule = new PMEModule(config, logger);
  
  const fragment = createHTML(`
    <div class="yo1dog-pme-container">
      <div class="yo1dog-pme-header">MIDI Shortcuts</div>
      <div>Status: <span class="yo1dog-pme-status"></span></div>
    </div>
  `);
  containerElem = requireQuerySelector(fragment, '.yo1dog-pme-container');
  statusElem    = requireQuerySelector(fragment, '.yo1dog-pme-status');
  containerElem.appendChild(pmeModule.elem);
  
  refreshStatusDisplay();
  
  const settingsManager = new SettingsManager(logger);
  await sharedAppSetup(pmeModule, containerElem, settingsManager, logger);
  
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

function onWebSocketCreated(webSocket: WebSocket) {
  // assume it's a WebSocket to the Piano Marvel plugin
  logger.info('Piano Marvel WebSocket created.');
  setPMWebSocket(webSocket);
}

function setPMWebSocket(webSocket: WebSocket) {
  let socketWasOpened = false;
  curPMWebSocket = webSocket;
  
  webSocket.addEventListener('message', event => {
    onPMMessage(event, webSocket);
  });
  webSocket.addEventListener('close', () => {
    if (!socketWasOpened) return;
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

function onPMMessage(event: MessageEvent, webSocket: WebSocket) {
  let msg;
  try {
    msg = JSON.parse(event.data);
  } catch (err) { return; }
  if (!msg) return;
  
  if (msg.isNoteOn) {
    const noteEvent: INoteEvent = {
      timestampMs: msg.pressTime, 
      note: createNote(msg.pitch, msg.octave)
    };
    pmeModule.onNote(noteEvent);
  }
  if (msg.methodName) {
    onPMMethod(msg, webSocket);
  }
}

function onPMMethod(msg: any, webSocket: WebSocket) {
  // The Piano Marvel plugin only sends notes over the WebSocket at certain times. It starts
  // sending notes after certain actions/methods (like changing instrument settings, starting
  // prepare mode, etc.) and stops sending notes after others (like stoping prepare mode).
  // Therefore, to keep notes always sending, we will send a message with a method that causes the
  // plugin to start sending notes after every method response we receive. This way if the Piano
  // Marvel app sends a method that stops the notes from sending we automatically start it again.
  const methodName = config.pmRelayNotesMethodName;
  
  if (!msg || msg.methodName === methodName) return;
  if (webSocket.readyState !== WebSocket.OPEN) return;
  
  webSocket.send(JSON.stringify({methodName}));
}

function createNote(pitch: string, octave: number): INote {
  const noteBaseName = pitch.charAt(0).toUpperCase();
  const noteSuffix = pitch.substring(1).toUpperCase();
  
  let pitchNumber = sharpNoteNames.indexOf(noteBaseName);
  if (noteSuffix === 'SHARP' || noteSuffix === 'SHARD') {
    ++pitchNumber;
  }
  
  return {
    name  : sharpNoteNames[pitchNumber],
    octave: octave,
    number: (octave*12) + pitchNumber
  };
}