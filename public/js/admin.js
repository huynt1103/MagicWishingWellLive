/**
 * Admin Panel Controller for The Magic Wishing Well - TikTok Live Interactive
 */

const socket = io();

// UI Elements
const statusBadge = document.getElementById('status-badge');
const statusText = document.getElementById('status-text');
const tiktokUserInput = document.getElementById('tiktok-username');
const tiktokSessionInput = document.getElementById('tiktok-sessionid');
const btnConnect = document.getElementById('btn-connect');
const btnDisconnect = document.getElementById('btn-disconnect');
const btnToggleSim = document.getElementById('btn-toggle-sim');
const logBox = document.getElementById('event-logs');

// Audio / Config Elements
const ttsVoiceSelect = document.getElementById('tts-voice');
const ttsEnabledCheck = document.getElementById('tts-enabled');
const bgmVolumeInput = document.getElementById('bgm-volume');
const btnSaveConfig = document.getElementById('btn-save-config');
const btnTestVoice = document.getElementById('btn-test-voice');

let isSimulating = false;

// Log messages are HTML; every value coming from TikTok viewers or the server must go through this
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Helper to append logs
function addLog(type, message) {
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.innerHTML = `<span class="time">[${time}]</span> ${message}`;
  logBox.appendChild(entry);
  logBox.scrollTop = logBox.scrollHeight;
}

// Update connection UI
function updateConnectionUI(status, user = '', error = '') {
  statusBadge.className = `status-badge ${status}`;
  if (status === 'connected') {
    statusText.innerText = `Connected with @${user}`;
    btnConnect.disabled = true;
    btnDisconnect.disabled = false;
  } else if (status === 'connecting') {
    statusText.innerText = `Connecting to @${user}...`;
    btnConnect.disabled = true;
    btnDisconnect.disabled = false;
  } else if (status === 'error') {
    statusText.innerText = `Error: ${error || 'Failed to connect'}`;
    btnConnect.disabled = false;
    btnDisconnect.disabled = true;
  } else {
    statusText.innerText = 'Disconnected';
    btnConnect.disabled = false;
    btnDisconnect.disabled = true;
  }
}

// Update Simulation button UI
function updateSimUI(active) {
  isSimulating = active;
  if (btnToggleSim) {
    if (active) {
      btnToggleSim.innerText = '⏹️ Stop Live Simulation';
      btnToggleSim.className = 'btn btn-danger';
    } else {
      btnToggleSim.innerText = '▶️ Start Live Simulation';
      btnToggleSim.className = 'btn btn-gold';
    }
  }
}

// Socket event listeners
socket.on('init_state', data => {
  if (data.connectionStatus) {
    updateConnectionUI(data.connectionStatus, data.tiktokUser);
  }
  if (data.config) {
    if (ttsVoiceSelect) ttsVoiceSelect.value = data.config.ttsVoice || 'alternate';
    if (ttsEnabledCheck) ttsEnabledCheck.checked = !!data.config.ttsEnabled;
    if (data.config.bgmVolume !== undefined && bgmVolumeInput) {
      bgmVolumeInput.value = data.config.bgmVolume;
    }
  }
  if (data.isSimulating !== undefined) {
    updateSimUI(data.isSimulating);
  }
  addLog('sys', 'Connected to Wishing Well controller server.');
});

socket.on('connection_status', data => {
  updateConnectionUI(data.status, data.user, data.error);
  if (data.status === 'connected') {
    addLog('sys', `Successfully connected to live stream of @${escapeHtml(data.user)}!`);
  } else if (data.status === 'error') {
    addLog('sys', `Connection error: ${escapeHtml(data.error)}`);
  } else if (data.status === 'connecting' && data.reconnectAttempt) {
    addLog('sys', `Connection lost. Reconnecting in ${Math.round((data.reconnectDelayMs || 0) / 1000)}s (attempt ${escapeHtml(data.reconnectAttempt)})...`);
  }
});

socket.on('simulation_status', data => {
  updateSimUI(data.active);
  addLog('sys', data.active ? 'Auto simulation started.' : 'Auto simulation stopped.');
});

socket.on('tiktok_chat', data => {
  const comment = data.comment || data.content || '';
  if (comment && comment !== 'undefined') {
    addLog('chat', `[Chat] <b>${escapeHtml(data.nickname || 'Friend')}</b>: ${escapeHtml(comment)}`);
  }
});

socket.on('tiktok_gift', data => {
  addLog('gift', `[Gift] <b>${escapeHtml(data.nickname)}</b> tossed <b>${escapeHtml(data.giftName)}</b> (${escapeHtml(data.coins)} coins)`);
});

socket.on('tiktok_like', data => {
  addLog('like', `[Like] <b>${escapeHtml(data.nickname)}</b> sent likes & tossed lucky sparks`);
});

socket.on('tiktok_follow', data => {
  addLog('chat', `[Follow] <b>${escapeHtml(data.nickname)}</b> followed the Wishing Well!`);
});

socket.on('tiktok_share', data => {
  addLog('chat', `[Share] <b>${escapeHtml(data.nickname)}</b> shared the magic fountain!`);
});

socket.on('tiktok_join', data => {
  addLog('sys', `[Join] 🌸 <b>${escapeHtml(data.nickname)}</b> arrived at the Wishing Well.`);
});

socket.on('offering_event', data => {
  addLog('gift', `[Fountain Surge] <b>${escapeHtml(data.nickname)}</b> triggered hearts fountain surge!`);
});

// Connect TikTok Live
btnConnect.addEventListener('click', async () => {
  const username = tiktokUserInput.value.trim().replace(/^@/, '');
  const sessionId = tiktokSessionInput ? tiktokSessionInput.value.trim() : '';

  if (!username) {
    alert('Please enter a TikTok Username (e.g. stream_handle)');
    return;
  }
  updateConnectionUI('connecting', username);
  try {
    const res = await fetch('/api/tiktok/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uniqueId: username, sessionId: sessionId })
    });
    const json = await res.json();
    addLog('sys', escapeHtml(json.message || json.error));
  } catch (err) {
    updateConnectionUI('error', username, err.message);
  }
});

btnDisconnect.addEventListener('click', async () => {
  try {
    await fetch('/api/tiktok/disconnect', { method: 'POST' });
    updateConnectionUI('disconnected');
    addLog('sys', 'Disconnected from TikTok');
  } catch (err) {
    console.error(err);
  }
});

// Toggle simulation
btnToggleSim.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/simulation/toggle', { method: 'POST' });
    const data = await res.json();
    updateSimUI(data.isSimulating);
  } catch (e) {
    console.error(e);
  }
});

// Save configuration
btnSaveConfig.addEventListener('click', async () => {
  const config = {
    ttsVoice: ttsVoiceSelect ? ttsVoiceSelect.value : 'alternate',
    ttsEnabled: ttsEnabledCheck ? ttsEnabledCheck.checked : true,
    bgmVolume: parseFloat(bgmVolumeInput.value || 0.30),
    ttsLang: ttsVoiceSelect.value.startsWith('vi') ? 'vi' : 'en'
  };
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (res.ok) {
      addLog('sys', 'Audio and AI Voice settings saved.');
      alert('Settings successfully updated!');
    }
  } catch (e) {
    alert('Failed to save settings: ' + e.message);
  }
});

// Test Voice TTS
btnTestVoice.addEventListener('click', async () => {
  btnTestVoice.disabled = true;
  btnTestVoice.innerText = 'Speaking...';
  try {
    const text = 'Warmest welcome to the Magic Wishing Well! May fortune and good cheer honour your path today!';
    const voice = ttsVoiceSelect.value;
    const lang = voice.startsWith('vi') ? 'vi' : 'en';
    const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}&voice=${voice}&lang=${lang}`);
    const json = await res.json();
    if (json.audioUrl) {
      const audio = new Audio(json.audioUrl);
      audio.play();
      audio.onended = () => {
        btnTestVoice.disabled = false;
        btnTestVoice.innerText = '🔊 Test AI Voice';
      };
    } else {
      btnTestVoice.disabled = false;
      btnTestVoice.innerText = '🔊 Test AI Voice';
    }
  } catch (err) {
    btnTestVoice.disabled = false;
    btnTestVoice.innerText = '🔊 Test AI Voice';
    alert('Voice test error: ' + err.message);
  }
});

// ==================== SIMULATOR HANDLERS ====================

document.getElementById('sim-1xu').addEventListener('click', async () => {
  const name = ['Alexander M.', 'Sophia Green', 'Liam Walker', 'Olivia Smith'][Math.floor(Math.random() * 4)];
  await fetch('/api/test/gift', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nickname: name,
      coins: 1,
      giftName: 'Lucky Penny'
    })
  });
});

document.getElementById('sim-5xu').addEventListener('click', async () => {
  await fetch('/api/test/gift', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nickname: 'Sophia Green',
      coins: 5,
      giftName: 'Crystal Rose'
    })
  });
});

document.getElementById('sim-10xu').addEventListener('click', async () => {
  await fetch('/api/test/gift', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nickname: 'Alexander Miller',
      coins: 10,
      giftName: 'Golden Crown'
    })
  });
});

document.getElementById('sim-50tim').addEventListener('click', async () => {
  await fetch('/api/test/flower', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: 'Amelia Taylor' })
  });
});

document.getElementById('sim-all-bow').addEventListener('click', async () => {
  await fetch('/api/test/bow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ duration: 4000 })
  });
});

document.getElementById('sim-join').addEventListener('click', async () => {
  await fetch('/api/test/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
});

document.getElementById('sim-chat').addEventListener('click', async () => {
  await fetch('/api/test/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
});

const btn20Likes = document.getElementById('sim-20likes');
if (btn20Likes) {
  btn20Likes.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/test/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 20 })
      });
      const data = await res.json();
      addLog('like', `⚡ ${escapeHtml(data.payload.nickname)} tapped 20 likes! Dropped a coin into the well.`);
    } catch (e) {
      console.error(e);
    }
  });
}

const btnFillSeats = document.getElementById('sim-fill-seats');
if (btnFillSeats) {
  btnFillSeats.addEventListener('click', async () => {
    try {
      await fetch('/api/test/fill-full', { method: 'POST' });
      addLog('sys', '🪑 Filled all 36 lake seats with active pilgrims.');
    } catch (e) {
      console.error(e);
    }
  });
}

const btnResetSeats = document.getElementById('sim-reset-seats');
if (btnResetSeats) {
  btnResetSeats.addEventListener('click', async () => {
    try {
      await fetch('/api/test/reset-seats', { method: 'POST' });
      addLog('sys', '🧹 Cleared all 36 lake seats to empty status.');
    } catch (e) {
      console.error(e);
    }
  });
}

const btnDethrone = document.getElementById('sim-dethrone');
if (btnDethrone) {
  btnDethrone.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/test/dethrone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      addLog('gift', `⚡ Top 1 Dethroned! ${escapeHtml(data.newLeader.nickname)} took the crown from ${escapeHtml(data.oldLeader.nickname)}!`);
    } catch (e) {
      console.error(e);
    }
  });
}

const btnAwaken = document.getElementById('sim-awaken');
if (btnAwaken) {
  btnAwaken.addEventListener('click', async () => {
    try {
      await fetch('/api/test/awaken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      addLog('sys', '💧 Water Resonance Awakened! Mega surge event triggered.');
    } catch (e) {
      console.error(e);
    }
  });
}

document.getElementById('btn-custom-gift').addEventListener('click', async () => {
  const name = document.getElementById('custom-name').value.trim() || 'Generous Soul';
  const gift = document.getElementById('custom-gift-name').value.trim() || 'Sacred Gem';
  const coins = parseInt(document.getElementById('custom-coins').value || 10, 10);

  await fetch('/api/test/gift', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nickname: name,
      giftName: gift,
      coins: coins
    })
  });
});

document.getElementById('btn-reset-lb').addEventListener('click', async () => {
  if (confirm('Are you sure you want to reset the Fountain Guardians leaderboard?')) {
    await fetch('/api/leaderboard/reset', { method: 'POST' });
    addLog('sys', 'Fountain Guardians leaderboard reset.');
  }
});

// Anti-Ban & OCR toggles
let cardsVisible = true;
const btnToggleCards = document.getElementById('btn-toggle-cards');
if (btnToggleCards) {
  btnToggleCards.addEventListener('click', () => {
    cardsVisible = !cardsVisible;
    socket.emit('toggle_donation_cards', { visible: cardsVisible });
    btnToggleCards.innerText = cardsVisible 
      ? '👁️ Hide Action Cards' 
      : '👁️ Show Action Cards';
    addLog('sys', cardsVisible ? 'Displayed bottom action cards.' : 'Hidden bottom action cards (OCR safe mode).');
  });
}

const btnToggleHalo = document.getElementById('btn-toggle-halo');
if (btnToggleHalo) {
  btnToggleHalo.addEventListener('click', () => {
    socket.emit('trigger_all_bow', { duration: 4000 });
    addLog('sys', 'Triggered fountain light surge.');
  });
}
