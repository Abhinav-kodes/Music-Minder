// popup.js
document.addEventListener('DOMContentLoaded', async () => {
  const musicModeBtn = document.getElementById('musicModeBtn');
  const modeStatus = document.getElementById('modeStatus');
  const statusDisplay = document.getElementById('statusDisplay');

  // Get current tab
  const tabs = await browser.tabs.query({active: true, currentWindow: true});
  const currentTab = tabs[0];

  // Get current music mode state from background script
  const response = await browser.runtime.sendMessage({
    action: 'getMusicModeState'
  });

  // Update UI based on current state
  updateUI(response.musicModeActive, response.musicTabId, currentTab);

  musicModeBtn.addEventListener('click', async () => {
    const response = await browser.runtime.sendMessage({
      action: 'toggleMusicMode',
      tabId: currentTab.id
    });
    
    // Update UI with new state
    updateUI(response.musicModeActive, response.musicTabId, currentTab);
  });

  function updateUI(isActive, activeTabId, currentTab) {
    if (isActive && activeTabId === currentTab.id) {
      // Music mode is active on current tab
      modeStatus.textContent = 'Disable Music Mode';
      statusDisplay.textContent = `Music mode active on: ${currentTab.title}`;
      musicModeBtn.classList.add('active');
    } else if (isActive && activeTabId !== currentTab.id) {
      // Music mode is active on different tab
      modeStatus.textContent = 'Music Mode Active Elsewhere';
      statusDisplay.textContent = 'Music mode is active on another tab';
      musicModeBtn.disabled = true;
    } else {
      // Music mode is not active
      modeStatus.textContent = 'Enable Music Mode';
      statusDisplay.textContent = 'Ready to manage audio';
      musicModeBtn.classList.remove('active');
      musicModeBtn.disabled = false;
    }
  }
});
