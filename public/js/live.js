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

// ==================== 36 PILGRIM SEATS & GAME RULES MANAGER ====================
class PilgrimSeatsManager {
  constructor(app) {
    this.app = app;
    this.container = document.getElementById('pilgrim-seats-grid');
    this.seatsCountEl = document.getElementById('hud-seats-count');
    this.timerEl = document.getElementById('hud-timer-count');
    this.resonanceEl = document.getElementById('hud-resonance-count');

    this.totalSeats = 36;
    this.seats = [];
    this.roundRemainingSec = 24 * 60 + 18; // Default 00:24:18

    this.initSeatPositions();
    this.seedInitialPilgrims();
    this.startRoundTimer();
    this.startTierLevelUpLoop();
    this.startCrowdChatterLoop();
  }

  getTierClass(tier) {
    if (tier >= 8) return 'tier-archon';
    if (tier >= 5) return 'tier-mystic';
    if (tier >= 3) return 'tier-adept';
    return 'tier-apprentice';
  }

  initSeatPositions() {
    this.seats = [];
    const rowConfigs = [
      { row: 0, count: 8, y: 1000, startX: 120, endX: 960, scale: 0.82 },
      { row: 1, count: 9, y: 1170, startX: 90, endX: 990, scale: 0.88 },
      { row: 2, count: 9, y: 1350, startX: 90, endX: 990, scale: 0.94 },
      { row: 3, count: 10, y: 1530, startX: 70, endX: 1010, scale: 1.00 }
    ];

    let seatIdx = 0;
    rowConfigs.forEach(rc => {
      const step = (rc.endX - rc.startX) / (rc.count - 1);
      for (let i = 0; i < rc.count; i++) {
        const x = Math.round(rc.startX + step * i);
        const y = rc.y;
        this.seats.push({
          index: seatIdx,
          x: x,
          y: y,
          scale: rc.scale,
          occupied: false,
          user: null,
          domEl: null
        });
        seatIdx++;
      }
    });

    if (!this.container) return;
    this.container.innerHTML = '';

    this.seats.forEach(s => {
      const el = document.createElement('div');
      el.className = 'pilgrim-seat-slot empty';
      el.id = `seat-slot-${s.index}`;
      el.style.left = `${s.x}px`;
      el.style.top = `${s.y}px`;
      el.style.transform = `translate(-50%, -50%) scale(${s.scale})`;

      el.innerHTML = `
        <div class="seat-content">
          <div class="seat-figure">
            <div class="seat-halo"></div>
            <div class="seat-avatar-wrap">
              <img class="seat-avatar" src="${DEFAULT_AVATAR}" alt="Seat ${s.index + 1}" />
              <span class="seat-tier-badge" style="display: none;">T1</span>
            </div>
            <div class="seat-robe tier-apprentice">
              <div class="robe-torso"></div>
              <div class="robe-arms">
                <span class="robe-coin">🪙</span>
              </div>
              <div class="robe-knees"></div>
            </div>
          </div>
          <div class="seat-name-pill">Empty</div>
        </div>
        <div class="seat-mat"></div>
      `;
      this.container.appendChild(el);
      s.domEl = el;
    });
  }

  seedInitialPilgrims() {
    const SAMPLE_PILGRIMS = [
      { nickname: 'Sâu Róm', tier: 3, avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face', score: 45 },
      { nickname: 'Kẹo Ngọt', tier: 2, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face', score: 32 },
      { nickname: 'Mạnh Hùng', tier: 4, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face', score: 68 },
      { nickname: 'Ngọc Huyền', tier: 5, avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face', score: 89 },
      { nickname: 'Tiểu Mi', tier: 1, avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face', score: 20 },
      { nickname: 'Gấu Bông', tier: 3, avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=face', score: 41 },
      { nickname: 'Hải Yến', tier: 2, avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face', score: 30 },
      { nickname: 'Tú Anh', tier: 4, avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face', score: 61 },
      { nickname: 'Phong Vũ', tier: 1, avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop&crop=face', score: 18 },
      { nickname: 'Bảo Ngọc', tier: 3, avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&h=100&fit=crop&crop=face', score: 52 },
      { nickname: 'Quang Huy', tier: 2, avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&h=100&fit=crop&crop=face', score: 28 },
      { nickname: 'Đức Anh', tier: 5, avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face', score: 75 },
      { nickname: 'Nam Pro', tier: 6, avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face', score: 85 },
      { nickname: 'Thảo Pé', tier: 1, avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=face', score: 14 },
      { nickname: 'hh3D', tier: 7, avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face', score: 115 },
      { nickname: 'Tru Tiên', tier: 2, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face', score: 36 },
      { nickname: 'Minh An', tier: 3, avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face', score: 48 },
      { nickname: 'Linh Chi', tier: 4, avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face', score: 59 },
      { nickname: 'Mi mixi', tier: 2, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face', score: 26 },
      { nickname: 'lining', tier: 1, avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop&crop=face', score: 12 },
      { nickname: 'Hùnh bí', tier: 4, avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face', score: 64 },
      { nickname: 'trang', tier: 3, avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&h=100&fit=crop&crop=face', score: 44 },
      { nickname: 'Gia dụ', tier: 2, avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&h=100&fit=crop&crop=face', score: 33 },
      { nickname: 'ttg shop', tier: 5, avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face', score: 57 }
    ];

    SAMPLE_PILGRIMS.forEach((p, idx) => {
      if (idx < this.seats.length) {
        this.occupySeat(this.seats[idx], {
          uniqueId: `sample_${idx}`,
          nickname: p.nickname,
          avatar: p.avatar,
          tier: p.tier,
          score: p.score,
          likesCount: 0,
          seatedAt: Date.now() - (p.tier * 180000),
          lastActiveAt: Date.now()
        });
      }
    });

    this.updateSeatsBadge();
  }

  occupySeat(seat, userData) {
    seat.occupied = true;
    seat.user = userData;
    if (!seat.domEl) return;

    seat.domEl.classList.remove('empty');
    const avatarImg = seat.domEl.querySelector('.seat-avatar');
    const namePill = seat.domEl.querySelector('.seat-name-pill');
    const tierBadge = seat.domEl.querySelector('.seat-tier-badge');
    const robeEl = seat.domEl.querySelector('.seat-robe');
    const figureEl = seat.domEl.querySelector('.seat-figure');

    const tier = userData.tier || 1;
    const tierClass = this.getTierClass(tier);

    if (avatarImg) avatarImg.src = safeImageUrl(userData.avatar);
    if (namePill) namePill.innerText = userData.nickname;
    if (tierBadge) {
      tierBadge.style.display = 'block';
      tierBadge.innerText = `T${tier}`;
      if (tier >= 5) {
        tierBadge.classList.add('tier-gold');
      } else {
        tierBadge.classList.remove('tier-gold');
      }
    }

    if (robeEl) {
      robeEl.className = `seat-robe ${tierClass}`;
    }
    if (figureEl) {
      figureEl.className = `seat-figure ${tierClass}`;
    }
  }

  claimSeatForUser(user) {
    if (!user) return null;
    const uid = user.uniqueId || user.nickname;

    // Check if user is already seated
    const existing = this.seats.find(s => s.occupied && s.user && (s.user.uniqueId === uid || s.user.nickname === user.nickname));
    if (existing) {
      existing.user.lastActiveAt = Date.now();
      if (user.avatar) existing.user.avatar = user.avatar;
      return existing;
    }

    // Find first empty seat
    let targetSeat = this.seats.find(s => !s.occupied);

    // If completely full (36/36), kick least recently active user
    if (!targetSeat) {
      let oldestTime = Infinity;
      let oldestSeat = null;
      this.seats.forEach(s => {
        if (s.occupied && s.user && s.user.lastActiveAt < oldestTime) {
          oldestTime = s.user.lastActiveAt;
          oldestSeat = s;
        }
      });
      targetSeat = oldestSeat || this.seats[0];
    }

    this.occupySeat(targetSeat, {
      uniqueId: uid,
      nickname: user.nickname,
      avatar: user.avatar || DEFAULT_AVATAR,
      tier: 1,
      score: 0,
      likesCount: 0,
      seatedAt: Date.now(),
      lastActiveAt: Date.now()
    });

    this.updateSeatsBadge();
    return targetSeat;
  }

  handleChat(data) {
    const seat = this.claimSeatForUser(data);
    if (!seat || !seat.domEl) return;

    let bubble = seat.domEl.querySelector('.seat-chat-bubble');
    if (bubble) bubble.remove();

    bubble = document.createElement('div');
    bubble.className = 'seat-chat-bubble';
    bubble.innerText = data.comment;
    seat.domEl.querySelector('.seat-content').prepend(bubble);

    // Living Procession: Avatar walks along sacred pathway up to well!
    this.spawnProcessionWalker(data, `💬 "${data.comment}"`);

    setTimeout(() => {
      if (bubble.parentNode) bubble.remove();
    }, 4000);
  }

  handleLikes(data) {
    const seat = this.claimSeatForUser(data);
    if (!seat || !seat.user) return;

    const likeCount = data.likeCount || 1;
    seat.user.likesCount = (seat.user.likesCount || 0) + likeCount;
    seat.user.lastActiveAt = Date.now();

    if (seat.user.likesCount >= 20) {
      const tosses = Math.floor(seat.user.likesCount / 20);
      seat.user.likesCount = seat.user.likesCount % 20;

      for (let i = 0; i < tosses; i++) {
        setTimeout(() => {
          this.triggerSeatCoinToss(seat);
        }, i * 300);
      }
    }
  }

  triggerSeatCoinToss(seat) {
    if (!seat || !seat.domEl || !seat.user) return;

    seat.domEl.classList.add('tossing');
    setTimeout(() => seat.domEl.classList.remove('tossing'), 700);

    const basePts = Math.floor(Math.random() * 21) + 10;
    const tierBonus = (seat.user.tier - 1) * 5;
    const earned = basePts + tierBonus;
    seat.user.score = (seat.user.score || 0) + earned;

    const popup = document.createElement('div');
    popup.className = 'floating-score-popup';
    popup.innerText = `+${earned} pts`;
    seat.domEl.appendChild(popup);
    setTimeout(() => {
      if (popup.parentNode) popup.remove();
    }, 1300);

    if (this.app && this.app.tossedCoins) {
      this.app.tossedCoins.push({
        startX: seat.x,
        startY: seat.y - 20,
        x: seat.x,
        y: seat.y - 20,
        targetX: 540 + (Math.random() - 0.5) * 60,
        targetY: 870 + (Math.random() - 0.5) * 30,
        arcHeight: 220 + Math.random() * 60,
        spinAngle: 0,
        spinSpeed: 0.22,
        progress: 0,
        speed: 0.022,
        scale: 0.75,
        isGolden: (seat.user.tier >= 4),
        avatarImg: null
      });
    }

    if (window.wishingAudio) {
      window.wishingAudio.playCoinClink();
    }
  }

  handleGift(data) {
    const seat = this.claimSeatForUser(data);
    if (!seat || !seat.user) return;

    const coins = data.coins || 1;
    const giftScore = coins * 100;
    seat.user.score = (seat.user.score || 0) + giftScore;
    seat.user.lastActiveAt = Date.now();

    // Spawn walking procession for gift giver
    this.spawnProcessionWalker(data, `🎁 ${data.giftName || 'Sacred Relic'}`);

    const popup = document.createElement('div');
    popup.className = 'floating-score-popup';
    popup.style.color = '#38bdf8';
    popup.style.fontSize = '22px';
    popup.innerText = `+${giftScore} pts!`;
    seat.domEl.appendChild(popup);
    setTimeout(() => {
      if (popup.parentNode) popup.remove();
    }, 1800);
  }

  updateSeatsBadge() {
    if (!this.seatsCountEl) return;
    const occupied = this.seats.filter(s => s.occupied).length;
    this.seatsCountEl.innerText = `${occupied}/36 Seats`;
  }

  startRoundTimer() {
    setInterval(() => {
      if (this.roundRemainingSec > 0) {
        this.roundRemainingSec--;
      } else {
        this.roundRemainingSec = 30 * 60;
        if (this.app) this.app.triggerFountainSurge(5000);
        this.triggerMassCeremony(6000);
      }

      if (this.timerEl) {
        const mins = Math.floor(this.roundRemainingSec / 60);
        const secs = this.roundRemainingSec % 60;
        this.timerEl.innerText = `00:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }
    }, 1000);
  }

  startTierLevelUpLoop() {
    setInterval(() => {
      const now = Date.now();
      this.seats.forEach(s => {
        if (s.occupied && s.user && s.user.tier < 10) {
          const duration = now - s.user.seatedAt;
          const nextTierDuration = s.user.tier * 180000;
          if (duration >= nextTierDuration) {
            s.user.tier++;
            this.occupySeat(s, s.user);
          }
        }
      });
    }, 30000);
  }

  startCrowdChatterLoop() {
    const CHATTER_SAMPLES = [
      '✨ May fortune smile!',
      '🙏 Peace & abundance',
      '🪙 Tossed a prayer!',
      '🍀 Blessed day to all!',
      '❤️ Sending love & light',
      '🌟 Wishing well resonates!',
      '💎 Sacred energy flows',
      '🌊 The water sings!',
      '🔥 Top 1 is rising!',
      '✨ Radiance and joy!'
    ];

    setInterval(() => {
      const occupiedSeats = this.seats.filter(s => s.occupied && s.domEl);
      if (occupiedSeats.length === 0) return;

      const count = Math.min(occupiedSeats.length, Math.floor(Math.random() * 2) + 1);
      for (let i = 0; i < count; i++) {
        const seat = occupiedSeats[Math.floor(Math.random() * occupiedSeats.length)];
        if (!seat || !seat.domEl) continue;
        if (seat.domEl.querySelector('.seat-micro-bubble')) continue;

        const msg = CHATTER_SAMPLES[Math.floor(Math.random() * CHATTER_SAMPLES.length)];
        const bubble = document.createElement('div');
        bubble.className = 'seat-micro-bubble';
        bubble.innerText = msg;
        seat.domEl.querySelector('.seat-content').prepend(bubble);

        setTimeout(() => {
          if (bubble.parentNode) bubble.remove();
        }, 3400);
      }
    }, 3200);
  }

  spawnProcessionWalker(user, text = '✨ Making a wish...') {
    const stage = document.getElementById('procession-stage');
    if (!stage || !user) return;

    const walker = document.createElement('div');
    walker.className = 'procession-walker';
    walker.style.left = '540px';
    walker.style.top = '1780px';

    const nickname = escapeHtml(user.nickname || 'Pilgrim');
    const avatar = safeImageUrl(user.avatar);
    const bubbleText = escapeHtml(String(text).slice(0, 32));

    walker.innerHTML = `
      <div class="walker-bubble">${bubbleText}</div>
      <div class="walker-head">
        <img src="${avatar}" class="walker-avatar" alt="${nickname}" />
      </div>
      <div class="walker-body">
        <span class="walker-coin-hand">🪙</span>
      </div>
      <div class="walker-feet">
        <div class="walker-foot left"></div>
        <div class="walker-foot right"></div>
      </div>
    `;

    stage.appendChild(walker);

    requestAnimationFrame(() => {
      walker.style.top = '915px';
    });

    setTimeout(() => {
      if (this.app && this.app.tossedCoins) {
        this.app.tossedCoins.push({
          startX: 540,
          startY: 915,
          x: 540,
          y: 915,
          targetX: 540 + (Math.random() - 0.5) * 60,
          targetY: 870 + (Math.random() - 0.5) * 30,
          arcHeight: 130,
          spinAngle: 0,
          spinSpeed: 0.25,
          progress: 0,
          speed: 0.03,
          scale: 0.9,
          isGolden: true,
          avatarImg: null
        });
      }

      if (window.wishingAudio) {
        window.wishingAudio.playCoinClink();
      }

      walker.style.opacity = '0';
      walker.style.transform = 'translate(-50%, -120%) scale(1.3)';
      setTimeout(() => {
        if (walker.parentNode) walker.remove();
      }, 600);
    }, 3800);
  }

  triggerMassCeremony(duration = 4500) {
    this.seats.forEach((s, idx) => {
      if (s.occupied && s.domEl) {
        s.domEl.classList.add('mass-ceremony');
        setTimeout(() => {
          this.triggerSeatCoinToss(s);
        }, idx * 60);
      }
    });

    if (window.wishingAudio) {
      window.wishingAudio.playMagicChime();
    }

    setTimeout(() => {
      this.seats.forEach(s => {
        if (s.domEl) s.domEl.classList.remove('mass-ceremony');
      });
    }, duration);
  }

  fillAllSeats() {
    for (let i = 0; i < this.seats.length; i++) {
      const s = this.seats[i];
      if (!s.occupied) {
        this.occupySeat(s, {
          uniqueId: `seat_guest_${i}`,
          nickname: `Pilgrim #${i + 1}`,
          avatar: `https://images.unsplash.com/photo-${1535713875000 + (i * 13) % 200}?w=100&h=100&fit=crop&crop=face`,
          tier: Math.floor(Math.random() * 5) + 1,
          score: Math.floor(Math.random() * 80) + 10,
          likesCount: 0,
          seatedAt: Date.now(),
          lastActiveAt: Date.now()
        });
      }
    }
    this.updateSeatsBadge();
  }

  resetAllSeats() {
    this.seats.forEach(s => {
      s.occupied = false;
      s.user = null;
      if (s.domEl) {
        s.domEl.className = 'pilgrim-seat-slot empty';
        const namePill = s.domEl.querySelector('.seat-name-pill');
        const tierBadge = s.domEl.querySelector('.seat-tier-badge');
        if (namePill) namePill.innerText = 'Empty';
        if (tierBadge) tierBadge.style.display = 'none';
      }
    });
    this.updateSeatsBadge();
  }
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
    this.initBannerCarousel();
    this.initSocket();
    this.initQuickActions();
    this.setupAudioTrigger();
    this.seatsManager = new PilgrimSeatsManager(this);
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
    window.wishingAudio.queueSpeech(spokenText, audioUrl, true, coins, data.voiceGender);

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
    if (!comment || typeof comment !== 'string' || comment.trim() === '') return;
    // Defense-in-depth safety guard: block any residual vulgarity or URL redirection
    if (/[<>]|\b(fuck|shit|bitch|cunt|dick|pussy|nigger|nigga|kys|porn|telegram|whatsapp)\b/i.test(comment)) return;
    this.spawnWalkingWishmaker(nickname, avatar, `"${comment.trim()}"`, 1, false);
  }

  // Anti-OCR Static Scanner Defense: Auto-cycling dynamic blessings on royal banner
  initBannerCarousel() {
    this.bannerBlessings = [
      '✨ Warmest welcome to the Magic Wishing Well • Cast your penny & make a wish!',
      '🌟 May peace, radiant health and good fortune honour your home and loved ones.',
      '💫 A single drop of kindness creates endless ripples of divine abundance.',
      '🕊️ Quiet your mind, whisper your prayer, and let the sacred waters manifest your wish.',
      '🪙 Toss a lucky penny into the mystical waters • Every blessing begins with hope.',
      '🌿 Healing, serenity, and boundless joy to every noble traveller arriving today.',
      '👑 Top 1 Guardian holds the Golden Crown • May abundance smile upon all.',
      '🌸 Believe in your journey • What is meant for you will always find its way.'
    ];
    this.currentBannerIdx = 0;
    this.bannerOverrideUntil = 0;

    setInterval(() => {
      if (Date.now() < this.bannerOverrideUntil) return;
      this.currentBannerIdx = (this.currentBannerIdx + 1) % this.bannerBlessings.length;
      this.cycleBannerWithFade(this.bannerBlessings[this.currentBannerIdx]);
    }, 16000);
  }

  cycleBannerWithFade(text) {
    const bannerCard = document.querySelector('.royal-announcement-card');
    const bannerEl = document.getElementById('royal-banner-text');
    if (!bannerEl || !bannerCard) return;

    bannerCard.style.transition = 'opacity 0.6s ease';
    bannerCard.style.opacity = '0.2';
    setTimeout(() => {
      bannerEl.textContent = text;
      bannerCard.style.opacity = '1.0';
    }, 600);
  }

  updateTopBanner(text, holdSeconds = 12) {
    this.bannerOverrideUntil = Date.now() + (holdSeconds * 1000);
    this.cycleBannerWithFade(text);
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
    if (!list) return;

    // Update Right HUD Top Guardians Panel (Top 5)
    const hudTopList = document.getElementById('hud-top-list');
    if (hudTopList) {
      hudTopList.innerHTML = '';
      const top5 = list.slice(0, 5);
      const badges = ['🥇', '🥈', '🥉', '4', '5'];
      top5.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = `top-list-row rank-${index + 1}`;
        row.innerHTML = `
          <span class="top-rank-badge">${badges[index] || (index + 1)}</span>
          <span class="top-name">${escapeHtml(item.nickname)}</span>
          <span class="top-score">${escapeHtml(item.score)} pts</span>
        `;
        hudTopList.appendChild(row);
      });
    }

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

    // Update HUD Resonance Badge
    const hudResonanceEl = document.getElementById('hud-resonance-count');
    if (hudResonanceEl) {
      hudResonanceEl.innerText = `${energy.current || 0} / ${energy.max || 1000} Resonance`;
    }

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

  // Feature: Jackpot Golden Rush Shower (50-60 cascading golden coins)
  triggerGoldenRush(data) {
    const leaderName = (data.awakener && data.awakener.nickname) ? data.awakener.nickname : 'Divine Awakener';
    this.updateTopBanner(`✨ GOLDEN JACKPOT RUSH! Level ${data.level || 6} unlocked by ${leaderName}! 🌟`);
    this.triggerFountainSurge(7500);
    window.wishingAudio.playBell();

    let count = 0;
    const showerInterval = setInterval(() => {
      if (count >= 50) {
        clearInterval(showerInterval);
        return;
      }
      count++;
      const startX = 220 + Math.random() * 640;
      const targetX = this.wellCenter.x + (Math.random() - 0.5) * 160;
      const targetY = this.wellCenter.y + (Math.random() - 0.5) * 80;

      this.tossedCoins.push({
        startX,
        startY: -40,
        targetX,
        targetY,
        x: startX,
        y: -40,
        progress: 0,
        duration: 0.85 + Math.random() * 0.45,
        peakHeight: 20 + Math.random() * 30,
        scale: 0.75 + Math.random() * 0.35,
        radius: 12 + Math.random() * 6,
        color: '#fef08a',
        isGolden: true,
        spinAngle: Math.random() * Math.PI,
        spinSpeed: 0.18 + Math.random() * 0.25,
        nickname: leaderName,
        avatarImg: null,
        onLandedCallback: null
      });
    }, 80);
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

      // 2.5 Render Celestial Shifting God Rays (Anti-Static Video Hash Bypass)
      this.renderGodRays();

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

      // Stardust Meteor Trail: dense sparkling trail trailing behind the flying coin
      const trailSparkles = c.isGolden ? 3 : 2;
      for (let s = 0; s < trailSparkles; s++) {
        this.particles.push({
          x: c.x + (Math.random() - 0.5) * 12,
          y: c.y + (Math.random() - 0.5) * 12,
          vx: -(c.targetX - c.startX) * 0.003 + (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.5) * 1.5,
          gravity: 0.02,
          radius: 1.5 + Math.random() * 3.5,
          color: c.isGolden ? (Math.random() > 0.35 ? '#fef08a' : '#ffffff') : '#38bdf8',
          alpha: 0.95,
          decay: 0.035
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
    // 100% Anti-Static Screen Dynamics: Full-screen subtle ambient pixel breathing pulse
    const breatheTime = Date.now() * 0.0008;
    const breatheAlpha = 0.015 + 0.012 * Math.sin(breatheTime);
    this.ctx.fillStyle = `rgba(56, 189, 248, ${breatheAlpha})`;
    this.ctx.fillRect(0, 0, 1080, 1920);

    this.ctx.globalAlpha = 1.0;
    this.ctx.restore();
  }

  // Anti-Static God Rays: Constantly shifts pixel values across the entire vertical canvas
  renderGodRays() {
    const time = Date.now() * 0.0005;
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'screen';

    for (let i = 0; i < 4; i++) {
      const angle = 0.32 + Math.sin(time + i * 1.5) * 0.07;
      const startX = 140 + i * 240 + Math.cos(time * 0.7 + i) * 70;
      const width = 110 + Math.sin(time + i) * 30;
      const alpha = 0.035 + Math.sin(time * 1.1 + i * 2) * 0.02;

      const grad = this.ctx.createLinearGradient(startX, 0, startX + Math.tan(angle) * 1400, 1400);
      grad.addColorStop(0, `rgba(254, 240, 138, ${alpha * 1.8})`);
      grad.addColorStop(0.4, `rgba(56, 189, 248, ${alpha})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.moveTo(startX - width * 0.3, 0);
      this.ctx.lineTo(startX + width * 0.7, 0);
      this.ctx.lineTo(startX + Math.tan(angle) * 1500 + width * 2, 1500);
      this.ctx.lineTo(startX + Math.tan(angle) * 1500 - width * 2, 1500);
      this.ctx.closePath();
      this.ctx.fill();
    }

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

    // 100% Anti-Static Screen Dynamics: Full-screen subtle ambient pixel breathing pulse
    const breatheTime = Date.now() * 0.0008;
    const breatheAlpha = 0.015 + 0.012 * Math.sin(breatheTime);
    this.ctx.fillStyle = `rgba(56, 189, 248, ${breatheAlpha})`;
    this.ctx.fillRect(0, 0, 1080, 1920);

    this.ctx.globalAlpha = 1.0;
    this.ctx.restore();
  }

  // Anti-Static God Rays: Constantly shifts pixel values across the entire vertical canvas
  renderGodRays() {
    const time = Date.now() * 0.0005;
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'screen';

    for (let i = 0; i < 4; i++) {
      const angle = 0.32 + Math.sin(time + i * 1.5) * 0.07;
      const startX = 140 + i * 240 + Math.cos(time * 0.7 + i) * 70;
      const width = 110 + Math.sin(time + i) * 30;
      const alpha = 0.035 + Math.sin(time * 1.1 + i * 2) * 0.02;

      const grad = this.ctx.createLinearGradient(startX, 0, startX + Math.tan(angle) * 1400, 1400);
      grad.addColorStop(0, `rgba(254, 240, 138, ${alpha * 1.8})`);
      grad.addColorStop(0.4, `rgba(56, 189, 248, ${alpha})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.moveTo(startX - width * 0.3, 0);
      this.ctx.lineTo(startX + width * 0.7, 0);
      this.ctx.lineTo(startX + Math.tan(angle) * 1500 + width * 2, 1500);
      this.ctx.lineTo(startX + Math.tan(angle) * 1500 - width * 2, 1500);
      this.ctx.closePath();
      this.ctx.fill();
    }

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
      if (this.seatsManager) this.seatsManager.triggerMassCeremony(8000);
    });

    this.socket.on('golden_rush_event', data => {
      this.triggerGoldenRush(data);
    });

    this.socket.on('top1_dethroned', data => {
      this.showOutbidAlert(data.newLeader, data.oldLeader);
    });

    this.socket.on('tiktok_chat', data => {
      this.showChatBubble(data.nickname, data.comment, data.avatar);
      if (this.seatsManager) this.seatsManager.handleChat(data);
    });

    this.socket.on('tiktok_join', data => {
      if (data.bannerText) this.updateTopBanner(data.bannerText);
      if (data.spokenText || data.audioUrl) {
        window.wishingAudio.queueSpeech(data.spokenText, data.audioUrl, false, 0, data.voiceGender);
      }
      this.spawnWalkingWishmaker(data.nickname, data.avatar, '✨ Welcome to the fountain!', 1, false);
      if (this.seatsManager) {
        this.seatsManager.claimSeatForUser(data);
        this.seatsManager.spawnProcessionWalker(data, '✨ Arrived at Fountain!');
      }
    });

    this.socket.on('tiktok_gift', data => {
      this.performCeremony(data);
      if (this.seatsManager) this.seatsManager.handleGift(data);
    });

    this.socket.on('tiktok_like', data => {
      this.spawnWalkingWishmaker(data.nickname, data.avatar, '❤️ Sent love!', 1, false);
      if (this.seatsManager) this.seatsManager.handleLikes(data);
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
      if (this.seatsManager) this.seatsManager.triggerMassCeremony(4500);
    });

    this.socket.on('trigger_all_bow', data => {
      this.triggerFountainSurge(data.duration || 4000);
      if (this.seatsManager) this.seatsManager.triggerMassCeremony(data.duration || 4000);
    });

    this.socket.on('fill_all_seats', () => {
      this.triggerFountainSurge(6000);
      if (this.seatsManager) this.seatsManager.fillAllSeats();
    });

    this.socket.on('reset_all_seats', () => {
      if (this.seatsManager) this.seatsManager.resetAllSeats();
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
