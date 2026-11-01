const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const crypto = require('crypto');

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

// Feature #1: Water Resonance Energy (Subtle Natural Mega Surge)
let fountainEnergy = 740; // 0 to 1000
const fountainEnergyMax = 1000;
let fountainLevel = 5;

function addFountainEnergy(amount, user = null) {
  fountainEnergy += amount;
  if (fountainEnergy >= fountainEnergyMax) {
    fountainEnergy = 0;
    fountainLevel++;
    io.emit('fountain_awakened', {
      level: fountainLevel,
      awakener: user || { nickname: 'Kind Soul' }
    });
  }
  const percent = Math.min(100, Math.floor((fountainEnergy / fountainEnergyMax) * 100));
  io.emit('energy_update', {
    current: fountainEnergy,
    max: fountainEnergyMax,
    percent: percent,
    level: fountainLevel
  });
}

// App Configuration
let appConfig = {
  ttsEnabled: true,
  ttsVoice: 'en-US-JennyNeural',
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
  const prevLeader = leaderboard[0] ? { ...leaderboard[0] } : null;

  const existing = leaderboard.find(item => item.uniqueId === user.uniqueId);
  if (existing) {
    existing.score += coins;
    if (user.avatar) existing.avatar = user.avatar;
    if (user.nickname) existing.nickname = user.nickname;
  } else {
    leaderboard.push({
      uniqueId: user.uniqueId || `user_${Date.now()}`,
      nickname: user.nickname || 'Kind Soul',
      avatar: user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face',
      score: coins
    });
  }
  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard = leaderboard.slice(0, 20);
  io.emit('leaderboard_update', leaderboard);

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

// Generate speech file
function generateSpeechFile(text, voice = appConfig.ttsVoice, rate = appConfig.ttsRate, lang = appConfig.ttsLang || 'en') {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5').update(`${text}_${voice}_${rate}_${lang}`).digest('hex');
    const filename = `${hash}.mp3`;
    const outputPath = path.join(CACHE_DIR, filename);
    const publicUrl = `/audio_cache/${filename}`;

    if (fs.existsSync(outputPath)) {
      return resolve(publicUrl);
    }

    const scriptPath = path.join(__dirname, 'tts_service.py');
    execFile('python', [scriptPath, text, outputPath, '--voice', voice, '--rate', rate, '--lang', lang], (error, stdout, stderr) => {
      if (error) {
        console.error('TTS error:', stderr || error.message);
        return reject(error);
      }
      resolve(publicUrl);
    });
  });
}

// Recent user wishes cache: uniqueId / nickname -> { wish, timestamp }
const recentUserWishes = new Map();

function recordUserWish(userId, commentText, nickname) {
  if (!commentText) return;
  const now = Date.now();
  // Auto-prune wishes older than 2 minutes
  for (const [key, val] of recentUserWishes.entries()) {
    if (now - val.timestamp > 120000) {
      recentUserWishes.delete(key);
    }
  }
  const data = { wish: commentText, nickname, timestamp: now };
  if (userId) recentUserWishes.set(userId, data);
  if (nickname) recentUserWishes.set(nickname.toLowerCase(), data);
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
  let blessingText = '';
  let wishObj = null;

  if (customWish && customWish.trim()) {
    const cleanWish = customWish.trim();
    blessingText = `May your wish come true: "${cleanWish}"!`;
    wishObj = {
      title: `${nickname}'s Sacred Wish`,
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
    actionText = `cast a ${giftName || 'Grand Golden Offering'} into the sacred fountain!`;
  } else if (coins >= 5) {
    actionText = `tossed ${giftName || 'Treasured Coins'} into the magical waters.`;
  } else if (coins >= 1) {
    actionText = `cast a lucky coin into the Magic Wishing Well!`;
  } else {
    actionText = `showered the fountain with 50 hearts of love!`;
  }

  const wishPayload = {
    ...wishObj,
    donorNickname: nickname,
    donorGift: giftName || (coins >= 10 ? 'Golden Crown' : 'Crystal Rose')
  };

  const spoken = `Heartfelt gratitude to ${nickname} for tossing ${giftName || (coins + ' coins')} into the Wishing Well! ${blessingText}`;
  const banner = `${nickname} ${actionText} ${blessingText}`;

  return { banner, spoken, fortune: wishPayload, wish: wishPayload };
}

// Generate personalized welcome wish when viewer joins stream
const WELCOME_WISHES = [
  'May your heart be light, and may peace and prosperity follow your every step!',
  'Welcome to the magical waters! May your most cherished wishes find their way to reality.',
  'May good fortune, radiant health, and unexpected blessings brighten your days!',
  'Wishing you continuous abundance, boundless happiness, and peace of mind!',
  'May every door of opportunity open effortlessly for you on your journey!'
];

function generateWelcomeBlessing(nickname) {
  const template = WELCOME_WISHES[Math.floor(Math.random() * WELCOME_WISHES.length)];
  const banner = `Welcome ${nickname} to the Magic Wishing Well! ${template}`;
  const spoken = `Welcome ${nickname} to the Magic Wishing Well! ${template}`;
  return { banner, spoken, blessing: template };
}

// ==================== TIKTOK LIVE CONNECTION ====================

function connectToTikTok(uniqueId, sessionId = '') {
  if (tiktokConnection) {
    try {
      tiktokConnection.disconnect();
    } catch (e) {}
    tiktokConnection = null;
  }

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

    tiktokConnection.connect().then(state => {
      connectionStatus = 'connected';
      console.log(`[TikTok Live] Successfully connected to @${currentTiktokUser} (Room ID: ${state.roomId})`);
      io.emit('connection_status', { status: connectionStatus, user: currentTiktokUser, roomId: state.roomId });
    }).catch(err => {
      connectionStatus = 'error';
      console.error('[TikTok Live Error]:', err.message);

      let friendlyError = err.message;
      if (err.message.includes('The requested user isn\'t online') || err.message.includes('not online')) {
        friendlyError = `Channel @${currentTiktokUser} is currently OFFLINE. Please start your TikTok Live stream first!`;
      } else if (err.message.includes('Business plan') || err.message.includes('eulerstream')) {
        friendlyError = `Channel @${currentTiktokUser} is offline or requires a sessionid cookie.`;
      }

      io.emit('connection_status', { status: connectionStatus, user: currentTiktokUser, error: friendlyError });
    });

    // Chat message from viewer
    tiktokConnection.on('chat', data => {
      const commentText = (data.comment || data.content || data.text || data.message || '').toString().trim();
      const nickname = data.nickname || data.user?.nickname || data.uniqueId || data.user?.uniqueId || 'Friend';
      const uniqueId = data.uniqueId || data.user?.uniqueId || data.userId || `user_${Date.now()}`;
      const avatar = data.profilePictureUrl || data.user?.profilePictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face';

      console.log(`[TikTok Chat] ${nickname}: "${commentText}"`);
      if (!commentText || commentText === 'undefined') return;

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
      const nickname = data.nickname || data.user?.nickname || data.uniqueId || 'Kind Soul';
      const uniqueId = data.uniqueId || data.user?.uniqueId || data.userId || `user_${Date.now()}`;
      const avatar = data.profilePictureUrl || data.user?.profilePictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face';
      const giftName = data.giftName || data.gift?.name || 'Golden Offering';

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
      let audioUrl = null;
      if (appConfig.ttsEnabled) {
        try {
          audioUrl = await generateSpeechFile(blessing.spoken);
        } catch (e) {
          console.error('TTS error on gift:', e);
        }
      }

      io.emit('tiktok_gift', {
        ...giftData,
        bannerText: blessing.banner,
        spokenText: blessing.spoken,
        audioUrl: audioUrl,
        fortune: blessing.fortune,
        wish: blessing.wish
      });
    });

    // Likes from viewer
    let accumulatedLikes = 0;
    tiktokConnection.on('like', async data => {
      accumulatedLikes += (data.likeCount || 1);
      addFountainEnergy(1);

      io.emit('tiktok_like', {
        uniqueId: data.uniqueId,
        nickname: data.nickname || data.uniqueId,
        avatar: data.profilePictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face',
        likeCount: data.likeCount || 1,
        totalLikes: accumulatedLikes
      });

      if (accumulatedLikes >= appConfig.minLikesForFlowers) {
        accumulatedLikes = 0;
        const blessing = generateBlessingText(data.nickname || data.uniqueId, '50 Hearts of Love', 0);
        let audioUrl = null;
        if (appConfig.ttsEnabled) {
          try {
            audioUrl = await generateSpeechFile(blessing.spoken);
          } catch (e) {}
        }

        io.emit('offering_event', {
          type: 'flower_offering',
          nickname: data.nickname || data.uniqueId,
          avatar: data.profilePictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face',
          uniqueId: data.uniqueId,
          bannerText: blessing.banner,
          audioUrl: audioUrl
        });
      }
    });

    // Share event
    tiktokConnection.on('share', data => {
      addFountainEnergy(5);
      io.emit('tiktok_share', {
        uniqueId: data.uniqueId,
        nickname: data.nickname || data.uniqueId,
        avatar: data.profilePictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face'
      });
    });

    // Follow event
    tiktokConnection.on('follow', data => {
      addFountainEnergy(5);
      io.emit('tiktok_follow', {
        uniqueId: data.uniqueId,
        nickname: data.nickname || data.uniqueId,
        avatar: data.profilePictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face'
      });
    });

    // Member joins live
    let lastJoinWelcomeTime = 0;
    tiktokConnection.on('member', async data => {
      const nickname = data.nickname || data.user?.nickname || data.uniqueId || 'Friend';
      const uniqueId = data.uniqueId || data.user?.uniqueId || data.userId || `user_${Date.now()}`;
      const avatar = data.profilePictureUrl || data.user?.profilePictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face';

      console.log(`[TikTok Join] ${nickname} arrived at the Wishing Well`);
      const now = Date.now();
      const shouldSpeak = (now - lastJoinWelcomeTime) > 5000;
      if (shouldSpeak) {
        lastJoinWelcomeTime = now;
      }

      const welcome = generateWelcomeBlessing(nickname);
      let audioUrl = null;
      if (shouldSpeak && appConfig.ttsEnabled) {
        try {
          audioUrl = await generateSpeechFile(welcome.spoken);
        } catch (e) {}
      }

      io.emit('tiktok_join', {
        uniqueId,
        nickname,
        avatar,
        bannerText: welcome.banner,
        spokenText: shouldSpeak ? welcome.spoken : null,
        audioUrl: audioUrl
      });
    });

    tiktokConnection.on('streamEnd', () => {
      connectionStatus = 'disconnected';
      io.emit('connection_status', { status: 'streamEnd', user: currentTiktokUser, error: 'Live stream ended.' });
    });

    tiktokConnection.on('disconnected', () => {
      connectionStatus = 'disconnected';
      io.emit('connection_status', { status: 'disconnected', user: currentTiktokUser });
    });

  } catch (err) {
    connectionStatus = 'error';
    io.emit('connection_status', { status: connectionStatus, user: currentTiktokUser, error: err.message });
  }
}

function disconnectTikTok() {
  if (tiktokConnection) {
    try {
      tiktokConnection.disconnect();
    } catch (e) {}
    tiktokConnection = null;
  }
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
    const audioUrl = await generateSpeechFile(text, voice, rate, lang);
    res.json({ success: true, audioUrl });
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
  const nickname = req.body.nickname || SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)];
  const comment = req.body.comment || SAMPLE_COMMENTS[Math.floor(Math.random() * SAMPLE_COMMENTS.length)];
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
  const nickname = req.body.nickname || SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)];
  const avatar = req.body.avatar || `https://images.unsplash.com/photo-${1535713875000 + Math.floor(Math.random() * 500)}?w=100&h=100&fit=crop&crop=face`;
  const uniqueId = req.body.uniqueId || `user_${nickname.toLowerCase().replace(/\s+/g, '_')}`;

  const welcome = generateWelcomeBlessing(nickname);
  let audioUrl = null;
  if (appConfig.ttsEnabled) {
    try {
      audioUrl = await generateSpeechFile(welcome.spoken);
    } catch (e) {}
  }

  const payload = {
    uniqueId,
    nickname,
    avatar,
    bannerText: welcome.banner,
    spokenText: welcome.spoken,
    audioUrl
  };

  io.emit('tiktok_join', payload);
  res.json({ success: true, payload });
});

app.post('/api/test/gift', async (req, res) => {
  const coins = parseInt(req.body.coins || 1, 10);
  const giftName = req.body.giftName || (coins >= 10 ? 'Golden Crown' : (coins >= 5 ? 'Crystal Rose' : 'Lucky Penny'));
  const nickname = req.body.nickname || 'Alexander Miller';
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
  let audioUrl = null;
  if (appConfig.ttsEnabled) {
    try {
      audioUrl = await generateSpeechFile(blessing.spoken);
    } catch (e) {
      console.error('Speech synthesis error in test:', e);
    }
  }

  const payload = {
    ...giftData,
    bannerText: blessing.banner,
    spokenText: blessing.spoken,
    audioUrl: audioUrl,
    fortune: blessing.fortune,
    wish: blessing.wish
  };

  io.emit('tiktok_gift', payload);
  res.json({ success: true, payload });
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
  let audioUrl = null;
  if (appConfig.ttsEnabled) {
    try {
      audioUrl = await generateSpeechFile(blessing.spoken);
    } catch (e) {}
  }
  const payload = {
    type: 'flower_offering',
    nickname: nickname,
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face',
    uniqueId: 'amelia_taylor',
    bannerText: blessing.banner,
    audioUrl: audioUrl
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
