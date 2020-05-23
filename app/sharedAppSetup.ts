import type {PMEModule} from './pmeModule';
import type {SettingsManager} from './settingsManager';


export async function sharedAppSetup(
  pmeModule      : PMEModule,
  containerElem  : HTMLElement,
  settingsManager: SettingsManager,
  logger         : ILogger
) {
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
  observer.observe(document, {subtree: true, childList: true});
  
  // setup settings manager
  await settingsManager.setupDB();
  
  try {
    // load shortcut settings
    const settings = await settingsManager.loadSettings('shortcuts');
    if (settings && Array.isArray(settings.shortcuts)) {
      for (const shortcutSetting of settings.shortcuts) {
        if (
          !shortcutSetting ||
          !Array.isArray(shortcutSetting.notes) ||
          shortcutSetting.notes.length === 0
        ) {
          continue;
        }
        
        const shortcut = pmeModule.getShortcut(shortcutSetting.name);
        if (!shortcut) continue;
        
        pmeModule.setShortcutNotes(shortcut, shortcutSetting.notes);
      }
    }
  } catch(err) {
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