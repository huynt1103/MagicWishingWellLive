/**
 * Audio Engine for The Magic Wishing Well - TikTok Live Interactive
 * Features:
 * - Serene gentle water stream & mystical fountain BGM loop
 * - Web Audio synthesized Coin Clink, Water Splash, and Celestial Arpeggio Chimes
 * - English TTS speech queue with auto-ducking BGM
 */

class WishingWellAudioEngine {
  constructor() {
    this.ctx = null;
    this.soundEnabled = true;
    this.bgmEnabled = true;
    this.bgmVolume = 0.30;
    this.sfxVolume = 0.90;
    this.ttsEnabled = true;

    // Track URLs
    this.tracks = {
      'gentle_stream': 'assets/audio/meditation_gentle.wav',
      'crystal_harp': 'assets/audio/meditation_guzheng.wav',
      'mystic_bowl': 'assets/audio/meditation_bgm.wav'
    };
    this.currentTrack = 'crystal_harp';

    // Audio elements with fallback
    this.bellAudio = new Audio('assets/audio/bell.wav');
    this.chimeAudio = new Audio('assets/audio/chime.wav');
    this.fortuneAudio = new Audio('assets/audio/fortune.wav');

    // Background Ambient Music (Always loop continuously)
    this.bgmAudio = new Audio(this.tracks[this.currentTrack]);
    this.bgmAudio.loop = true;
    this.bgmAudio.volume = this.bgmVolume;

    // TTS speech queue
    this.ttsQueue = [];
    this.isSpeaking = false;

    // Web Speech API fallback
    this.hasWebSpeech = 'speechSynthesis' in window;
    this.enVoice = null;
    if (this.hasWebSpeech) {
      this.initWebSpeechVoices();
    }
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.bgmEnabled) {
      this.playBGM();
    }
  }

  switchTrack(trackKey) {
    if (this.tracks[trackKey]) {
      this.currentTrack = trackKey;
      const wasPlaying = !this.bgmAudio.paused;
      this.bgmAudio.pause();
      this.bgmAudio = new Audio(this.tracks[trackKey]);
      this.bgmAudio.loop = true;
      this.bgmAudio.volume = this.bgmVolume;
      if (wasPlaying && this.bgmEnabled) {
        this.playBGM();
      }
    }
  }

  playBGM() {
    if (!this.bgmEnabled) return;
    this.bgmAudio.volume = this.bgmVolume;
    this.bgmAudio.loop = true;

    this.bgmAudio.onended = () => {
      if (this.bgmEnabled) {
        this.bgmAudio.currentTime = 0;
        this.bgmAudio.play().catch(() => {});
      }
    };

    const playPromise = this.bgmAudio.play();
    if (playPromise && playPromise.catch) {
      playPromise.catch(() => {
        console.log('BGM waiting for browser gesture or OBS source initialization...');
      });
    }
  }

  pauseBGM() {
    this.bgmAudio.pause();
  }

  setBGMVolume(vol) {
    this.bgmVolume = Math.max(0, Math.min(1, vol));
    this.bgmAudio.volume = this.bgmVolume;
  }

  initWebSpeechVoices() {
    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      this.enVoice = voices.find(v => v.lang.startsWith('en-US') || v.lang.startsWith('en-GB') || v.lang.startsWith('en')) || voices[0] || null;
    };
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
    updateVoices();
  }

  // Synthesize Coin Drop (Crisp metallic clinking)
  playCoinDrop() {
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freqs = [1960, 2480, 3120];
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq + (Math.random() - 0.5) * 60, now + idx * 0.04);
      gain.gain.setValueAtTime(0.28 * this.sfxVolume, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.04 + 0.28);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.30);
    });
  }

  // Synthesize Water Splash
  playSplash() {
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.06));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.25);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6 * this.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
  }

  // Celestial Chime Arpeggio
  playMagicChime() {
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [1046.5, 1318.5, 1567.98, 1975.53, 2093.0]; // C6, E6, G6, B6, C7
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      gain.gain.setValueAtTime(0.22 * this.sfxVolume, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.09 + 0.9);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.95);
    });
  }

  playBell() {
    if (!this.soundEnabled) return;
    this.playMagicChime();
    try {
      this.bellAudio.currentTime = 0;
      this.bellAudio.play().catch(() => this.synthBell());
    } catch (e) {
      this.synthBell();
    }
  }

  synthBell() {
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freqs = [440, 880, 1320, 1760];
    const gains = [0.35, 0.22, 0.12, 0.06];
    const decays = [3.5, 2.5, 1.8, 1.0];

    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      gain.gain.setValueAtTime(gains[i] * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + decays[i]);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + decays[i]);
    });
  }

  // Aliases for compatibility
  playMo() {
    this.playCoinDrop();
  }

  playChime() {
    this.playMagicChime();
  }

  playFortuneShake() {
    this.playMagicChime();
  }

  // TTS speech queue management with Value-Based VIP Priority & Donor Protection
  queueSpeech(spokenText, audioUrl = null, isVIP = false, coins = 0) {
    if (!this.ttsEnabled || !spokenText) return;

    const newItem = {
      text: spokenText,
      url: audioUrl,
      isVIP: !!isVIP,
      coins: parseInt(coins || 0, 10),
      timestamp: Date.now()
    };

    if (isVIP) {
      // 1. If currently speaking is a non-VIP (casual welcome), interrupt it immediately!
      if (this.isSpeaking && !this.currentIsVIP) {
        if (this.currentAudio) {
          try {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
          } catch (e) {}
          this.currentAudio = null;
        }
        if (this.hasWebSpeech) {
          window.speechSynthesis.cancel();
        }
        this.isSpeaking = false;
        this.currentIsVIP = false;
      }

      // 2. Add this gift into the queue
      this.ttsQueue.push(newItem);

      // 3. Sort queue: Higher coins FIRST! Then FIFO by arrival time
      this.sortTTSQueue();

      // 4. If nothing is speaking, start reading immediately
      // If a VIP is ALREADY speaking, DO NOT interrupt them; let them finish their speech!
      if (!this.isSpeaking) {
        this.processTTSQueue();
      }

    } else {
      // Normal greeting (joins): Never interrupt or queue up if gifts are waiting or speaking
      if (this.isSpeaking && this.currentIsVIP) return;
      if (this.ttsQueue.some(item => item.isVIP)) return;
      if (this.ttsQueue.length >= 1) return;

      this.ttsQueue.push(newItem);
      if (!this.isSpeaking) {
        this.processTTSQueue();
      }
    }
  }

  // Sort queue by priority: Gifts before welcomes, then descending by coins, then FIFO
  sortTTSQueue() {
    this.ttsQueue.sort((a, b) => {
      // 1. VIP gifts always beat non-VIP welcomes
      if (a.isVIP && !b.isVIP) return -1;
      if (!a.isVIP && b.isVIP) return 1;

      // 2. Among VIP gifts: Higher coins first! (Quà to hơn được ưu tiên đọc trước)
      if (a.isVIP && b.isVIP) {
        if (b.coins !== a.coins) {
          return b.coins - a.coins;
        }
      }

      // 3. Within same coin tier: First come, first served
      return a.timestamp - b.timestamp;
    });
  }

  processTTSQueue() {
    if (this.isSpeaking || this.ttsQueue.length === 0) return;

    const item = this.ttsQueue.shift();
    this.isSpeaking = true;
    this.currentIsVIP = !!item.isVIP;

    // Duck BGM gently during TTS
    const prevBgmVol = this.bgmAudio.volume;
    if (this.bgmAudio && !this.bgmAudio.paused) {
      this.bgmAudio.volume = Math.max(0.06, prevBgmVol * 0.35);
    }

    const restoreBgm = () => {
      if (this.bgmAudio) this.bgmAudio.volume = this.bgmVolume;
      this.isSpeaking = false;
      this.currentIsVIP = false;
      this.currentAudio = null;
      setTimeout(() => this.processTTSQueue(), 250);
    };

    if (item.url) {
      this.currentAudio = new Audio(item.url);
      this.currentAudio.volume = 0.95;
      this.currentAudio.onended = () => restoreBgm();
      this.currentAudio.onerror = () => {
        this.speakWebSpeech(item.text, () => restoreBgm());
      };
      this.currentAudio.play().catch(() => {
        this.speakWebSpeech(item.text, () => restoreBgm());
      });
    } else {
      this.speakWebSpeech(item.text, () => restoreBgm());
    }
  }

  speakWebSpeech(text, onComplete) {
    if (!this.hasWebSpeech) {
      if (onComplete) onComplete();
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    if (this.enVoice) utter.voice = this.enVoice;
    utter.rate = 0.95;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    utter.onend = () => { if (onComplete) onComplete(); };
    utter.onerror = () => { if (onComplete) onComplete(); };
    window.speechSynthesis.speak(utter);
  }
}

window.wishingAudio = new WishingWellAudioEngine();
window.templeAudio = window.wishingAudio; // Compatibility alias
