import {
  createHTML,
  requireQuerySelector,
  clampArrayFromEnd,
  notesToString,
} from './utils';

export interface IPMEModuleConfig {
  readonly noteEventBufferMaxLength: number;
  readonly noteBufferMaxLength     : number;
  readonly messageBufferMaxLength  : number;
  readonly shortcutMaxNumNotes     : number;
  readonly shortcutMaxDurMs        : number;
  readonly restartClickDelayMs     : number;
}

interface IShortcut {
  readonly name: string;
  readonly exec: () => Promise<void> | void;
  notes?: INote[];
}

interface IMessage {
  readonly text   : string;
  readonly isError: boolean;
}

export class PMEModule {
  private readonly config: IPMEModuleConfig;
  private readonly logger: ILogger;
  private readonly shortcuts: IShortcut[];
  
  public readonly elem              : HTMLElement;
  public readonly shortcutsElem     : HTMLSelectElement;
  public readonly shortcutNotesElem : HTMLElement;
  public readonly recordToggleButton: HTMLElement;
  public readonly noteBufferElem    : HTMLElement;
  public readonly messagesElem      : HTMLElement;
  
  private readonly noteEventBuffer: INoteEvent[] = [];
  private readonly noteBuffer     : INote[]      = [];
  private readonly messageBuffer  : IMessage[]   = [];
  
  // null means we are not recording
  private curRecordingLength: number | null  = null;
  private curExecShortcut: IShortcut | null  = null;
  
  public onShortcutUpdated: ((shortcut: IShortcut) => void) | undefined;
  
  
  public constructor(config: IPMEModuleConfig, logger: ILogger) {
    this.config = config;
    this.logger = logger;
    this.shortcuts = [
      {name: 'Prepare',       exec: () => this.doPrepare       ()},
      {name: 'Assess',        exec: () => this.doAssess        ()},
      {name: 'Back',          exec: () => this.doBack          ()},
      {name: 'Next',          exec: () => this.doNext          ()},
      {name: 'Start/Stop',    exec: () => this.doStartOrStop   ()},
      {name: 'Start/Restart', exec: () => this.doStartOrRestart()},
    ];
    
    // create and setup DOM
    const fragment = createHTML(`
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
    
    this.elem               = requireQuerySelector(fragment, '.yo1dog-pme-module'             );
    this.shortcutsElem      = requireQuerySelector(fragment, '.yo1dog-pme-shortcuts', 'select');
    this.shortcutNotesElem  = requireQuerySelector(fragment, '.yo1dog-pme-shortcutNotes'      );
    this.recordToggleButton = requireQuerySelector(fragment, '.yo1dog-pme-recordToggle'       );
    this.noteBufferElem     = requireQuerySelector(fragment, '.yo1dog-pme-noteBuffer'         );
    this.messagesElem       = requireQuerySelector(fragment, '.yo1dog-pme-messages'           );
    
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
  public refreshNoteBufferDisplay() {
    this.noteBufferElem.innerText = notesToString(this.noteBuffer);
  }
  
  private clearNoteEventBuffer() {
    this.noteEventBuffer.splice(0, this.noteEventBuffer.length);
  }
  
  public onNote(noteEvent: INoteEvent) {
    // add note to buffers
    this.noteEventBuffer.push(noteEvent);
    clampArrayFromEnd(this.noteEventBuffer, this.config.noteEventBufferMaxLength);
    
    this.noteBuffer.push(noteEvent.note);
    clampArrayFromEnd(this.noteBuffer, this.config.noteBufferMaxLength);
    
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
  public getShortcuts() {
    return this.shortcuts.slice(0);
  }
  public getShortcut(name: string): Readonly<IShortcut> | undefined {
    return this.shortcuts.find(x => x.name === name);
  }
  public setShortcutNotes(shortcut: IShortcut, notes: INote[]) {
    shortcut.notes = notes;
  }
  
  public getSelectedShortcut() {
    const selectedShortcutName = this.shortcutsElem.value;
    const shortcut = this.getShortcut(selectedShortcutName);
    if (!shortcut) throw new Error(`Shortcut with name '${selectedShortcutName}' does not exists.`);
    
    return shortcut;
  }
  
  public showShortcut(shortcut: IShortcut) {
    if (!shortcut.notes || shortcut.notes.length === 0) {
      this.shortcutNotesElem.innerText = 'not set';
    }
    else {
      this.showShortcutNotes(shortcut.notes);
    }
  }
  
  private showShortcutNotes(notes: INote[]) {
    this.shortcutNotesElem.innerText = notesToString(notes) || '--';
  }
  
  public getMatchingShortcut() {
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
  
  public async executeShortcut(shortcut: IShortcut) {
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
  public executeShortcutBackground(shortcut: IShortcut) {
    this.executeShortcut(shortcut)
    .catch(err => this.logger.error(err));
  }
  
  public doBack() {
    this.pressKey({key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, charCode: 0});
  }
  public doNext() {
    this.pressKey({key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, charCode: 0});
  }
  public doPrepare() {
    this.pressKey({key: '1', code: 'Digit1', keyCode: 49, charCode: 0});
  }
  public doAssess() {
    this.pressKey({key: '2', code: 'Digit2', keyCode: 50, charCode: 0});
  }
  public doStartOrStop() {
    this.pressKey({key: ' ', code: 'Space', keyCode: 32, charCode: 0});
  }
  public doStartOrRestart(): Promise<void> | void {
    const appState = this.getAppState();
    const hadStarted = appState.isAssessing || appState.isPreparing;
    
    this.doStartOrStop();
    if (hadStarted) {
      return new Promise(resolve =>
        setTimeout(() => {
          this.doStartOrStop();
          return resolve();
        }, this.config.restartClickDelayMs)
      );
    }
  }
  
  public getAppState() {
    const controlsContainer = document.getElementById('playerControlContainer');
    if (!controlsContainer) throw new Error(`Unable to find player control container.`);
    
    const controlButtons: HTMLElement[] = Array.from(controlsContainer.querySelectorAll('.btn-control'));
    const playButtons: HTMLElement[] = Array.from(controlsContainer.querySelectorAll('.btn-play'));
    
    const backButton = controlButtons.find(x => x.querySelector('.fa-backward'));
    if (!backButton) throw new Error(`Unable to find back button.`);
    const nextButton = controlButtons.find(x => x.querySelector('.fa-forward'));
    if (!nextButton) throw new Error(`Unable to find next button.`);
    const prepareButton = playButtons.find(x => x.innerText.toLowerCase() === 'prepare');
    if (!prepareButton) throw new Error(`Unable to find prepare button.`);
    const assessButton = playButtons.find(x => x.innerText.toLowerCase() === 'assess');
    if (!assessButton) throw new Error(`Unable to find assess button.`);
    
    const isPreparing = prepareButton.querySelector('.fa-square')? true : false;
    const isAssessing = assessButton.querySelector('.fa-square')? true : false;
    const activeButton = isPreparing? prepareButton : isAssessing? assessButton : null;
    
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
  
  public pressKey(options: {
    key     : string;
    code    : string;
    keyCode : number;
    charCode: number;
  }) {
    document.dispatchEvent(new KeyboardEvent('keydown', options));
  }
  
  
  // ----------------------
  // Recording
  // ----------------------
  public static getRecordButtonInnerHTML(isRecording: boolean) {
    return (
      isRecording
      ? '&#x23f9;&#xFE0E; Stop'
      : '&#x23fa;&#xFE0E; Record'
    );
  }
  
  public toggleRecording() {
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
  
  private startRecording() {
    this.showMessage(`Recording started.`);
    this.curRecordingLength = 0;
  }
  private stopRecording() {
    this.showMessage(`Recording stoped.`);
    this.curRecordingLength = null;
  }
  
  private getRecording(maxLength?: number) {
    if (this.curRecordingLength === null) {
      throw new Error(`Not recording.`);
    }
    
    const length = (
      maxLength === undefined
      ? this.curRecordingLength
      : Math.min(this.curRecordingLength, maxLength)
    );
    if (length < 1) {
      return [];
    }
    
    return this.noteEventBuffer.slice(-length).map(x => x.note);
  }
  
  
  // ----------------------
  // Messages
  // ----------------------
  public showMessage(text: string, isError?: boolean) {
    if (isError) {
      this.logger.error(text);
    } else {
      this.logger.info(text);
    }
    
    this.messageBuffer.push({
      text,
      isError: isError || false
    });
    clampArrayFromEnd(this.messageBuffer, this.config.messageBufferMaxLength);
    this.refreshMessagesDisplay();
  }
  public showErrorMessage(text: string) {
    this.showMessage(text, true);
  }
  
  public refreshMessagesDisplay() {
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