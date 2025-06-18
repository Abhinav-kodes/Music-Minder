// content.js
console.log('Content script loaded on:', window.location.href);
let audioElements = [];
let observer = null;

// Find all audio/video elements
function findAudioElements() {
  audioElements = Array.from(document.querySelectorAll('audio, video'));
  return audioElements.length > 0;
}

// Monitor for new audio elements being added
function startObserving() {
  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element node
          if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') {
            audioElements.push(node);
          }
          // Check for audio/video elements within added nodes
          const newAudioElements = node.querySelectorAll('audio, video');
          audioElements.push(...newAudioElements);
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

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

// Send audio status to background script
function reportAudioStatus() {
  const hasPlayingAudio = audioElements.some(el => !el.paused && !el.muted);
  browser.runtime.sendMessage({
    action: 'audioStatus',
    hasAudio: hasPlayingAudio,
    tabId: null // Will be filled by background script
  });
}
