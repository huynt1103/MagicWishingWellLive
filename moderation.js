/**
 * Stream Content Moderation & Badwords Filter for TikTok Live
 * Protects stream against TikTok automated OCR (visual) and ASR (audio/TTS) strikes.
 * Categories:
 * 1. Hate Speech & Racial/Identity Slurs (Instant Ban)
 * 2. Adult, Pornography & NSFW Terms
 * 3. Violence, Self-Harm & Harassment
 * 4. Severe Profanity & Vulgarity (English + Vietnamese)
 * 5. External Redirection, Scams & Financial Solicitation (Telegram, WhatsApp, Crypto, URLs)
 */

function stripAccents(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Normalized leetspeak replacements for stealth bypass attempts (e.g., f.u.c.k, b!tch, n1gg@)
function normalizeText(str) {
  if (!str || typeof str !== 'string') return '';
  return stripAccents(str)
    .replace(/[@4]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/[8]/g, 'b')
    .replace(/[v]/g, 'u')
    .replace(/[\s._\-*~+=^,()/:;"'`!?]+/g, ''); // Collapse spaces & separators: "f.u.c.k" -> "fuck"
}

// Critical Hard Banned Patterns (Checked against stripped & raw text)
const CRITICAL_BANNED_PATTERNS = [
  // Racial & Identity Slurs
  /\bn+i+g+g+[aeiouy]+\b/i,
  /\bn+i+g+g+e+r+\b/i,
  /\bn+1+g+g+[aeiouy]*\b/i,
  /\bc+h+i+n+k+\b/i,
  /\bg+o+o+k+\b/i,
  /\bk+i+k+e+\b/i,
  /\bs+p+i+c+\b/i,
  /\bf+a+g+(o+t+)?\b/i,
  /\bt+r+a+n+n+y+\b/i,
  /\br+e+t+a+r+d+(e+d+)?\b/i,

  // Hate, Extremism & Terrorism
  /\bn+a+z+i+\b/i,
  /\bh+i+t+l+e+r+\b/i,
  /\bs+w+a+s+t+i+k+a+\b/i,
  /\bt+e+r+r+o+r+i+s+t+\b/i,
  /\bj+i+h+a+d+\b/i,
  /\bi+s+i+s+\b/i,
  /\ba+l+q+a+e+d+a+\b/i,
  /\bk+k+k+\b/i,

  // Violence, Self-Harm & Suicide
  /\bk+y+s+\b/i,
  /k+i+l+l+\s+(yo)?u+r+s+e+l+f+/i,
  /\bs+u+i+c+i+d+e+\b/i,
  /h+a+n+g+\s+(yo)?u+r+s+e+l+f+/i,
  /s+l+i+t+\s+(yo)?u+r+\s+w+r+i+s+t+/i,
  /\bm+u+r+d+e+r+\b/i,
  /\bm+a+s+s+a+c+r+e+\b/i,
  /s+c+h+o+o+l+\s+s+h+o+o+t+/i,
  /\bb+o+m+b+(i+n+g+)?\b/i,
  /\bb+e+h+e+a+d+\b/i,
  /\br+a+p+e+\b/i,
  /\br+a+p+i+s+t+\b/i,
  /\bp+e+d+o+(p+h+i+l+e+)?\b/i,
  /c+h+i+l+d+\s+p+o+r+n+/i,

  // Adult, Pornography & NSFW Terms
  /\bp+o+r+n+(o|h+u+b+)?\b/i,
  /\bx+v+i+d+e+o+s+\b/i,
  /\bx+n+x+x+\b/i,
  /\bo+n+l+y+f+a+n+s+\b/i,
  /\bh+e+n+t+a+i+\b/i,
  /\bn+s+f+w+\b/i,
  /\bb+l+o+w+j+o+b+\b/i,
  /\bd+e+e+p+t+h+r+o+a+t+\b/i,
  /\bc+u+m+s+h+o+t+\b/i,
  /\bo+r+g+a+s+m+\b/i,
  /e+j+a+c+u+l+a+t+/i,
  /\bp+e+n+i+s+\b/i,
  /\bv+a+g+i+n+a+\b/i,
  /\bd+i+l+d+o+\b/i,
  /\bc+l+i+t+o+r+i+s+\b/i,
  /\bn+a+k+e+d+\b/i,
  /\bn+u+d+e+\b/i,
  /\bs+t+r+i+p+t+e+a+s+e+\b/i,
  /\be+s+c+o+r+t+\b/i,
  /\bh+o+o+k+e+r+\b/i,
  /\bx+x+x+\b/i,

  // Severe Profanity (English)
  /\bf+u+c+k+(e+r+|i+n+g+|e+d+|s+)?\b/i,
  /m+o+t+h+e+r+f+u+c+k+/i,
  /\bc+u+n+t+\b/i,
  /\bb+i+t+c+h+(e+s+)?\b/i,
  /\bd+i+c+k+(h+e+a+d+)?\b/i,
  /\bc+o+c+k+(s+u+c+k+e+r+)?\b/i,
  /\bp+u+s+s+y+\b/i,
  /\ba+s+s+h+o+l+e+\b/i,
  /\bb+a+s+t+a+r+d+\b/i,
  /\bs+l+u+t+\b/i,
  /\bw+h+o+r+e+\b/i,

  // Vietnamese Severe Toxic / Profanity
  /\b(d+u+|d+i+t+|d+m+|d+c+m+|c+l+m+m+|v+c+l+)\b/i,
  /\b(c+a+c+|l+o+n+|b+u+o+i+|d+e+o+)\b/i,
  /\b(c+h+o+\s*d+e+|c+o+n+\s*d+i+|s+u+c+\s*s+i+n+h+)\b/i,
  /\b(d+i+t+\s*m+e+|d+u+\s*m+a+|c+o+n+\s*c+a+c+)\b/i,

  // Illicit Drugs
  /\bc+o+c+a+i+n+e+\b/i,
  /\bh+e+r+o+i+n+\b/i,
  /\bm+e+t+h+\b/i,
  /\bf+e+n+t+a+n+y+l+\b/i,
  /\be+c+s+t+a+s+y+\b/i,

  // Scams & Platform Redirection
  /\bt+e+l+e+g+r+a+m+\b/i,
  /t+\.m+e+\//i,
  /\bw+h+a+t+s+a+p+p+\b/i,
  /w+a+\.m+e+\//i,
  /c+a+s+h+\s*a+p+p+/i,
  /\bv+e+n+m+o+\b/i,
  /\bp+a+y+p+a+l+\b/i,
  /\bz+e+l+l+e+\b/i,
  /\bc+r+y+p+t+o+\b/i,
  /\bb+i+t+c+o+i+n+\b/i,
  /\bu+s+d+t+\b/i,
  /\bb+i+n+a+n+c+e+\b/i,
  /f+r+e+e+\s+c+o+i+n+s+/i,
  /c+l+i+c+k+\s+l+i+n+k+/i,
  /f+o+l+l+o+w+\s+m+y+\s+(b+i+o+|p+a+g+e+|c+h+a+n+n+e+l+)/i,
  /d+m+\s+m+e+\s+f+o+r+/i,
  /c+h+e+c+k+\s+m+y+\s+b+i+o+/i,

  // URLs & Domains
  /https?:\/\/\S+/i,
  /\bwww\.\S+/i,
  /\b\S+\.(com|net|org|io|me|ly|gg|tv|co|vn|xyz|ru|cn|top|site|click)\b\S*/i,

  // Phone numbers (sequences of 7 or more digits)
  /\b\d{7,}\b/
];

const SEVERE_NORMALIZED_ROOTS = [
  'nigger', 'nigga', 'faggot', 'retard', 'hitler', 'swastika', 'pedophile',
  'childporn', 'fuck', 'cunt', 'bitch', 'cock', 'pussy', 'asshole', 'porn',
  'pornhub', 'onlyfans', 'telegram', 'whatsapp', 'cashapp', 'suicide', 'killurself',
  'ditme', 'duma', 'clmm', 'concac'
];

// Fallback safe names when a viewer's nickname contains bad words
const SAFE_NICKNAMES = [
  'Kind Soul',
  'Noble Guest',
  'Honoured Traveller',
  'Gentle Pilgrim',
  'Star Wanderer',
  'Faithful Friend'
];

/**
 * Checks if a string contains any critical banned patterns or leetspeak bypasses.
 */
function isToxic(rawText) {
  if (!rawText || typeof rawText !== 'string') return false;
  // Replace underscores and zero-width characters with spaces so word boundary \b works properly
  const text = rawText
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[_]+/g, ' ')
    .trim();

  if (!text) return false;

  // 1. Direct raw test
  for (const pattern of CRITICAL_BANNED_PATTERNS) {
    if (pattern.test(text)) return true;
  }

  // 2. Stripped accents & diacritics test (catches "địt mẹ", "lồn", "cặc", "bịt-ch", etc.)
  const stripped = stripAccents(text);
  for (const pattern of CRITICAL_BANNED_PATTERNS) {
    if (pattern.test(stripped)) return true;
  }

  // 3. De-obfuscated normalized test (catches "f.u.c.k", "b!tch", "n.i.g.g.a", etc.)
  const normalized = normalizeText(text);
  if (normalized.length >= 3) {
    for (const root of SEVERE_NORMALIZED_ROOTS) {
      if (normalized.includes(root)) return true;
    }
  }

  return false;
}

/**
 * Sanitizes a viewer nickname.
 * If the nickname contains bad words, replaces it with a respectful neutral name.
 * Limits length to 24 characters and removes dangerous HTML characters.
 */
function sanitizeNickname(rawNickname) {
  if (!rawNickname || typeof rawNickname !== 'string') {
    return 'Kind Soul';
  }

  let name = rawNickname
    .replace(/<[^>]*>/g, '') // Strip full HTML tags
    .replace(/[<>'"&]/g, '') // Strip residual brackets and quotes
    .replace(/\s+/g, ' ')
    .trim();

  if (name.length < 1 || isToxic(name)) {
    const randomFallback = SAFE_NICKNAMES[Math.floor(Math.random() * SAFE_NICKNAMES.length)];
    return randomFallback;
  }

  if (name.length > 24) {
    name = name.slice(0, 24).trim();
  }

  return name;
}

/**
 * Sanitizes a gift name.
 * If the gift name contains bad words or links, replaces with 'Golden Offering'.
 */
function sanitizeGiftName(rawGiftName) {
  if (!rawGiftName || typeof rawGiftName !== 'string') {
    return 'Golden Offering';
  }

  let gift = rawGiftName
    .replace(/<[^>]*>/g, '')
    .replace(/[<>'"&]/g, '')
    .trim();

  if (gift.length < 1 || isToxic(gift)) {
    return 'Golden Offering';
  }

  if (gift.length > 30) {
    gift = gift.slice(0, 30).trim();
  }

  return gift;
}

/**
 * Sanitizes a live chat comment before it appears as a floating speech bubble.
 * If comment is toxic, scam, or offensive, returns null (message will NOT be rendered).
 */
function sanitizeComment(rawComment) {
  if (!rawComment || typeof rawComment !== 'string') return null;
  const comment = rawComment
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (comment.length < 1 || comment.length > 100) return null;
  if (isToxic(comment)) return null;

  return comment;
}

/**
 * Sanitizes a custom wish before being displayed on scroll and read by TTS.
 * Must meet length requirements (3 - 80 chars) and contain no banned content.
 */
function sanitizeWish(rawWish) {
  if (!rawWish || typeof rawWish !== 'string') return null;
  if (/[<>]/.test(rawWish)) return null;

  let wish = rawWish
    .replace(/<[^>]*>/g, '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\bwww\.\S+/gi, ' ')
    .replace(/\b\S+\.(com|net|org|io|me|ly|gg|tv|co|vn|xyz|ru|cn)\b\S*/gi, ' ')
    .replace(/\d{6,}/g, ' ')
    .replace(/[^\p{L}\p{N}\s.,!?'’-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (wish.length < 3) return null;
  if (isToxic(wish)) return null;

  if (wish.length > 80) {
    const cut = wish.slice(0, 80);
    const lastSpace = cut.lastIndexOf(' ');
    wish = (lastSpace > 3 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,!?'’-]+$/, '');
  }

  return wish.length >= 3 ? wish : null;
}

module.exports = {
  isToxic,
  sanitizeNickname,
  sanitizeGiftName,
  sanitizeComment,
  sanitizeWish,
  normalizeText,
  stripAccents
};
