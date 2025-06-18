console.log('Background script loaded!');

let musicTabId = null;
let musicModeActive = false;
let originalMusicVolume = 1.0;
let otherTabsPlaying = new Set();

// Load state on extension startup
browser.storage.local.get(['musicModeActive', 'musicTabId']).then(result => {
  musicModeActive = result.musicModeActive || false;
  musicTabId = result.musicTabId || null;
  console.log('Loaded state:', { musicModeActive, musicTabId });
});

// Message listener for popup and content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);

  if (message.action === 'toggleMusicMode') {
    toggleMusicMode(message.tabId);
    sendResponse({ musicModeActive, musicTabId });
  } else if (message.action === 'getMusicModeState') {
    sendResponse({ musicModeActive, musicTabId });
  } else if (message.action === 'shouldDuck') {
    // Immediate ducking check for content script
    const isMusicTab = sender.tab && sender.tab.id === musicTabId;
    sendResponse({
      duck: musicModeActive && isMusicTab && otherTabsPlaying.size > 0
    });
  }
  return true;
});

// Audio monitoring variables
let audioCheckInterval = null;

// Toggle music mode (on/off)
function toggleMusicMode(tabId) {
  if (musicModeActive && musicTabId === tabId) {
    // Turn off music mode
    musicModeActive = false;
    musicTabId = null;
    stopAudioMonitoring();
    restoreMusicVolume();
    console.log('Music mode disabled');
  } else {
    // Turn on music mode
    musicTabId = tabId;
    musicModeActive = true;
    storeMusicVolume();
    startAudioMonitoring();
    console.log('Music mode enabled for tab:', tabId);
  }
  saveState();
}

// Start/stop monitoring
function startAudioMonitoring() {
  if (audioCheckInterval) clearInterval(audioCheckInterval);
  audioCheckInterval = setInterval(checkTabsAudio, 400);
  console.log('Started audio monitoring interval');
}
function stopAudioMonitoring() {
  if (audioCheckInterval) clearInterval(audioCheckInterval);
  audioCheckInterval = null;
  console.log('Stopped audio monitoring interval');
}

// Check all tabs for audio
function checkTabsAudio() {
  if (!musicModeActive) return;
  browser.tabs.query({}).then(tabs => {
    const currentlyPlaying = new Set();
    tabs.forEach(tab => {
      if (tab.id !== musicTabId && tab.audible) {
        currentlyPlaying.add(tab.id);
      }
    });

    // Detect new and stopped tabs
    const newTabs = [...currentlyPlaying].filter(id => !otherTabsPlaying.has(id));
    const stoppedTabs = [...otherTabsPlaying].filter(id => !currentlyPlaying.has(id));

    // Update state and adjust volume
    if (currentlyPlaying.size > 0 && newTabs.length > 0) {
      lowerMusicVolume();
    } else if (currentlyPlaying.size === 0 && stoppedTabs.length > 0) {
      restoreMusicVolume();
    }
    otherTabsPlaying = currentlyPlaying;
  });
}

// Store initial volume (asks content script for current volume)
function storeMusicVolume() {
  if (!musicTabId) return;
  browser.tabs.sendMessage(musicTabId, { action: 'getCurrentVolume' })
    .then(response => {
      if (response && typeof response.volume === 'number') {
        originalMusicVolume = response.volume;
        console.log('Stored original volume:', originalMusicVolume);
      }
    })
    .catch(error => {
      console.error('Error storing volume:', error);
    });
}

// Lower music volume by messaging content script
function lowerMusicVolume() {
  if (!musicTabId) return;
  const reducedVolume = originalMusicVolume * 0.1;
  browser.tabs.sendMessage(musicTabId, {
    action: 'setVolume',
    volume: reducedVolume
  });
  console.log('Lowered music volume to:', reducedVolume);
}

// Restore music volume by messaging content script
function restoreMusicVolume() {
  if (!musicTabId) return;
  browser.tabs.sendMessage(musicTabId, {
    action: 'setVolume',
    volume: originalMusicVolume
  });
  console.log('Restored music volume to:', originalMusicVolume);
}

// State management
function saveState() {
  browser.storage.local.set({ musicModeActive, musicTabId });
  console.log('State saved:', { musicModeActive, musicTabId });
}

// Handle tab close
browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (musicModeActive && tabId === musicTabId) {
    musicModeActive = false;
    musicTabId = null;
    stopAudioMonitoring();
    saveState();
    console.log('Music tab closed, disabling music mode');
  }
});
