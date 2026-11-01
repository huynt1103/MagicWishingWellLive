const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { EdgeTTS } = require('node-edge-tts');
const { isToxic, sanitizeNickname, sanitizeGiftName, sanitizeComment, sanitizeWish } = require('./moderation');

// Support both tiktok-live-connector legacy and modern exports
let WebcastPushConnection;
try {
  WebcastPushConnection = require('tiktok-live-connector/legacy').WebcastPushConnection;
} catch (e) {
  const mod = require('tiktok-live-connector');
  WebcastPushConnection = mod.WebcastPushConnection || mod.TikTokLiveConnection;
}

// Bypass EulerStream commercial paywall on pre-fetching gift lists
try {
  const { RouteConfig } = require('tiktok-live-connector');
  if (RouteConfig) {
    RouteConfig.fetchRoomGifts = async () => [];
    RouteConfig.fetchRoomGiftsFromProvider = async () => [];
  }
} catch (e) {}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Guard against unhandled errors from third-party protobuf events
process.on('uncaughtException', err => {
  console.error('[Uncaught Exception]:', err.message);
});
process.on('unhandledRejection', reason => {
  console.error('[Unhandled Rejection]:', reason);
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure directories
const CACHE_DIR = path.join(__dirname, 'public', 'audio_cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Load wishes
let wishes = [];
try {
  const wishesPath = path.join(__dirname, 'wishes.json');
  const wishesData = fs.readFileSync(wishesPath, 'utf8');
  wishes = JSON.parse(wishesData);
} catch (e) {
  console.error('Error loading wishes:', e);
}

// App State
let tiktokConnection = null;
let currentTiktokUser = '';
let currentSessionId = '';
let connectionStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'error'
let simulationTimer = null;
let isSimulating = false;

// Initial 8 Fountain Guardians (Top 8 Pedestals)
let leaderboard = [
  { uniqueId: 'alex_m', nickname: 'Alexander M.', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face', score: 320 },
  { uniqueId: 'sophia_g', nickname: 'Sophia Green', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face', score: 265 },
  { uniqueId: 'liam_w', nickname: 'Liam Walker', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face', score: 180 },
  { uniqueId: 'olivia_s', nickname: 'Olivia Smith', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face', score: 140 },
  { uniqueId: 'ethan_b', nickname: 'Ethan Brown', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face', score: 95 },
  { uniqueId: 'isabella_d', nickname: 'Isabella Davis', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face', score: 70 },
  { uniqueId: 'lucas_m', nickname: 'Lucas Martinez', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop&crop=face', score: 55 },
  { uniqueId: 'mia_a', nickname: 'Mia Anderson', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=face', score: 40 }
];

// State Persistence (Chống mất trắng dữ liệu BXH và Năng lượng khi server restart)
const STATE_FILE = path.join(__dirname, 'state.json');

function saveAppState() {
  try {
    const data = {
      leaderboard,
      fountainEnergy,
      fountainLevel,
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[State Persistence Error]:', e.message);
  }
}

function loadAppState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.leaderboard) && data.leaderboard.length > 0) {
        leaderboard = data.leaderboard;
      }
      if (typeof data.fountainEnergy === 'number') {
        fountainEnergy = data.fountainEnergy;
      }
      if (typeof data.fountainLevel === 'number') {
        fountainLevel = data.fountainLevel;
      }
      console.log(`[State Persistence] Restored state: Level ${fountainLevel}, Energy ${fountainEnergy}, ${leaderboard.length} guardians`);
    }
  } catch (e) {
    console.error('[State Persistence Load Error]:', e.message);
  }
}

// Feature #1: Water Resonance Energy (Subtle Natural Mega Surge)
let fountainEnergy = 740; // 0 to 1000
const fountainEnergyMax = 1000;
let fountainLevel = 5;

// Load persisted state if exists
loadAppState();

function addFountainEnergy(amount, user = null) {
  fountainEnergy += amount;
  if (fountainEnergy >= fountainEnergyMax) {
    fountainEnergy = 0;
    fountainLevel++;
    const awakenerUser = user || {
      nickname: 'Divine Benefactor',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face'
    };
    io.emit('fountain_awakened', {
      level: fountainLevel,
      awakener: awakenerUser
    });
    // Feature: Jackpot Golden Rush shower!
    io.emit('golden_rush_event', {
      level: fountainLevel,
      awakener: awakenerUser,
      count: 65
    });
    saveAppState();
  }
  const percent = Math.min(100, Math.floor((fountainEnergy / fountainEnergyMax) * 100));
  io.emit('energy_update', {
    current: fountainEnergy,
    max: fountainEnergyMax,
    percent: percent,
    level: fountainLevel
  });
  saveAppState();
}

// App Configuration
let appConfig = {
  ttsEnabled: true,
  ttsVoice: 'alternate', // Default to alternating male & female voices
  ttsLang: 'en',
  ttsRate: '+0%',
  rippleInterval: 3000,
  moInterval: 3000,
  autoBow: true,
  bellOnGift: true,
  bgmEnabled: true,
  bgmTrack: 'crystal_harp',
  bgmVolume: 0.30,
  minGiftCoinsForAltar: 5,
  minGiftCoinsForFortune: 10,
  minLikesForFlowers: 50,
  totalWishesCount: 1248
};

// Update donor in leaderboard
function recordDonation(user, coins) {
  if (!user || coins <= 0) return;
  const safeName = sanitizeNickname(user.nickname);
  user.nickname = safeName;
  const prevLeader = leaderboard[0] ? { ...leaderboard[0] } : null;

  const existing = leaderboard.find(item => item.uniqueId === user.uniqueId);
  if (existing) {
    existing.score += coins;
    if (user.avatar) existing.avatar = user.avatar;
    existing.nickname = safeName;
  } else {
    leaderboard.push({
      uniqueId: user.uniqueId || `user_${Date.now()}`,
      nickname: safeName,
      avatar: user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face',
      score: coins
    });
  }
  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard = leaderboard.slice(0, 20);
  io.emit('leaderboard_update', leaderboard);
  saveAppState();

  // Feature #2 & #6: Real-time Dethrone Outbid Alert!
  const newLeader = leaderboard[0];
  if (prevLeader && newLeader && prevLeader.uniqueId !== newLeader.uniqueId) {
    console.log(`[OUTBID DETHRONED] ${newLeader.nickname} has dethroned ${prevLeader.nickname}!`);
    io.emit('top1_dethroned', {
      newLeader: newLeader,
      oldLeader: prevLeader
    });
  }

  // Feature #1: Subtle Water Resonance energy gain
  addFountainEnergy(coins * 10, user);
}

// Voice Pools: authentic British Neural voices (Received Pronunciation & Modern UK English)
const VOICE_POOLS = {
  en: {
    female: ['en-GB-SoniaNeural', 'en-GB-LibbyNeural', 'en-GB-MaisieNeural'],
    male: ['en-GB-RyanNeural', 'en-GB-ThomasNeural']
  },
  vi: {
    female: ['vi-VN-HoaiMyNeural'],
    male: ['vi-VN-NamMinhNeural']
  }
};

let lastVoiceGender = 'male';

function resolveVoiceAndGender(preferredVoice = null, lang = 'en') {
  const langKey = lang === 'vi' ? 'vi' : 'en';
  const pool = VOICE_POOLS[langKey] || VOICE_POOLS.en;

  // 1. If explicit specific voice chosen in config (e.g. Jenny or Guy)
  if (preferredVoice && preferredVoice !== 'alternate' && preferredVoice !== 'default') {
    const isMale = pool.male.includes(preferredVoice) || /guy|andrew|brian|ryan|david|thomas|alfie|george|oliver|arthur/i.test(preferredVoice);
    return {
      voice: preferredVoice,
      gender: isMale ? 'male' : 'female'
    };
  }

  // 2. Alternating mode: strictly alternates between female and male on each read
  const nextGender = lastVoiceGender === 'female' ? 'male' : 'female';
  lastVoiceGender = nextGender;
  const list = pool[nextGender] || pool.female;
  const chosenVoice = list[Math.floor(Math.random() * list.length)];
  return {
    voice: chosenVoice,
    gender: nextGender
  };
}

// Generate speech file with EdgeTTS (Zero Python Dependency, pure Node.js)
async function generateSpeechFile(text, preferredVoice = null, rate = appConfig.ttsRate, lang = appConfig.ttsLang || 'en') {
  if (!text || !text.trim()) return { url: null, gender: 'female', voice: 'none' };

  const { voice, gender } = resolveVoiceAndGender(preferredVoice || appConfig.ttsVoice, lang);
  const hash = crypto.createHash('md5').update(`${text}_${voice}_${rate}_${lang}`).digest('hex');
  const filename = `${hash}.mp3`;
  const outputPath = path.join(CACHE_DIR, filename);
  const publicUrl = `/audio_cache/${filename}`;

  const hasValidFile = () => fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0;

  if (hasValidFile()) {
    return { url: publicUrl, gender, voice };
  }

  try {
    const tts = new EdgeTTS({ voice, lang });
    await tts.ttsPromise(text, outputPath);
    if (hasValidFile()) {
      return { url: publicUrl, gender, voice };
    }
    throw new Error('TTS generated empty file');
  } catch (err) {
    console.warn(`[EdgeTTS Error (${voice})]: ${err.message}. Trying Google TTS fallback...`);
    try {
      const gUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text.slice(0, 200))}&tl=${lang}&client=tw-ob`;
      const res = await fetch(gUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > 0) {
          fs.writeFileSync(outputPath, buffer);
          return { url: publicUrl, gender, voice: 'google-tts-fallback' };
        }
      }
    } catch (gErr) {
      console.error('[Google TTS Fallback Error]:', gErr.message);
    }
    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (e) {}
    return { url: null, gender, voice };
  }
}

// Recent user wishes cache: uniqueId / nickname -> { wish, timestamp }
const recentUserWishes = new Map();

function recordUserWish(userId, commentText, nickname) {
  if (!commentText) return;
  const cleanWish = sanitizeWish(commentText);
  if (!cleanWish) return; // Do not record toxic or invalid comments as wishes!
  const safeName = sanitizeNickname(nickname);
  const now = Date.now();
  // Auto-prune wishes older than 2 minutes
  for (const [key, val] of recentUserWishes.entries()) {
    if (now - val.timestamp > 120000) {
      recentUserWishes.delete(key);
    }
  }
  const data = { wish: cleanWish, nickname: safeName, timestamp: now };
  if (userId) recentUserWishes.set(userId, data);
  if (safeName) recentUserWishes.set(safeName.toLowerCase(), data);
}

function getRecentUserWish(userId, nickname) {
  const now = Date.now();
  let found = userId ? recentUserWishes.get(userId) : null;
  if (!found && nickname) {
    found = recentUserWishes.get(nickname.toLowerCase());
  }
  if (!found) return null;
  if (now - found.timestamp > 120000) {
    if (userId) recentUserWishes.delete(userId);
    if (nickname) recentUserWishes.delete(nickname.toLowerCase());
    return null;
  }
  return found.wish;
}

// Generate wishing text based on gift and name (with smart personalized wish matching)
function generateBlessingText(nickname, giftName, coins, customWish = null) {
  const safeName = sanitizeNickname(nickname);
  const safeGift = sanitizeGiftName(giftName);
  let blessingText = '';
  let wishObj = null;

  const cleanWish = sanitizeWish(customWish);
  if (cleanWish) {
    blessingText = `May your wish come true: "${cleanWish}"!`;
    wishObj = {
      title: `${safeName}'s Sacred Wish`,
      theme: 'Heartfelt Prayer Manifest',
      blessing: `May your prayer be answered: "${cleanWish}"!`,
      isCustom: true
    };
  } else {
    const randomWish = wishes.length > 0
      ? wishes[Math.floor(Math.random() * wishes.length)]
      : { title: 'Golden Wish', blessing: 'May abundance and boundless joy fill your life!' };
    blessingText = randomWish.blessing || 'May all your deepest dreams manifest into reality!';
    wishObj = randomWish;
  }

  let actionText = '';
  if (coins >= 10) {
    actionText = `bestowed a splendid ${safeGift || 'Grand Royal Offering'} into the sacred fountain!`;
  } else if (coins >= 5) {
    actionText = `cast ${safeGift || 'Treasured Pennies'} into the mystical waters.`;
  } else if (coins >= 1) {
    actionText = `cast a lucky penny into the Magic Wishing Well!`;
  } else {
    actionText = `showered the fountain with 50 hearts of goodwill!`;
  }

  const wishPayload = {
    ...wishObj,
    donorNickname: safeName,
    donorGift: safeGift || (coins >= 10 ? 'Golden Crown' : 'Crystal Rose')
  };

  const UK_GRATITUDE_PREFIXES = [
    `Heartfelt thanks to ${safeName} for offering a splendid ${safeGift || (coins + ' lucky pennies')} to the wishing waters!`,
    `A magnificent offering from ${safeName}! May fortune smile brightly upon you:`,
    `Splendid generosity from ${safeName}, casting a ${safeGift || (coins + ' pennies')} into the ancient fountain!`,
    `Warmest gratitude to ${safeName} for bestowing a ${safeGift || (coins + ' coins')} upon the magic well!`
  ];
  const chosenPrefix = UK_GRATITUDE_PREFIXES[Math.floor(Math.random() * UK_GRATITUDE_PREFIXES.length)];
  const spoken = `${chosenPrefix} ${blessingText}`;
  const banner = `${safeName} ${actionText} ${blessingText}`;

  return { banner, spoken, fortune: wishPayload, wish: wishPayload, safeNickname: safeName };
}

// Generate personalized British welcome wish when viewer joins stream
const WELCOME_WISHES = [
  'Warmest welcome to the sacred waters! May peace and good fortune abide with you.',
  'A splendid welcome to the Magic Well! May your most cherished wishes find their way to reality.',
  'Delighted to have you with us! May radiant health and unexpected blessings brighten your days.',
  'Wishing you continuous abundance, boundless cheer, and serenity on your journey.',
  'May every door of opportunity open effortlessly, and may fortune favour your path!',
  'Welcome, noble traveller! May the ancient waters bring calm and good tidings to your heart.'
];

function generateWelcomeBlessing(nickname) {
  const safeName = sanitizeNickname(nickname);
  const template = WELCOME_WISHES[Math.floor(Math.random() * WELCOME_WISHES.length)];
  const UK_WELCOME_STARTERS = [
    `Warmest welcome to ${safeName}!`,
    `A splendid welcome to ${safeName}!`,
    `Delighted to welcome ${safeName} to the wishing waters!`,
    `Welcome, ${safeName}!`
  ];
  const starter = UK_WELCOME_STARTERS[Math.floor(Math.random() * UK_WELCOME_STARTERS.length)];
  return {
    banner: `✨ Welcome ${safeName} to the Magic Wishing Well!`,
    spoken: `${starter} ${template}`,
    blessing: template,
    safeNickname: safeName
  };
}

// ==================== TIKTOK LIVE CONNECTION ====================

const MAX_RECONNECT_ATTEMPTS = 10;
let autoReconnect = false;
let reconnectTimer = null;
let reconnectAttempts = 0;

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  if (!autoReconnect || !currentTiktokUser || reconnectTimer) return;
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    autoReconnect = false;
    connectionStatus = 'error';
    io.emit('connection_status', {
      status: connectionStatus,
      user: currentTiktokUser,
      error: `Lost connection and gave up after ${MAX_RECONNECT_ATTEMPTS} reconnect attempts. Please click Connect again.`
    });
    return;
  }

  const delay = Math.min(60000, 5000 * 2 ** reconnectAttempts);
  reconnectAttempts++;
  console.log(`[TikTok Live] Reconnecting to @${currentTiktokUser} in ${delay / 1000}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
  connectionStatus = 'connecting';
  io.emit('connection_status', { status: connectionStatus, user: currentTiktokUser, reconnectAttempt: reconnectAttempts, reconnectDelayMs: delay });

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToTikTok(currentTiktokUser, currentSessionId, true);
  }, delay);
}

function releaseTikTokConnection() {
  if (!tiktokConnection) return;
  const oldConnection = tiktokConnection;
  tiktokConnection = null;
  oldConnection.removeAllListeners();
  try {
    Promise.resolve(oldConnection.disconnect()).catch(() => {});
  } catch (e) {}
}

function connectToTikTok(uniqueId, sessionId = '', isReconnect = false) {
  clearReconnectTimer();
  releaseTikTokConnection();

  if (!isReconnect) {
    reconnectAttempts = 0;
  }
  autoReconnect = true;

  currentTiktokUser = uniqueId.trim().replace(/^@/, '');
  currentSessionId = (sessionId || '').trim();
  connectionStatus = 'connecting';
  io.emit('connection_status', { status: connectionStatus, user: currentTiktokUser });

  const connectionOptions = {
    processInitialData: false,
    enableExtendedGiftInfo: false,
    enableWebsocketUpgrade: true,
    requestPollingIntervalMs: 2000,
    requestHeaders: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    }
  };

  if (currentSessionId) {
    connectionOptions.sessionId = currentSessionId;
  }

  try {
    tiktokConnection = new WebcastPushConnection(currentTiktokUser, connectionOptions);
    const thisConnection = tiktokConnection;
    let hasConnected = false;

    tiktokConnection.on('error', err => {
      console.error('[TikTok Live Error]:', err?.info || '', err?.exception?.message || '');
    });

    tiktokConnection.connect().then(state => {
      if (tiktokConnection !== thisConnection) return;
      hasConnected = true;
      reconnectAttempts = 0;
      connectionStatus = 'connected';
      console.log(`[TikTok Live] Successfully connected to @${currentTiktokUser} (Room ID: ${state.roomId})`);
      io.emit('connection_status', { status: connectionStatus, user: currentTiktokUser, roomId: state.roomId });
    }).catch(err => {
      if (tiktokConnection !== thisConnection) return;
      connectionStatus = 'error';
      const errMessage = (err && err.message) || String(err);
      console.error('[TikTok Live Error]:', errMessage);

      let friendlyError = errMessage;
      if (errMessage.includes('The requested user isn\'t online') || errMessage.includes('not online')) {
        friendlyError = `Channel @${currentTiktokUser} is currently OFFLINE. Please start your TikTok Live stream first!`;
      } else if (errMessage.includes('Business plan') || errMessage.includes('eulerstream')) {
        friendlyError = `Channel @${currentTiktokUser} is offline or requires a sessionid cookie.`;
      }

      io.emit('connection_status', { status: connectionStatus, user: currentTiktokUser, error: friendlyError });

      if (isReconnect) {
        scheduleReconnect();
      } else {
        autoReconnect = false;
      }
    });

    // Chat message from viewer (Filtered for stream safety against TikTok strikes)
    tiktokConnection.on('chat', data => {
      const rawComment = (data.comment || data.content || data.text || data.message || '').toString();
      const commentText = sanitizeComment(rawComment);
      if (!commentText) {
        console.warn(`[TikTok Chat Blocked] Suppressed potentially toxic/scam comment from "${data.nickname || 'Viewer'}"`);
        return; // Drop completely! Never display or read toxic/scam chat on stream
      }

      const nickname = sanitizeNickname(data.nickname || data.user?.nickname || data.uniqueId || data.user?.uniqueId || 'Friend');
      const uniqueId = data.uniqueId || data.user?.uniqueId || data.userId || `user_${Date.now()}`;
      const avatar = data.profilePictureUrl || data.user?.profilePictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face';

      console.log(`[TikTok Chat] ${nickname}: "${commentText}"`);

      addFountainEnergy(2);
      recordUserWish(uniqueId, commentText, nickname);

      const chatData = {
        uniqueId: uniqueId,
        nickname: nickname,
        avatar: avatar,
        comment: commentText
      };
      io.emit('tiktok_chat', chatData);
    });

    // Gift from viewer
    tiktokConnection.on('gift', async data => {
      if (data.giftType === 1 && !data.repeatEnd) {
        return;
      }

      const diamondCount = (data.diamondCount || data.coins || 1) * (data.repeatCount || 1);
      const nickname = sanitizeNickname(data.nickname || data.user?.nickname || data.uniqueId || 'Kind Soul');
      const uniqueId = data.uniqueId || data.user?.uniqueId || data.userId || `user_${Date.now()}`;
      const avatar = data.profilePictureUrl || data.user?.profilePictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face';
      const giftName = sanitizeGiftName(data.giftName || data.gift?.name || 'Golden Offering');

      const giftData = {
        uniqueId: uniqueId,
        nickname: nickname,
        avatar: avatar,
        giftName: giftName,
        giftId: data.giftId,
        repeatCount: data.repeatCount || 1,
        coins: diamondCount
      };

      console.log(`[TikTok Gift] ${nickname} tossed ${giftName} (${diamondCount} coins)`);
      recordDonation(giftData, diamondCount);

      const userWish = getRecentUserWish(uniqueId, nickname);
      const blessing = generateBlessingText(giftData.nickname, `${giftData.giftName} x${giftData.repeatCount}`, diamondCount, userWish);
      let ttsResult = { url: null, gender: 'female' };
      if (appConfig.ttsEnabled) {
        try {
          ttsResult = await generateSpeechFile(blessing.spoken);
        } catch (e) {
          console.error('TTS error on gift:', e);
        }
      }

      io.emit('tiktok_gift', {
        ...giftData,
        bannerText: blessing.banner,
        spokenText: blessing.spoken,
        audioUrl: ttsResult.url,
        voiceGender: ttsResult.gender,
        fortune: blessing.fortune,
        wish: blessing.wish
      });
    });

    // Likes from viewer
    let accumulatedLikes = 0;
    tiktokConnection.on('like', async data => {
      accumulatedLikes += (data.likeCount || 1);
      addFountainEnergy(1);

      const nickname = sanitizeNickname(data.nickname || data.uniqueId || 'Friend');

      io.emit('tiktok_like', {
        uniqueId: data.uniqueId,
        nickname: nickname,
        avatar: data.profilePictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face',
        likeCount: data.likeCount || 1,
        totalLikes: accumulatedLikes
      });

      if (accumulatedLikes >= appConfig.minLikesForFlowers) {
        accumulatedLikes = 0;
        const blessing = generateBlessingText(nickname, '50 Hearts of Love', 0);
        let ttsResult = { url: null, gender: 'female' };
        if (appConfig.ttsEnabled) {
          try {
            ttsResult = await generateSpeechFile(blessing.spoken);
          } catch (e) {}
        }

        io.emit('offering_event', {
          type: 'flower_offering',
          nickname: nickname,
          avatar: data.profilePictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face',
          uniqueId: data.uniqueId,
          bannerText: blessing.banner,
          audioUrl: ttsResult.url,
          voiceGender: ttsResult.gender
        });
      }
    });

    // Share event
    tiktokConnection.on('share', data => {
      addFountainEnergy(5);
      const nickname = sanitizeNickname(data.nickname || data.uniqueId || 'Friend');
      io.emit('tiktok_share', {
        uniqueId: data.uniqueId,
        nickname: nickname,
        avatar: data.profilePictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face'
      });
    });

    // Follow event
    tiktokConnection.on('follow', data => {
      addFountainEnergy(5);
      const nickname = sanitizeNickname(data.nickname || data.uniqueId || 'Friend');
      io.emit('tiktok_follow', {
        uniqueId: data.uniqueId,
        nickname: nickname,
        avatar: data.profilePictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face'
      });
    });

    // Member joins live
    let lastJoinWelcomeTime = 0;
    tiktokConnection.on('member', async data => {
      const nickname = sanitizeNickname(data.nickname || data.user?.nickname || data.uniqueId || 'Friend');
      const uniqueId = data.uniqueId || data.user?.uniqueId || data.userId || `user_${Date.now()}`;
      const avatar = data.profilePictureUrl || data.user?.profilePictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face';

      console.log(`[TikTok Join] ${nickname} arrived at the Wishing Well`);
      const now = Date.now();
      const shouldSpeak = (now - lastJoinWelcomeTime) > 5000;
      if (shouldSpeak) {
        lastJoinWelcomeTime = now;
      }

      const welcome = generateWelcomeBlessing(nickname);
      let ttsResult = { url: null, gender: 'female' };
      if (shouldSpeak && appConfig.ttsEnabled) {
        try {
          ttsResult = await generateSpeechFile(welcome.spoken);
        } catch (e) {}
      }

      io.emit('tiktok_join', {
        uniqueId,
        nickname,
        avatar,
        bannerText: welcome.banner,
        spokenText: shouldSpeak ? welcome.spoken : null,
        audioUrl: ttsResult.url,
        voiceGender: ttsResult.gender
      });
    });

    tiktokConnection.on('streamEnd', () => {
      autoReconnect = false;
      clearReconnectTimer();
      connectionStatus = 'disconnected';
      io.emit('connection_status', { status: 'streamEnd', user: currentTiktokUser, error: 'Live stream ended.' });
    });

    tiktokConnection.on('disconnected', () => {
      connectionStatus = 'disconnected';
      io.emit('connection_status', { status: 'disconnected', user: currentTiktokUser });
      if (hasConnected) {
        scheduleReconnect();
      }
    });

  } catch (err) {
    connectionStatus = 'error';
    io.emit('connection_status', { status: connectionStatus, user: currentTiktokUser, error: err.message });
    if (isReconnect) {
      scheduleReconnect();
    } else {
      autoReconnect = false;
    }
  }
}

function disconnectTikTok() {
  autoReconnect = false;
  clearReconnectTimer();
  releaseTikTokConnection();
  connectionStatus = 'disconnected';
  io.emit('connection_status', { status: connectionStatus, user: currentTiktokUser });
}

// ==================== AUTO SIMULATION MODE ====================

const SAMPLE_NAMES = [
  'Alexander Miller', 'Sophia Green', 'Liam Walker', 'Olivia Smith',
  'Ethan Brown', 'Isabella Davis', 'Lucas Martinez', 'Mia Anderson',
  'Oliver White', 'Charlotte Hall', 'Henry Wilson', 'Amelia Taylor'
];

const SAMPLE_COMMENTS = [
  'Wishing for peace and radiant health for my family! ✨',
  'May my upcoming exam and interview go brilliantly! 🍀',
  'Sending love and positive vibrations to everyone! ❤️',
  'May this week bring unexpected miracles and joy! 🌟',
  'Tossing a coin for happiness and harmony! 🪙💫',
  'Make a wish, everyone! Beautiful energy here! 🌊',
  'Wishing for breakthroughs in my creative projects! 🚀',
  'Grateful for today and hopeful for tomorrow! 🌸'
];

function startSimulation() {
  if (isSimulating) return;
  isSimulating = true;
  io.emit('simulation_status', { active: true });

  simulationTimer = setInterval(() => {
    const rand = Math.random();
    const name = SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)];
    const id = `user_${name.toLowerCase().replace(/\s+/g, '_')}`;
    const avatar = `https://images.unsplash.com/photo-${1535713875000 + Math.floor(Math.random() * 500)}?w=100&h=100&fit=crop&crop=face`;

    if (rand < 0.6) {
      const comment = SAMPLE_COMMENTS[Math.floor(Math.random() * SAMPLE_COMMENTS.length)];
      addFountainEnergy(2);
      recordUserWish(id, comment, name);
      io.emit('tiktok_chat', { uniqueId: id, nickname: name, avatar, comment });
    } else if (rand < 0.8) {
      addFountainEnergy(1);
      io.emit('tiktok_like', { uniqueId: id, nickname: name, avatar, likeCount: 5, totalLikes: 25 });
    } else {
      const coins = Math.random() > 0.4 ? 10 : 5;
      const giftName = coins >= 10 ? 'Golden Crown' : 'Crystal Rose';
      const userWish = getRecentUserWish(id, name);
      const blessing = generateBlessingText(name, giftName, coins, userWish);

      recordDonation({ uniqueId: id, nickname: name, avatar }, coins);

      io.emit('tiktok_gift', {
        uniqueId: id,
        nickname: name,
        avatar: avatar,
        giftName: giftName,
        giftId: 100,
        repeatCount: 1,
        coins: coins,
        bannerText: blessing.banner,
        spokenText: blessing.spoken,
        audioUrl: null,
        fortune: blessing.fortune,
        wish: blessing.wish
      });
    }
  }, 4200);
}

function stopSimulation() {
  isSimulating = false;
  if (simulationTimer) {
    clearInterval(simulationTimer);
    simulationTimer = null;
  }
  io.emit('simulation_status', { active: false });
}

// ==================== REST APIS ====================

app.get('/api/fortunes', (req, res) => res.json(wishes));
app.get('/api/wishes', (req, res) => res.json(wishes));
app.get('/api/fortune/random', (req, res) => {
  res.json(wishes[Math.floor(Math.random() * wishes.length)]);
});
app.get('/api/wish/random', (req, res) => {
  res.json(wishes[Math.floor(Math.random() * wishes.length)]);
});

app.get('/api/leaderboard', (req, res) => res.json(leaderboard));

app.post('/api/leaderboard/reset', (req, res) => {
  leaderboard = [];
  io.emit('leaderboard_update', leaderboard);
  res.json({ success: true, leaderboard });
});

app.get('/api/config', (req, res) => {
  res.json({
    config: appConfig,
    tiktokUser: currentTiktokUser,
    connectionStatus: connectionStatus,
    isSimulating: isSimulating,
    energy: {
      current: fountainEnergy,
      max: fountainEnergyMax,
      percent: Math.min(100, Math.floor((fountainEnergy / fountainEnergyMax) * 100)),
      level: fountainLevel
    }
  });
});

app.post('/api/config', (req, res) => {
  appConfig = { ...appConfig, ...req.body };
  io.emit('config_update', appConfig);
  res.json({ success: true, config: appConfig });
});

// TTS generator endpoint
app.get('/api/tts', async (req, res) => {
  const text = req.query.text;
  if (!text) return res.status(400).send('Missing text parameter');
  const voice = req.query.voice || appConfig.ttsVoice;
  const rate = req.query.rate || appConfig.ttsRate;
  const lang = req.query.lang || appConfig.ttsLang || 'en';

  try {
    const ttsResult = await generateSpeechFile(text, voice, rate, lang);
    res.json({ success: true, audioUrl: ttsResult.url, gender: ttsResult.gender, voice: ttsResult.voice });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// TikTok Connect/Disconnect API
app.post('/api/tiktok/connect', (req, res) => {
  const { uniqueId, sessionId } = req.body;
  if (!uniqueId) return res.status(400).json({ error: 'Username is required' });
  connectToTikTok(uniqueId, sessionId);
  res.json({ success: true, message: `Connecting to @${uniqueId}` });
});

app.post('/api/tiktok/disconnect', (req, res) => {
  disconnectTikTok();
  res.json({ success: true, message: 'Disconnected' });
});

// Simulation API
app.post('/api/simulation/toggle', (req, res) => {
  if (isSimulating) {
    stopSimulation();
  } else {
    startSimulation();
  }
  res.json({ success: true, isSimulating });
});

// Test Simulation Events
app.post('/api/test/chat', (req, res) => {
  const nickname = sanitizeNickname(req.body.nickname || SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)]);
  const rawComment = req.body.comment || SAMPLE_COMMENTS[Math.floor(Math.random() * SAMPLE_COMMENTS.length)];
  const comment = sanitizeComment(rawComment);
  if (!comment) {
    return res.status(400).json({ success: false, error: 'Comment filtered by moderation badwords engine' });
  }

  addFountainEnergy(2);

  const uniqueId = req.body.uniqueId || `user_${nickname.toLowerCase().replace(/\s+/g, '_')}`;
  recordUserWish(uniqueId, comment, nickname);

  const chatData = {
    uniqueId: uniqueId,
    nickname: nickname,
    avatar: req.body.avatar || `https://images.unsplash.com/photo-${1535713875000 + Math.floor(Math.random() * 500)}?w=100&h=100&fit=crop&crop=face`,
    comment: comment
  };
  io.emit('tiktok_chat', chatData);
  res.json({ success: true, chatData });
});

app.post('/api/test/join', async (req, res) => {
  const nickname = sanitizeNickname(req.body.nickname || SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)]);
  const avatar = req.body.avatar || `https://images.unsplash.com/photo-${1535713875000 + Math.floor(Math.random() * 500)}?w=100&h=100&fit=crop&crop=face`;
  const uniqueId = req.body.uniqueId || `user_${nickname.toLowerCase().replace(/\s+/g, '_')}`;

  const welcome = generateWelcomeBlessing(nickname);
  let ttsResult = { url: null, gender: 'female' };
  if (appConfig.ttsEnabled) {
    try {
      ttsResult = await generateSpeechFile(welcome.spoken);
    } catch (e) {}
  }

  const payload = {
    uniqueId,
    nickname: welcome.safeNickname || nickname,
    avatar,
    bannerText: welcome.banner,
    spokenText: welcome.spoken,
    audioUrl: ttsResult.url,
    voiceGender: ttsResult.gender
  };

  io.emit('tiktok_join', payload);
  res.json({ success: true, payload });
});

app.post('/api/test/gift', async (req, res) => {
  const coins = parseInt(req.body.coins || 1, 10);
  const giftName = sanitizeGiftName(req.body.giftName || (coins >= 10 ? 'Golden Crown' : (coins >= 5 ? 'Crystal Rose' : 'Lucky Penny')));
  const nickname = sanitizeNickname(req.body.nickname || 'Alexander Miller');
  const avatar = req.body.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face';

  const giftData = {
    uniqueId: req.body.uniqueId || `user_${nickname.toLowerCase().replace(/\s+/g, '_')}`,
    nickname: nickname,
    avatar: avatar,
    giftName: giftName,
    giftId: req.body.giftId || 1001,
    repeatCount: req.body.repeatCount || 1,
    coins: coins
  };

  recordDonation(giftData, coins);

  const userWish = req.body.wish || getRecentUserWish(giftData.uniqueId, nickname);
  const blessing = generateBlessingText(nickname, `${giftName} x${giftData.repeatCount}`, coins, userWish);
  let ttsResult = { url: null, gender: 'female' };
  if (appConfig.ttsEnabled) {
    try {
      ttsResult = await generateSpeechFile(blessing.spoken);
    } catch (e) {
      console.error('Speech synthesis error in test:', e);
    }
  }

  const payload = {
    ...giftData,
    nickname: blessing.safeNickname || nickname,
    bannerText: blessing.banner,
    spokenText: blessing.spoken,
    audioUrl: ttsResult.url,
    voiceGender: ttsResult.gender,
    fortune: blessing.fortune,
    wish: blessing.wish
  };

  io.emit('tiktok_gift', payload);
  res.json({ success: true, payload });
});

// Test Golden Rush Event
app.post('/api/test/golden_rush', (req, res) => {
  const awakener = {
    nickname: (req.body && req.body.nickname) || 'Alexander Miller',
    avatar: (req.body && req.body.avatar) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face'
  };
  addFountainEnergy(1000, awakener);
  res.json({ success: true, message: 'Golden Rush triggered!' });
});

// Test Dethrone Top 1 Outbid Alert
app.post('/api/test/dethrone', (req, res) => {
  const newName = (req.body && req.body.nickname) || 'Lucas Martinez';
  const newAvatar = (req.body && req.body.avatar) || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face';
  const oldLeader = leaderboard[0] ? { ...leaderboard[0] } : { nickname: 'Alexander M.', score: 320 };
  const newScore = oldLeader.score + 50;

  const newLeaderUser = {
    uniqueId: `user_lucas_${Date.now()}`,
    nickname: newName,
    avatar: newAvatar
  };

  recordDonation(newLeaderUser, newScore);

  res.json({
    success: true,
    message: `Dethroned Top 1 with ${newScore} coins!`,
    newLeader: leaderboard[0],
    oldLeader: oldLeader
  });
});

// Test Mega Water Resonance Awakening
app.post('/api/test/awaken', (req, res) => {
  const awakener = {
    nickname: req.body.nickname || 'Alexander M.',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face'
  };
  addFountainEnergy(1000, awakener);
  res.json({ success: true, message: 'Fountain Awakening triggered!' });
});

app.post('/api/test/bow', (req, res) => {
  io.emit('trigger_all_bow', { duration: req.body.duration || 3200 });
  res.json({ success: true, message: 'Triggered fountain eruption' });
});

app.post('/api/test/fill-full', (req, res) => {
  io.emit('fill_all_seats');
  res.json({ success: true, message: 'Fountain surge celebrated' });
});

app.post('/api/test/flower', async (req, res) => {
  const nickname = req.body.nickname || 'Amelia Taylor';
  const blessing = generateBlessingText(nickname, '50 Hearts of Love', 0);
  let ttsResult = { url: null, gender: 'female' };
  if (appConfig.ttsEnabled) {
    try {
      ttsResult = await generateSpeechFile(blessing.spoken);
    } catch (e) {}
  }
  const payload = {
    type: 'flower_offering',
    nickname: nickname,
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face',
    uniqueId: 'amelia_taylor',
    bannerText: blessing.banner,
    audioUrl: ttsResult.url,
    voiceGender: ttsResult.gender
  };
  io.emit('offering_event', payload);
  res.json({ success: true, payload });
});

// Socket.IO Handling
io.on('connection', socket => {
  const percent = Math.min(100, Math.floor((fountainEnergy / fountainEnergyMax) * 100));

  socket.emit('init_state', {
    config: appConfig,
    leaderboard: leaderboard,
    fortunes: wishes,
    wishes: wishes,
    tiktokUser: currentTiktokUser,
    connectionStatus: connectionStatus,
    isSimulating: isSimulating,
    energy: {
      current: fountainEnergy,
      max: fountainEnergyMax,
      percent: percent,
      level: fountainLevel
    }
  });

  socket.on('trigger_bow', () => {
    io.emit('trigger_all_bow', { duration: 3200 });
  });

  socket.on('toggle_donation_cards', data => {
    io.emit('toggle_donation_cards', data);
  });

  socket.on('toggle_halo_fx', data => {
    io.emit('toggle_halo_fx', data);
  });

  socket.on('toggle_petals_fx', data => {
    io.emit('toggle_petals_fx', data);
  });

  socket.on('fill_all_seats', () => {
    io.emit('fill_all_seats');
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`✨ THE MAGIC WISHING WELL TIKTOK LIVE IS RUNNING AT:`);
  console.log(`📺 Live Overlay (OBS / Studio): http://localhost:${PORT}/index.html`);
  console.log(`🎛️  Admin Controller:             http://localhost:${PORT}/admin.html`);
  console.log(`====================================================`);
});
