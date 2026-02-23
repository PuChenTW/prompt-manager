// db.js
// Simple wrapper for IndexedDB operations

const DB_NAME = 'PromptManagerDB';
const DB_VERSION = 1;
const STORE_NAME = 'prompts';

const db = {
    _db: null,

    async init() {
        if (this._db) return this._db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("Database error: ", event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this._db = event.target.result;
                resolve(this._db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    // Create an object store with 'id' as the key path
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
        });
    },

    async getAllPrompts() {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                // Ensure we always return an array
                resolve(request.result || []);
            };

            request.onerror = (event) => {
                console.error("Error fetching prompts: ", event.target.error);
                reject(event.target.error);
            };
        });
    },

    async savePrompts(prompts) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            // Clear existing and add new to ensure exact sync
            const clearRequest = store.clear();

            clearRequest.onsuccess = () => {
                let completed = 0;
                if (prompts.length === 0) {
                    resolve();
                    return;
                }

                prompts.forEach((prompt) => {
                    const addRequest = store.add(prompt);
                    addRequest.onsuccess = () => {
                        completed++;
                        if (completed === prompts.length) {
                            resolve();
                        }
                    };
                    addRequest.onerror = (event) => {
                        console.error("Error saving prompt: ", event.target.error);
                        reject(event.target.error);
                    };
                });
            };

            clearRequest.onerror = (event) => {
                reject(event.target.error);
            };

            transaction.onerror = (event) => {
                reject(event.target.error);
            }
        });
    }
};

// If used in module context, export it. Otherwise it attaches to global object (window/self).
if (typeof module !== 'undefined' && module.exports) {
    module.exports = db;
}
