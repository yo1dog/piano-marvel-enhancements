export class SettingsManager {
  private readonly logger   : ILogger;
  private db: IDBDatabase | undefined;
  
  constructor(logger: ILogger) {
    this.logger = logger;
  }
  
  // NOTE: can't use local storage because Piano Marvel clears it
  public async setupDB(): Promise<void> {
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
  
  public async saveSettings(key: string, settings: unknown) {
    if (!this.db) throw new Error(`Not connected to IDBDatabase.`);
    
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
  public saveSettingsBackground(key: string, settings: unknown) {
    this.saveSettings(key, settings)
    .catch(err => this.logger.error(`Error saving ${key} settings.`, err));
  }
  
  public async loadSettings(key: string): Promise<any> {
    if (!this.db) throw new Error(`Not connected to IDBDatabase.`);
    
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
