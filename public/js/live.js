/**
 * The Magic Wishing Well & Coin Fountain - TikTok Live Interactive
 * Features:
 * - 1080x1920 Native Resolution Canvas for OBS Studio & TikTok Live Studio
 * - Animated Walking Wishmaker Characters: Viewers' avatars walk up to the stone fountain,
 *   toss glowing coins from their hand, and celebrate as magical waters splash!
 * - Real-time Canvas 2D physics: 3D coin toss arcs, realistic water ripple waves,
 *   light pillar surge, glowing water caustics, and sunken shimmering coins
 * - Event-driven: Chat, Like, Gift, Join all trigger visual and audio reactions
 * - English TTS voice synthesis queue & Auspicious Wish Scroll reveal
 */

// Nicknames, comments and avatar URLs come from TikTok viewers and must never be rendered as HTML
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face';

function safeImageUrl(url) {
  return typeof url === 'string' && /^(https?:\/\/|\/)/i.test(url) ? url : DEFAULT_AVATAR;
}

class WishingWellLiveApp {
  constructor() {
    this.stage = document.getElementById('temple-stage');
    this.canvas = document.getElementById('fx-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.particles = [];
    this.ripples = [];
    this.sunkenCoins = [];
    this.tossedCoins = [];
    this.fireflies = [];
    this.ambientPetals = [];

    this.wellCenter = { x: 540, y: 870 };
    this.wellRadiusX = 220;
    this.wellRadiusY = 85;

    this.lightPillarActive = false;
    this.lightPillarIntensity = 0;

    this.totalWishesCount = 1248;
    this.socket = null;
    this.isCeremonyActive = false;
    this.ceremonyQueue = [];
    this.activeWishmakers = [];

    this.initViewportScale();
    this.initCanvas();
    this.initAmbientParticles();
    this.initSocket();
    this.initQuickActions();
    this.setupAudioTrigger();
    this.startMainRenderLoop();
  }

  // Auto-scale 1080x1920 canvas to fit any window size
  initViewportScale() {
    const updateScale = () => {
      const scale = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
      document.documentElement.style.setProperty('--ui-scale', scale);
    };
    window.addEventListener('resize', updateScale);
    updateScale();
  }

  setupAudioTrigger() {
    const audioPill = document.getElementById('audio-pill');
    window.wishingAudio.init();
    window.wishingAudio.playBGM();

    if (audioPill) {
      audioPill.addEventListener('click', () => {
        window.wishingAudio.init();
        window.wishingAudio.soundEnabled = !window.wishingAudio.soundEnabled;
        window.wishingAudio.bgmEnabled = window.wishingAudio.soundEnabled;
        if (window.wishingAudio.soundEnabled) {
          window.wishingAudio.playBGM();
          audioPill.innerHTML = '🎵 Mystic Stream & Chimes: ON';
        } else {
          window.wishingAudio.pauseBGM();
          audioPill.innerHTML = '🔕 Audio: OFF';
        }
      });
    }

    const unlockAudioOnce = () => {
      window.wishingAudio.init();
      window.wishingAudio.playBGM();
      if (audioPill && window.wishingAudio.soundEnabled) {
        audioPill.innerHTML = '🎵 Mystic Stream & Chimes: ON';
      }
    };
    ['click', 'pointerdown', 'touchstart', 'keydown'].forEach(evt => {
      document.addEventListener(evt, unlockAudioOnce, { once: true });
    });
  }

  initQuickActions() {
    const btnBell = document.getElementById('btn-quick-bell');
    const btnMo = document.getElementById('btn-quick-mo');
    const btnFortune = document.getElementById('btn-quick-fortune');

    if (btnBell) {
      btnBell.addEventListener('click', () => {
        window.wishingAudio.playMagicChime();
        this.triggerFountainSurge(4000);
      });
    }
    if (btnMo) {
      btnMo.addEventListener('click', () => {
        this.spawnWalkingWishmaker('You', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face', 'Tossing a lucky coin!', 1, false);
      });
    }
    if (btnFortune) {
      btnFortune.addEventListener('click', async () => {
        try {
          const res = await fetch('/api/wish/random');
          const wish = await res.json();
          this.showWishModal(wish);
        } catch (e) {}
      });
    }
  }

  initCanvas() {
    this.canvas.width = 1080;
    this.canvas.height = 1920;

    // Seed initial sunken coins at the bottom of the well
    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 0.75;
      this.sunkenCoins.push({
        x: this.wellCenter.x + Math.cos(angle) * (this.wellRadiusX * dist),
        y: this.wellCenter.y + Math.sin(angle) * (this.wellRadiusY * dist) * 0.75,
        radius: 6 + Math.random() * 6,
        color: Math.random() > 0.3 ? '#f59e0b' : '#38bdf8',
        shimmerPhase: Math.random() * Math.PI * 2,
        shimmerSpeed: 0.02 + Math.random() * 0.03
      });
    }
  }

  initAmbientParticles() {
    // 35 Floating fireflies
    for (let i = 0; i < 35; i++) {
      this.fireflies.push({
        x: Math.random() * 1080,
        y: Math.random() * 1920,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        radius: 1.5 + Math.random() * 2.5,
        color: Math.random() > 0.5 ? '#fef08a' : '#38bdf8',
        phase: Math.random() * Math.PI * 2
      });
    }

    // Gentle floating leaves / petals
    for (let i = 0; i < 15; i++) {
      this.ambientPetals.push({
        x: Math.random() * 1080,
        y: Math.random() * 1920,
        vx: 0.5 + Math.random() * 1.0,
        vy: 1.2 + Math.random() * 1.5,
        size: 10 + Math.random() * 12,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.03,
        color: Math.random() > 0.5 ? '#34d399' : '#38bdf8'
      });
    }
  }

  // ==================== ANIMATED WALKING WISHMAKER (ETHEREAL SPIRIT) ====================

  spawnWalkingWishmaker(nickname, avatar, text, coins = 1, isGift = false, onLanded = null) {
    this.totalWishesCount++;
    this.updateWishCounter();

    if (!this.activeWishmakers) this.activeWishmakers = [];

    // Limit concurrent travelers on screen to 3 max to prevent clumping
    if (!isGift && this.activeWishmakers.length >= 3) {
      return;
    }

    if (isGift && this.activeWishmakers.length >= 3) {
      // Dismiss the oldest traveler immediately to give center stage to VIP gift
      const oldest = this.activeWishmakers.shift();
      if (oldest && oldest.el) {
        oldest.el.style.opacity = '0';
        setTimeout(() => oldest.el.remove(), 400);
      }
    }

    // 5 distinct non-overlapping standing positions along the well arc
    const SLOTS = [
      { id: 0, startX: 25, targetX: 28, targetY: 57.0 }, // Far Left
      { id: 1, startX: 37, targetX: 39, targetY: 58.2 }, // Mid Left
      { id: 2, startX: 50, targetX: 50, targetY: 59.5 }, // Center Front (VIP)
      { id: 3, startX: 63, targetX: 61, targetY: 58.2 }, // Mid Right
      { id: 4, startX: 75, targetX: 72, targetY: 57.0 }  // Far Right
    ];

    const occupiedSlotIds = new Set(this.activeWishmakers.map(w => w.slotId));
    let slot;

    if (isGift) {
      // VIP claims Center Front (id: 2). If a casual visitor is there, dismiss them
      const occupant = this.activeWishmakers.find(w => w.slotId === 2);
      if (occupant && !occupant.isGift && occupant.el) {
        occupant.el.style.opacity = '0';
        setTimeout(() => occupant.el.remove(), 300);
        const oIdx = this.activeWishmakers.indexOf(occupant);
        if (oIdx !== -1) this.activeWishmakers.splice(oIdx, 1);
      }
      slot = SLOTS[2];
    } else {
      // Casual visitors take available flank slots
      const available = SLOTS.filter(s => s.id !== 2 && !occupiedSlotIds.has(s.id));
      if (available.length === 0) return; // Avoid clumping when full
      slot = available[Math.floor(Math.random() * available.length)];
    }

    const traveler = document.createElement('div');
    traveler.className = `walking-wishmaker walking ${isGift ? 'vip' : ''}`;

    traveler.style.left = `${slot.startX}%`;
    traveler.style.top = '78%';
    traveler.style.transform = 'translate(-50%, -100%) scale(1.05)';

    // Build Ethereal Spirit Traveler DOM
    traveler.innerHTML = `
      ${text ? `<div class="wish-speech-bubble">${escapeHtml(text)}</div>` : ''}
      <div class="wishmaker-badge">${escapeHtml(nickname)}</div>
      <div class="spirit-traveler-wrap">
        <div class="spirit-halo"></div>
        <img src="${escapeHtml(safeImageUrl(avatar))}" class="spirit-avatar" alt="${escapeHtml(nickname)}" />
        <div class="spirit-robe"></div>
      </div>
    `;

    this.stage.appendChild(traveler);
    const wishmakerObj = { el: traveler, isGift, slotId: slot.id };
    this.activeWishmakers.push(wishmakerObj);

    const cleanup = () => {
      const idx = this.activeWishmakers.indexOf(wishmakerObj);
      if (idx !== -1) this.activeWishmakers.splice(idx, 1);
      traveler.remove();
    };

    // 1. Float forward gracefully to the stone well rim
    setTimeout(() => {
      traveler.style.top = `${slot.targetY}%`;
      traveler.style.left = `${slot.targetX}%`;
      traveler.style.transform = 'translate(-50%, -100%) scale(0.90)';
    }, 40);

    // 2. Arrive at well, stop walking, and cast celestial coin into water
    setTimeout(() => {
      traveler.classList.remove('walking');
      traveler.classList.add('tossing');

      const travelerRect = traveler.getBoundingClientRect();
      const viewportRect = document.getElementById('live-viewport').getBoundingClientRect();
      const scale = viewportRect.width / 1080;

      const handX = (travelerRect.left + travelerRect.width / 2 - viewportRect.left) / scale;
      const handY = (travelerRect.top + travelerRect.height * 0.45 - viewportRect.top) / scale;

      this.tossCoinFromPoint(handX, handY, nickname, avatar, coins, isGift, () => {
        traveler.classList.remove('tossing');
        traveler.classList.add('celebrating');

        if (onLanded) onLanded();
      });

    }, 1800);

    // 3. Graceful celebration & fade out
    setTimeout(() => {
      traveler.style.opacity = '0';
      traveler.style.transform = 'translate(-50%, -100%) scale(0.78) translateY(-18px)';
      setTimeout(cleanup, 600);
    }, 4600);
  }

  // ==================== COIN TOSS & PHYSICS ====================

  tossCoinFromPoint(startX, startY, nickname, avatar, coins = 1, isGolden = false, onLandedCallback = null) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 0.65;
    const targetX = this.wellCenter.x + Math.cos(angle) * (this.wellRadiusX * dist);
    const targetY = this.wellCenter.y + Math.sin(angle) * (this.wellRadiusY * dist) * 0.7;

    const duration = isGolden ? 1.4 : 1.1;
    const peakY = Math.min(targetY, startY) - 160 - Math.random() * 80;

    const coin = {
      nickname,
      avatar,
      startX,
      startY,
      targetX,
      targetY,
      peakY,
      x: startX,
      y: startY,
      progress: 0,
      duration,
      spinAngle: 0,
      spinSpeed: 0.16 + Math.random() * 0.14,
      scale: isGolden ? 1.35 : 0.95,
      isGolden,
      coins,
      avatarImg: null,
      onLandedCallback
    };

    if (avatar) {
      const img = new Image();
      img.src = avatar;
      img.onload = () => { coin.avatarImg = img; };
    }

    this.tossedCoins.push(coin);
  }

  onCoinLanded(coin) {
    // 1. Audio splash & clink
    window.wishingAudio.playCoinDrop();
    window.wishingAudio.playSplash();

    // 2. Spawn Concentric Water Ripples
    this.ripples.push({
      x: coin.targetX,
      y: coin.targetY,
      radius: 8,
      maxRadius: coin.isGolden ? 200 : 130,
      alpha: 0.95,
      speed: coin.isGolden ? 3.0 : 2.2,
      color: coin.isGolden ? '#fef08a' : '#38bdf8'
    });

    // 3. Water droplet splash particles
    const dropletCount = coin.isGolden ? 32 : 18;
    for (let i = 0; i < dropletCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 6.0;
      this.particles.push({
        x: coin.targetX,
        y: coin.targetY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.5 - (3.5 + Math.random() * 4.5),
        gravity: 0.28,
        radius: 2 + Math.random() * 3.5,
        color: Math.random() > 0.4 ? '#38bdf8' : '#ffffff',
        alpha: 1.0,
        decay: 0.02 + Math.random() * 0.025
      });
    }

    // 4. Add coin to sunken list
    this.sunkenCoins.push({
      x: coin.targetX,
      y: coin.targetY,
      radius: coin.isGolden ? 11 : 7,
      color: coin.isGolden ? '#f59e0b' : (Math.random() > 0.3 ? '#e2e8f0' : '#38bdf8'),
      shimmerPhase: Math.random() * Math.PI * 2,
      shimmerSpeed: 0.025
    });

    if (this.sunkenCoins.length > 90) {
      this.sunkenCoins.shift();
    }

    if (coin.onLandedCallback) {
      coin.onLandedCallback();
    }
  }

  triggerFountainSurge(duration = 4000) {
    this.lightPillarActive = true;
    window.wishingAudio.playMagicChime();

    const surgeInterval = setInterval(() => {
      this.ripples.push({
        x: this.wellCenter.x + (Math.random() - 0.5) * 80,
        y: this.wellCenter.y + (Math.random() - 0.5) * 40,
        radius: 10,
        maxRadius: 220,
        alpha: 0.9,
        speed: 3.5,
        color: '#38bdf8'
      });
    }, 280);

    setTimeout(() => {
      clearInterval(surgeInterval);
      this.lightPillarActive = false;
    }, duration);
  }

  // ==================== CEREMONY (GIFTS) ====================

  performCeremony(data) {
    this.ceremonyQueue.push(data);
    this.processCeremonyQueue();
  }

  processCeremonyQueue() {
    if (this.isCeremonyActive || this.ceremonyQueue.length === 0) return;
    this.isCeremonyActive = true;

    const data = this.ceremonyQueue.shift();
    const { nickname, avatar, giftName, coins, bannerText, spokenText, audioUrl, fortune, wish } = data;

    this.updateTopBanner(bannerText || `${nickname} tossed a ${giftName || 'Golden Offering'} into the Magic Fountain!`);
    this.updateRecentWishmaker(nickname, coins);

    window.wishingAudio.playMagicChime();
    window.wishingAudio.queueSpeech(spokenText, audioUrl, true, coins);

    // Spawn walking character that walks to the well and tosses the golden coin!
    const wishData = wish || fortune;
    const wishText = `🎁 Tossed ${giftName || 'Golden Gift'}! ✨`;

    this.spawnWalkingWishmaker(nickname, avatar, wishText, coins, true, () => {
      // Light pillar surge on splash
      this.triggerFountainSurge(5000);

      // Reveal wish scroll
      if (wishData && coins >= 5) {
        setTimeout(() => {
          this.showWishModal(wishData, { nickname, avatar, giftName, coins });
        }, 1200);
      }
    });

    setTimeout(() => {
      this.isCeremonyActive = false;
      this.processCeremonyQueue();
    }, 6500);
  }

  showChatBubble(nickname, comment, avatar) {
    if (!comment || comment.trim() === '') return;
    this.spawnWalkingWishmaker(nickname, avatar, `"${comment.trim()}"`, 1, false);
  }

  updateTopBanner(text) {
    const bannerEl = document.getElementById('royal-banner-text');
    if (bannerEl) bannerEl.textContent = text;
  }

  updateRecentWishmaker(nickname, coins) {
    const nameEl = document.getElementById('recent-donor-name');
    const scoreEl = document.getElementById('recent-donor-score');
    if (nameEl) nameEl.innerText = nickname;
    if (scoreEl) scoreEl.innerText = `Tossed: ${coins || 1} Coins`;
  }

  updateWishCounter() {
    const pill = document.getElementById('sangha-pill');
    if (pill) {
      pill.innerHTML = `✨ Wishing Well: Level 5 • <span id="sangha-count">${this.totalWishesCount}</span> Wishes Cast`;
    }
  }

  updateCompactLeaderboard(list) {
    const container = document.getElementById('clb-list-container');
    if (!container) return;

    container.innerHTML = '';
    const top4 = list.slice(0, 4);
    top4.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'clb-item';
      row.innerHTML = `
        <span class="clb-name">${index + 1}. ${escapeHtml(item.nickname)}</span>
        <span class="clb-val">${escapeHtml(item.score)}</span>
      `;
      container.appendChild(row);
    });
  }

  // Feature #2 & #6: Dynamic 8 Guardian Pedestals with Smooth FLIP Sliding Transition
  updateGuardiansPedestals(leaderboard) {
    const container = document.getElementById('guardians-pedestals');
    if (!container || !leaderboard) return;

    const PEDESTAL_POSITIONS = [
      { x: 540, y: 720, rank: 1, zIndex: 28 }, // Center Apex Gold Throne Pedestal
      { x: 420, y: 745, rank: 2, zIndex: 27 }, // Left Upper Flank
      { x: 660, y: 745, rank: 3, zIndex: 27 }, // Right Upper Flank
      { x: 310, y: 795, rank: 4, zIndex: 26 }, // Left Mid
      { x: 770, y: 795, rank: 5, zIndex: 26 }, // Right Mid
      { x: 220, y: 865, rank: 6, zIndex: 25 }, // Left Lower Flank
      { x: 860, y: 865, rank: 7, zIndex: 25 }, // Right Lower Flank
      { x: 155, y: 940, rank: 8, zIndex: 24 }  // Danger Seat
    ];

    const top8 = leaderboard.slice(0, 8);
    const existingSlots = new Map();
    container.querySelectorAll('.guardian-pedestal-slot').forEach(el => {
      if (el.dataset.uid) existingSlots.set(el.dataset.uid, el);
    });

    top8.forEach((item, index) => {
      const pos = PEDESTAL_POSITIONS[index];
      if (!pos) return;
      const isTop1 = (index === 0);
      const isDangerSeat = (index === 7);
      const firstName = (item.nickname || 'Guardian').split(' ')[0];
      const uid = item.uniqueId || item.nickname;
      const newRank = index + 1;

      let slot = existingSlots.get(uid);

      if (slot) {
        // Existing user slot: smooth slide to new position
        existingSlots.delete(uid);
        const oldRank = parseInt(slot.dataset.rank || newRank, 10);
        slot.dataset.rank = newRank;

        // Update classes (must run before adding the animation classes below)
        slot.className = `guardian-pedestal-slot ${isTop1 ? 'top-1' : ''} ${isDangerSeat ? 'danger-seat-slot' : ''}`;

        // Rank climb vs drop animation
        if (newRank < oldRank) {
          slot.classList.remove('rank-drop-slide');
          slot.classList.add('rank-climb-boost');
          setTimeout(() => slot.classList.remove('rank-climb-boost'), 1300);
        } else if (newRank > oldRank) {
          slot.classList.remove('rank-climb-boost');
          slot.classList.add('rank-drop-slide');
          setTimeout(() => slot.classList.remove('rank-drop-slide'), 900);
        }

        // Smooth coordinate transition
        slot.style.left = `${pos.x}px`;
        slot.style.top = `${pos.y}px`;
        slot.style.zIndex = pos.zIndex;

        // Update Crown for Top 1
        const crownEl = slot.querySelector('.crown-float');
        const charWrap = slot.querySelector('.guardian-char');
        if (isTop1 && !crownEl && charWrap) {
          const c = document.createElement('div');
          c.className = 'crown-float';
          c.innerText = '👑';
          charWrap.prepend(c);
        } else if (!isTop1 && crownEl) {
          crownEl.remove();
        }

        // Update Aura
        const auraEl = slot.querySelector('.avatar-aura');
        if (auraEl) {
          auraEl.className = `avatar-aura ${isTop1 ? 'aura-gold' : 'aura-cyan'}`;
        }

        // Update Rank Tag
        const tagEl = slot.querySelector('.guardian-rank-tag');
        if (tagEl) {
          tagEl.className = `guardian-rank-tag ${isDangerSeat ? 'danger-seat' : ''}`;
          tagEl.innerText = `#${index + 1} ${firstName}`;
        }

      } else {
        // New guardian entering the top 8
        slot = document.createElement('div');
        slot.dataset.uid = uid;
        slot.dataset.rank = newRank;
        slot.className = `guardian-pedestal-slot ${isTop1 ? 'top-1' : ''} ${isDangerSeat ? 'danger-seat-slot' : ''} rank-climb-boost`;
        slot.style.left = `${pos.x}px`;
        slot.style.top = `${pos.y}px`;
        slot.style.zIndex = pos.zIndex;
        slot.style.opacity = '0';
        slot.style.transform = 'translate(-50%, -100%) scale(0.6)';

        slot.innerHTML = `
          <div class="guardian-char">
            ${isTop1 ? '<div class="crown-float">👑</div>' : ''}
            <div class="avatar-aura ${isTop1 ? 'aura-gold' : 'aura-cyan'}"></div>
            <img src="${escapeHtml(safeImageUrl(item.avatar))}" class="guardian-avatar" alt="${escapeHtml(item.nickname)}" />
            <div class="guardian-robe">
              <div class="guardian-torch"></div>
            </div>
            <div class="guardian-rank-tag ${isDangerSeat ? 'danger-seat' : ''}">#${index + 1} ${escapeHtml(firstName)}</div>
          </div>
          <div class="pedestal-column"></div>
        `;

        container.appendChild(slot);
        requestAnimationFrame(() => {
          slot.style.opacity = '1';
          slot.style.transform = 'translate(-50%, -100%) scale(1)';
        });
        setTimeout(() => slot.classList.remove('rank-climb-boost'), 1300);
      }
    });

    // Remove users knocked out of top 8 with eject animation
    existingSlots.forEach(el => {
      el.classList.add('ejecting');
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 1100);
    });
  }

  // Feature #1: Subtle Water Resonance Meter Update & Level Up Trigger
  updateEnergyMeter(energy) {
    if (!energy) return;
    const valEl = document.getElementById('resonance-val');
    const fillEl = document.getElementById('resonance-fill');
    const levelEl = document.getElementById('resonance-level');
    const pillEl = document.getElementById('resonance-pill');

    const percent = energy.percent !== undefined ? energy.percent : Math.min(100, Math.floor((energy.current / energy.max) * 100));

    if (valEl) valEl.innerText = `${percent}%`;
    if (fillEl) fillEl.style.width = `${percent}%`;
    if (levelEl && energy.level) levelEl.innerText = `Tier ${energy.level}`;

    if (pillEl) {
      if (percent >= 85) {
        pillEl.classList.add('near-awakening');
      } else {
        pillEl.classList.remove('near-awakening');
      }
    }
  }

  // High-Impact Level Up / Tier Unlocked Celebration Overlay
  showLevelUpCelebration(level, awakenerName) {
    const overlay = document.getElementById('level-awakening-overlay');
    if (!overlay) return;

    const tierText = document.getElementById('awakening-tier-text');
    const heroText = document.getElementById('awakening-hero-text');

    if (tierText) tierText.innerText = `TIER ${level || 6} UNLOCKED`;
    if (heroText) heroText.innerText = `Awakened by ${awakenerName || 'Divine Benefactor'}`;

    overlay.classList.add('active');

    // Audio & canvas fireworks
    window.wishingAudio.playBell();
    window.wishingAudio.playMagicChime();
    this.triggerFountainSurge(10000);

    // Burst golden water ripples from well center
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        this.ripples.push({
          x: this.wellCenter.x,
          y: this.wellCenter.y,
          radius: 25,
          maxRadius: this.wellRadiusX * 1.6,
          alpha: 1.0,
          speed: 3.5,
          color: '#fbbf24'
        });
      }, i * 260);
    }

    setTimeout(() => {
      overlay.classList.remove('active');
    }, 4800);
  }

  // Feature #2: Real-time Dethrone Outbid Alert
  showOutbidAlert(newLeader, oldLeader) {
    const container = document.getElementById('outbid-alert-container');
    if (!container) return;

    const card = document.createElement('div');
    card.className = 'outbid-alert-card';
    card.innerHTML = `
      <div class="outbid-icon">⚡👑</div>
      <div class="outbid-content">
        <div class="outbid-title">THRONE OVERTHROWN! NEW TOP 1 GUARDIAN!</div>
        <div class="outbid-desc">
          <span class="highlight-new">${escapeHtml(newLeader.nickname)}</span> (${escapeHtml(newLeader.score)}🪙) dethroned <span class="highlight-old">${escapeHtml(oldLeader.nickname)}</span>!
        </div>
      </div>
    `;

    container.innerHTML = '';
    container.appendChild(card);

    window.wishingAudio.playMagicChime();
    window.wishingAudio.playBell();
    this.triggerFountainSurge(5000);

    setTimeout(() => {
      card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      card.style.opacity = '0';
      card.style.transform = 'translateY(-20px)';
      setTimeout(() => {
        if (card.parentNode) card.parentNode.removeChild(card);
      }, 600);
    }, 5500);
  }

  showWishModal(wish, donorInfo = {}) {
    const overlay = document.getElementById('fortune-overlay');
    if (!overlay) return;

    const donorName = donorInfo.nickname || wish.donorNickname || 'Noble Wishmaker';
    const donorAvatar = donorInfo.avatar || wish.donorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face';
    const giftName = donorInfo.giftName || 'Golden Offering';

    const avatarEl = document.getElementById('fortune-avatar');
    const nameEl = document.getElementById('fortune-donor-name');
    const giftEl = document.getElementById('fortune-donor-gift');
    const titleEl = document.getElementById('fortune-title');
    const blessingEl = document.getElementById('fortune-blessing');

    if (avatarEl) avatarEl.src = donorAvatar;
    if (nameEl) nameEl.innerText = donorName;
    if (giftEl) giftEl.innerText = `✨ Sacred Blessing • ${giftName} ✨`;

    if (titleEl) {
      if (wish.isCustom) {
        titleEl.innerText = `Sacred Prayer Manifested`;
      } else {
        titleEl.innerText = wish.title || 'Golden Wish Manifest';
      }
    }
    if (blessingEl) blessingEl.innerText = wish.blessing || 'May your heart be filled with peace and light!';

    overlay.classList.add('active');
    setTimeout(() => {
      overlay.classList.remove('active');
    }, 5500);
  }

  // ==================== MAIN CANVAS RENDER LOOP ====================

  startMainRenderLoop() {
    let lastFrameTime = null;
    const render = (timestamp) => {
      // Clamp so a backgrounded/throttled OBS source does not make coins jump
      const dt = lastFrameTime === null ? 0.016 : Math.min(0.05, Math.max(0, (timestamp - lastFrameTime) / 1000));
      lastFrameTime = timestamp;

      this.ctx.clearRect(0, 0, 1080, 1920);

      // 1. Render Ancient Stone Well & Glowing Water Basin
      this.renderWishingWell();

      // 2. Render Divine Ascending Light Pillar (if active)
      if (this.lightPillarActive) {
        this.renderLightPillar();
      }

      // 3. Render Water Ripple Waves
      this.renderRipples();

      // 4. Render Flying Tossed Coins
      this.renderTossedCoins(dt);

      // 5. Render Water Droplet Splash Particles
      this.renderParticles();

      // 6. Render Floating Fireflies & Atmospheric Leaves
      this.renderAtmosphere();

      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
  }

  renderWishingWell() {
    const cx = this.wellCenter.x;
    const cy = this.wellCenter.y;
    const rx = this.wellRadiusX;
    const ry = this.wellRadiusY;

    // --- Dynamic Water Caustics Shimmer & Sunken Coins on Background Well ---
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    this.ctx.clip();

    // Subtle magical water breathing glow (enriches natural background water)
    const waterGlow = this.ctx.createRadialGradient(cx, cy, 10, cx, cy, rx);
    waterGlow.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
    waterGlow.addColorStop(0.7, 'rgba(2, 132, 199, 0.12)');
    waterGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    this.ctx.fillStyle = waterGlow;
    this.ctx.fill();

    // Shimmering Golden & Silver Sunken Coins in the water
    for (let sc of this.sunkenCoins) {
      sc.shimmerPhase += sc.shimmerSpeed;
      const alpha = 0.5 + 0.5 * Math.sin(sc.shimmerPhase);

      const sprite = this.getSunkenCoinSprite(sc.color, sc.radius);
      this.ctx.globalAlpha = 0.45 + alpha * 0.55;
      this.ctx.drawImage(sprite, sc.x - sprite.width / 2, sc.y - sprite.height / 2);
    }
    this.ctx.globalAlpha = 1.0;

    this.ctx.restore(); // Exit clip
  }

  // Pre-rendered glowing coin sprites: shadowBlur on ~90 coins every frame is too heavy for OBS on weak PCs
  getSunkenCoinSprite(color, radius) {
    if (!this.coinSpriteCache) this.coinSpriteCache = new Map();
    const roundedRadius = Math.max(1, Math.round(radius));
    const key = `${color}_${roundedRadius}`;
    let sprite = this.coinSpriteCache.get(key);
    if (sprite) return sprite;

    const glowPadding = 14;
    const size = (roundedRadius + glowPadding) * 2;
    sprite = document.createElement('canvas');
    sprite.width = size;
    sprite.height = size;
    const sctx = sprite.getContext('2d');
    sctx.beginPath();
    sctx.ellipse(size / 2, size / 2, roundedRadius, roundedRadius * 0.6, 0.2, 0, Math.PI * 2);
    sctx.fillStyle = color;
    sctx.shadowColor = color;
    sctx.shadowBlur = 10;
    sctx.fill();

    this.coinSpriteCache.set(key, sprite);
    return sprite;
  }

  renderLightPillar() {
    const cx = this.wellCenter.x;
    const cy = this.wellCenter.y;
    const now = Date.now() * 0.003;

    this.ctx.save();
    this.ctx.globalCompositeOperation = 'screen';

    // 1. Wide ethereal atmospheric light fan
    const pulseWidth = 160 + Math.sin(now) * 25;
    const grad = this.ctx.createLinearGradient(cx, cy, cx, 0);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.65)');
    grad.addColorStop(0.35, 'rgba(56, 189, 248, 0.25)');
    grad.addColorStop(0.7, 'rgba(254, 240, 138, 0.12)');
    grad.addColorStop(1, 'rgba(254, 240, 138, 0)');

    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.moveTo(cx - pulseWidth, cy);
    this.ctx.lineTo(cx - pulseWidth * 0.35, 0);
    this.ctx.lineTo(cx + pulseWidth * 0.35, 0);
    this.ctx.lineTo(cx + pulseWidth, cy);
    this.ctx.closePath();
    this.ctx.fill();

    // 2. Soft inner volumetric light shaft (Soft diffused glow, NO harsh solid white stroke)
    const innerWidth = 55 + Math.sin(now * 1.5) * 12;
    const innerGrad = this.ctx.createLinearGradient(cx, cy, cx, 0);
    innerGrad.addColorStop(0, 'rgba(224, 242, 254, 0.40)');
    innerGrad.addColorStop(0.4, 'rgba(186, 230, 253, 0.18)');
    innerGrad.addColorStop(0.85, 'rgba(255, 255, 255, 0.06)');
    innerGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    this.ctx.fillStyle = innerGrad;
    this.ctx.beginPath();
    this.ctx.moveTo(cx - innerWidth, cy);
    this.ctx.lineTo(cx - innerWidth * 0.25, 0);
    this.ctx.lineTo(cx + innerWidth * 0.25, 0);
    this.ctx.lineTo(cx + innerWidth, cy);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }

  renderRipples() {
    this.ctx.save();
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rp = this.ripples[i];
      rp.radius += rp.speed;
      rp.alpha -= 0.015;

      if (rp.alpha <= 0 || rp.radius >= rp.maxRadius) {
        this.ripples.splice(i, 1);
        continue;
      }

      // Outer ripple with soft glow
      this.ctx.beginPath();
      this.ctx.ellipse(rp.x, rp.y, rp.radius, rp.radius * 0.5, 0, 0, Math.PI * 2);
      this.ctx.lineWidth = 3.5;
      this.ctx.strokeStyle = rp.color;
      this.ctx.globalAlpha = Math.max(0, rp.alpha);
      this.ctx.shadowColor = rp.color;
      this.ctx.shadowBlur = 10;
      this.ctx.stroke();

      // Inner echo ripple
      if (rp.radius > 22) {
        this.ctx.beginPath();
        this.ctx.ellipse(rp.x, rp.y, rp.radius * 0.65, rp.radius * 0.32, 0, 0, Math.PI * 2);
        this.ctx.lineWidth = 2.0;
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.globalAlpha = Math.max(0, rp.alpha * 0.55);
        this.ctx.stroke();
      }
    }
    this.ctx.restore();
  }

  renderTossedCoins(dt = 0.016) {
    for (let i = this.tossedCoins.length - 1; i >= 0; i--) {
      const c = this.tossedCoins[i];
      c.progress += dt / c.duration;
      c.spinAngle += c.spinSpeed * (dt / 0.016);

      const p = Math.min(1.0, c.progress);
      c.x = c.startX + (c.targetX - c.startX) * p;
      const linearY = c.startY + (c.targetY - c.startY) * p;
      const arcOffset = 4 * (c.peakY - Math.min(c.startY, c.targetY)) * p * (1 - p);
      c.y = linearY + arcOffset;

      // Soft Ground / Water Reflection Shadow
      const shadowY = linearY + 14;
      const heightAboveGround = Math.max(0, linearY - c.y);
      const shadowScale = Math.max(0.25, 1.0 - heightAboveGround / 280);
      // Radial gradient instead of ctx.filter blur, which is very expensive per frame
      const shadowRadius = 32 * shadowScale;
      this.ctx.save();
      this.ctx.translate(c.x, shadowY);
      this.ctx.scale(1, 11 / 28);
      const shadowGrad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, shadowRadius);
      shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
      shadowGrad.addColorStop(0.75, 'rgba(0, 0, 0, 0.3)');
      shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.beginPath();
      this.ctx.arc(0, 0, shadowRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = shadowGrad;
      this.ctx.fill();
      this.ctx.restore();

      // Emit sparkle particles along the coin's trail
      if (Math.random() < 0.6) {
        this.particles.push({
          x: c.x + (Math.random() - 0.5) * 16,
          y: c.y + (Math.random() - 0.5) * 16,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          gravity: 0.05,
          radius: 2 + Math.random() * 3,
          color: c.isGolden ? '#fef08a' : '#38bdf8',
          alpha: 0.9,
          decay: 0.04
        });
      }

      if (c.progress >= 1.0) {
        this.onCoinLanded(c);
        this.tossedCoins.splice(i, 1);
        continue;
      }

      // Draw 3D Spinning Coin
      this.ctx.save();
      this.ctx.translate(c.x, c.y);
      this.ctx.scale(Math.cos(c.spinAngle) * c.scale, c.scale);

      const coinRadius = 36;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, coinRadius, 0, Math.PI * 2);

      const coinGrad = this.ctx.createRadialGradient(-10, -10, 5, 0, 0, coinRadius);
      if (c.isGolden) {
        coinGrad.addColorStop(0, '#fffbeb');
        coinGrad.addColorStop(0.3, '#fef08a');
        coinGrad.addColorStop(0.7, '#f59e0b');
        coinGrad.addColorStop(1, '#b45309');
      } else {
        coinGrad.addColorStop(0, '#f8fafc');
        coinGrad.addColorStop(0.4, '#e2e8f0');
        coinGrad.addColorStop(1, '#94a3b8');
      }
      this.ctx.fillStyle = coinGrad;
      this.ctx.fill();

      this.ctx.lineWidth = 3;
      this.ctx.strokeStyle = c.isGolden ? '#fef08a' : '#ffffff';
      this.ctx.stroke();

      if (c.avatarImg && c.avatarImg.complete) {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(0, 0, coinRadius * 0.62, 0, Math.PI * 2);
        this.ctx.clip();
        this.ctx.drawImage(c.avatarImg, -coinRadius * 0.62, -coinRadius * 0.62, coinRadius * 1.24, coinRadius * 1.24);
        this.ctx.restore();
      }

      this.ctx.restore();
    }
  }

  renderParticles() {
    this.ctx.save();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.gravity) p.vy += p.gravity;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.globalAlpha = Math.max(0, p.alpha);
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1.0;
    this.ctx.restore();
  }

  renderAtmosphere() {
    this.ctx.save();
    // Fireflies
    for (let f of this.fireflies) {
      f.x += f.vx;
      f.y += f.vy;
      f.phase += 0.04;
      if (f.x < 0) f.x = 1080;
      if (f.x > 1080) f.x = 0;
      if (f.y < 0) f.y = 1920;
      if (f.y > 1920) f.y = 0;

      const alpha = 0.3 + 0.6 * Math.sin(f.phase);
      this.ctx.globalAlpha = Math.max(0, alpha);
      this.ctx.fillStyle = f.color;
      this.ctx.beginPath();
      this.ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Gentle falling leaves
    for (let lp of this.ambientPetals) {
      lp.y += lp.vy;
      lp.x += lp.vx + Math.sin(lp.y * 0.02) * 0.8;
      lp.rot += lp.vrot;

      if (lp.y > 1940) {
        lp.y = -20;
        lp.x = Math.random() * 1080;
      }

      this.ctx.save();
      this.ctx.translate(lp.x, lp.y);
      this.ctx.rotate(lp.rot);
      this.ctx.fillStyle = lp.color;
      this.ctx.globalAlpha = 0.6;
      this.ctx.beginPath();
      this.ctx.ellipse(0, 0, lp.size * 0.5, lp.size, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    this.ctx.globalAlpha = 1.0;
    this.ctx.restore();
  }

  applyConfig(config) {
    if (!config) return;
    if (typeof config.ttsEnabled === 'boolean') {
      window.wishingAudio.setTTSEnabled(config.ttsEnabled);
    }
    const bgmVolume = parseFloat(config.bgmVolume);
    if (Number.isFinite(bgmVolume)) {
      window.wishingAudio.setBGMVolume(bgmVolume);
    }
  }

  // ==================== SOCKET.IO HANDLING ====================

  initSocket() {
    this.socket = io();

    this.socket.on('init_state', data => {
      if (data.leaderboard) {
        this.updateCompactLeaderboard(data.leaderboard);
        this.updateGuardiansPedestals(data.leaderboard);
        if (data.leaderboard.length > 0) {
          this.updateRecentWishmaker(data.leaderboard[0].nickname, data.leaderboard[0].score);
        }
      }
      if (data.energy) {
        this.updateEnergyMeter(data.energy);
      }
      this.applyConfig(data.config);
    });

    this.socket.on('config_update', config => {
      this.applyConfig(config);
    });

    this.socket.on('leaderboard_update', list => {
      this.updateCompactLeaderboard(list);
      this.updateGuardiansPedestals(list);
    });

    this.socket.on('energy_update', data => {
      this.updateEnergyMeter(data);
    });

    this.socket.on('fountain_awakened', data => {
      const leaderName = (data.awakener && data.awakener.nickname) ? data.awakener.nickname : 'Divine Benefactor';
      this.updateTopBanner(`🌊 WATER RESONANCE AWAKENED! Level ${data.level} unlocked by ${leaderName}! ✨`);
      this.showLevelUpCelebration(data.level, leaderName);
    });

    this.socket.on('top1_dethroned', data => {
      this.showOutbidAlert(data.newLeader, data.oldLeader);
    });

    this.socket.on('tiktok_chat', data => {
      this.showChatBubble(data.nickname, data.comment, data.avatar);
    });

    this.socket.on('tiktok_join', data => {
      if (data.bannerText) this.updateTopBanner(data.bannerText);
      if (data.spokenText || data.audioUrl) {
        window.wishingAudio.queueSpeech(data.spokenText, data.audioUrl);
      }
      this.spawnWalkingWishmaker(data.nickname, data.avatar, '✨ Welcome to the fountain!', 1, false);
    });

    this.socket.on('tiktok_gift', data => {
      this.performCeremony(data);
    });

    this.socket.on('tiktok_like', data => {
      this.spawnWalkingWishmaker(data.nickname, data.avatar, '❤️ Sent love!', 1, false);
    });

    this.socket.on('tiktok_follow', data => {
      this.updateTopBanner(`✨ Welcome new follower ${data.nickname} to the Magic Wishing Well!`);
      this.spawnWalkingWishmaker(data.nickname, data.avatar, '🔔 Followed!', 2, false);
    });

    this.socket.on('tiktok_share', data => {
      this.updateTopBanner(`🌟 ${data.nickname} shared the Magic Fountain with friends!`);
      this.spawnWalkingWishmaker(data.nickname, data.avatar, '↗️ Shared with friends!', 2, false);
    });

    this.socket.on('offering_event', data => {
      this.triggerFountainSurge(4500);
      this.performCeremony({
        ...data,
        giftName: '50 Hearts of Love',
        coins: 0
      });
    });

    this.socket.on('trigger_all_bow', data => {
      this.triggerFountainSurge(data.duration || 4000);
    });

    this.socket.on('fill_all_seats', () => {
      this.triggerFountainSurge(6000);
    });

    this.socket.on('toggle_donation_cards', data => {
      const cardsRow = document.getElementById('donation-cards-row');
      if (cardsRow) {
        cardsRow.style.display = data.visible ? 'flex' : 'none';
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.wishingApp = new WishingWellLiveApp();
});
