console.log('Content script loaded on:', window.location.href);

let audioElements = [];
let observer = null;

// Helper: Add event listeners to an audio/video element
function addMediaListeners(media) {
  // Listen for play events (new track or user action)
  media.addEventListener('play', () => {
    console.log('Media play detected:', media.src || media.currentSrc);
    browser.runtime.sendMessage({ action: 'mediaPlayed' });
  });

  // Listen for volume changes (user or site resets volume)
  media.addEventListener('volumechange', () => {
    console.log('Media volumechange:', media.volume);
    browser.runtime.sendMessage({ action: 'mediaVolumeChanged', volume: media.volume });
  });
}

// Find and track all audio/video elements
function findAudioElements() {
  audioElements = Array.from(document.querySelectorAll('audio, video'));
  audioElements.forEach(addMediaListeners);
  return audioElements.length > 0;
}

// Monitor for new audio/video elements being added
function startObserving() {
  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element node
          if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') {
            if (!audioElements.includes(node)) {
              audioElements.push(node);
              addMediaListeners(node);
            }
          }
          // Check for audio/video elements within added nodes
          const newMedia = node.querySelectorAll ? node.querySelectorAll('audio, video') : [];
          newMedia.forEach(media => {
            if (!audioElements.includes(media)) {
              audioElements.push(media);
              addMediaListeners(media);
            }
          });
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Listen for messages from background to set the volume
browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'setVolume') {
    audioElements.forEach(media => {
      media.volume = message.volume;
      console.log('Set media volume to', message.volume, 'for', media.src || media.currentSrc);
    });
  }
});

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    findAudioElements();
    startObserving();
  });
} else {
  findAudioElements();
  startObserving();
}

function checkAndApplyDucking(media) {
  browser.runtime.sendMessage({ action: 'shouldDuck' }).then(response => {
    if (response && response.duck) {
      media.volume = 0.1; // or your ducked volume
      console.log('Ducking applied to', media.src || media.currentSrc);
    }
  });
}

// In your addMediaListeners function:
function addMediaListeners(media) {
  media.addEventListener('play', () => {
    checkAndApplyDucking(media);
    browser.runtime.sendMessage({ action: 'mediaPlayed' });
  });
  media.addEventListener('volumechange', () => {
    checkAndApplyDucking(media);
    browser.runtime.sendMessage({ action: 'mediaVolumeChanged', volume: media.volume });
  });
}
