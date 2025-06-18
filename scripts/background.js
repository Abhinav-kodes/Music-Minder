// background.js
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

// Single message listener
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  
  if (message.action === 'toggleMusicMode') {
    console.log('Toggling music mode for tab:', message.tabId);
    toggleMusicMode(message.tabId);
    sendResponse({
      musicModeActive: musicModeActive,
      musicTabId: musicTabId
    });
  } else if (message.action === 'getMusicModeState') {
    console.log('Getting music mode state');
    sendResponse({
      musicModeActive: musicModeActive,
      musicTabId: musicTabId
    });
  }
  
  return true;
});

// Audio monitoring variables
let audioCheckInterval = null;

// Single toggleMusicMode function (removed duplicate)
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

// Start monitoring when music mode is enabled
function startAudioMonitoring() {
  if (audioCheckInterval) {
    clearInterval(audioCheckInterval);
  }
  
  audioCheckInterval = setInterval(checkTabsAudio, 1000); // Check every second
  console.log('Started audio monitoring interval');
}

// Stop monitoring when music mode is disabled
function stopAudioMonitoring() {
  if (audioCheckInterval) {
    clearInterval(audioCheckInterval);
    audioCheckInterval = null;
    console.log('Stopped audio monitoring interval');
  }
}

// Check all tabs for audio
function checkTabsAudio() {
  if (!musicModeActive) return;
  
  browser.tabs.query({}).then(tabs => {
    const currentlyPlaying = new Set();
    
    tabs.forEach(tab => {
      if (tab.id !== musicTabId && tab.audible) {
        currentlyPlaying.add(tab.id);
        console.log(`Tab ${tab.id} is playing audio: ${tab.title}`);
      }
    });
    
    // Compare with previous state
    const newTabs = [...currentlyPlaying].filter(id => !otherTabsPlaying.has(id));
    const stoppedTabs = [...otherTabsPlaying].filter(id => !currentlyPlaying.has(id));
    
    // Handle new audio
    newTabs.forEach(tabId => {
      console.log(`New audio detected in tab ${tabId}`);
      otherTabsPlaying.add(tabId);
    });
    
    // Handle stopped audio
    stoppedTabs.forEach(tabId => {
      console.log(`Audio stopped in tab ${tabId}`);
      otherTabsPlaying.delete(tabId);
    });
    
    // Adjust volume based on current state
    if (currentlyPlaying.size > 0 && newTabs.length > 0) {
      console.log('Other tabs playing, lowering music volume');
      lowerMusicVolume();
    } else if (currentlyPlaying.size === 0 && stoppedTabs.length > 0) {
      console.log('No other tabs playing, restoring music volume');
      restoreMusicVolume();
    }
    
    // Update the set
    otherTabsPlaying = currentlyPlaying;
  });
}

// Missing storeMusicVolume function
function storeMusicVolume() {
  if (!musicTabId) return;
  
  browser.tabs.executeScript(musicTabId, {
    code: `
      (function() {
        console.log('Storing volume for:', window.location.href);
        
        function findYouTubeVideo() {
          const selectors = [
            'video.html5-main-video',
            'video.video-stream',
            'video[src*="blob:"]',
            'video'
          ];
          
          for (let selector of selectors) {
            const videoElement = document.querySelector(selector);
            if (videoElement && videoElement.duration) {
              console.log('Found YouTube video element:', selector);
              return videoElement;
            }
          }
          return null;
        }
        
        const videoElement = findYouTubeVideo();
        if (videoElement) {
          const volume = videoElement.volume * 100; // Convert to 0-100 scale
          console.log('YouTube HTML5 video volume stored:', volume);
          return volume;
        } else {
          console.log('No video element found');
          return 50; // default volume
        }
      })();
    `
  }).then(results => {
    if (results && results[0] !== undefined) {
      originalMusicVolume = results[0];
      console.log('Stored original volume:', originalMusicVolume);
    }
  }).catch(error => {
    console.error('Error storing volume:', error);
  });
}


function lowerMusicVolume() {
  if (!musicTabId) return;
  
  const reducedVolume = originalMusicVolume * 0.1;
  console.log('Lowering music volume from', originalMusicVolume, 'to', reducedVolume);
  
  browser.tabs.executeScript(musicTabId, {
    code: `
      (function() {
        function findYouTubeVideo() {
          const selectors = [
            'video.html5-main-video',
            'video.video-stream', 
            'video[src*="blob:"]',
            'video'
          ];
          
          for (let selector of selectors) {
            const video = document.querySelector(selector);
            if (video && video.duration) {
              return video;
            }
          }
          return null;
        }
        
        console.log('Lowering volume on:', window.location.href);
        const videoElement = findYouTubeVideo();
        if (videoElement) {
          videoElement.volume = ${reducedVolume / 100}; // Convert back to 0-1 scale
          console.log('Set YouTube video volume to:', videoElement.volume);
        } else {
          console.log('No video element found for volume control');
        }
      })();
    `
  }).catch(error => {
    console.error('Error lowering volume:', error);
  });
}

function restoreMusicVolume() {
  if (!musicTabId) return;
  
  console.log('Restoring music volume to:', originalMusicVolume);
  
  browser.tabs.executeScript(musicTabId, {
    code: `
      (function() {
        function findYouTubeVideo() {
          const selectors = [
            'video.html5-main-video',
            'video.video-stream',
            'video[src*="blob:"]', 
            'video'
          ];
          
          for (let selector of selectors) {
            const video = document.querySelector(selector);
            if (video && video.duration) {
              return video;
            }
          }
          return null;
        }
        
        console.log('Restoring volume on:', window.location.href);
        const videoElement = findYouTubeVideo();
        if (videoElement) {
          videoElement.volume = ${originalMusicVolume / 100}; // Convert back to 0-1 scale
          console.log('Restored YouTube video volume to:', videoElement.volume);
        } else {
          console.log('No video element found for volume restore');
        }
      })();
    `
  }).catch(error => {
    console.error('Error restoring volume:', error);
  });
}


// State management
function saveState() {
  browser.storage.local.set({
    musicModeActive: musicModeActive,
    musicTabId: musicTabId
  });
  console.log('State saved:', { musicModeActive, musicTabId });
}

// Manual test functions for debugging
function testVolumeControl() {
  console.log('Testing volume control manually...');
  console.log('Music tab ID:', musicTabId);
  console.log('Music mode active:', musicModeActive);
  
  if (musicModeActive && musicTabId) {
    console.log('Manually lowering volume...');
    lowerMusicVolume();
    
    setTimeout(() => {
      console.log('Manually restoring volume...');
      restoreMusicVolume();
    }, 3000);
  }
}

function checkAllTabsAudio() {
  browser.tabs.query({}).then(tabs => {
    console.log('=== All Tabs Audio Status ===');
    tabs.forEach(tab => {
      console.log(`Tab ${tab.id}: ${tab.title} - Audible: ${tab.audible}`);
    });
  });
}

browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (musicModeActive && tabId === musicTabId) {
    console.log('Music tab closed, disabling music mode');
    musicModeActive = false;
    musicTabId = null;
    stopAudioMonitoring();
    saveState();
  }
});
