/**
 * Groq API Key Rotation Service
 * Automatically rotates between 8 Groq API keys when rate limits are hit
 * Features: Round-robin rotation, health tracking, cooldown management, persistence
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to store rotation state
const STATE_FILE = path.join(__dirname, "../data/keyRotationState.json");

// Configuration
const CONFIG = {
  COOLDOWN_PERIOD: 60 * 60 * 1000, // 1 hour cooldown when key is exhausted
  MAX_ERRORS_BEFORE_SKIP: 3, // Skip key after 3 consecutive errors
  RATE_LIMIT_KEYWORDS: [
    "rate_limit_exceeded",
    "rate limit",
    "too many requests",
    "quota exceeded",
    "429",
  ],
};

class GroqKeyRotation {
  constructor() {
    this.keys = [];
    this.currentIndex = 0;
    this.keyStats = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the rotation system (called lazily on first use)
   */
  initialize() {
    if (this.initialized) return;
    
    this.loadKeys();
    this.loadState();
    this.initialized = true;
  }

  /**
   * Load API keys from environment variable
   */
  loadKeys() {
    const keysString = process.env.GROQ_API_KEYS;
    
    if (!keysString) {
      throw new Error("GROQ_API_KEYS not found in environment variables");
    }

    this.keys = keysString
      .split(",")
      .map(k => k.trim())
      .filter(k => k.startsWith("gsk_"));

    if (this.keys.length === 0) {
      throw new Error("No valid Groq API keys found in GROQ_API_KEYS");
    }

    console.log(`✅ Loaded ${this.keys.length} Groq API keys for rotation`);

    // Initialize stats for each key
    this.keys.forEach((key, index) => {
      if (!this.keyStats.has(index)) {
        this.keyStats.set(index, {
          keyIndex: index,
          keyPreview: this.maskKey(key),
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          rateLimitHits: 0,
          lastUsed: null,
          lastError: null,
          isExhausted: false,
          exhaustedAt: null,
          consecutiveErrors: 0,
          status: "active", // active, exhausted, error, cooldown
        });
      }
    });
  }

  /**
   * Load rotation state from disk
   */
  loadState() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(STATE_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      if (fs.existsSync(STATE_FILE)) {
        const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
        this.currentIndex = data.currentIndex || 0;
        
        // Restore key stats
        if (data.keyStats && Array.isArray(data.keyStats)) {
          data.keyStats.forEach(stat => {
            if (stat.keyIndex < this.keys.length) {
              this.keyStats.set(stat.keyIndex, stat);
            }
          });
        }
        
        console.log(`📊 Loaded rotation state: Current key index ${this.currentIndex}`);
      }
    } catch (err) {
      console.warn("⚠️ Could not load rotation state, starting fresh:", err.message);
    }
  }

  /**
   * Save rotation state to disk
   */
  saveState() {
    try {
      const data = {
        currentIndex: this.currentIndex,
        keyStats: Array.from(this.keyStats.values()),
        lastUpdated: new Date().toISOString(),
      };
      
      fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("❌ Failed to save rotation state:", err.message);
    }
  }

  /**
   * Mask API key for logging (show first 8 and last 4 chars)
   */
  maskKey(key) {
    if (!key || key.length < 12) return "***";
    return `${key.slice(0, 8)}...${key.slice(-4)}`;
  }

  /**
   * Get current active API key
   */
  getCurrentKey() {
    // Initialize on first use (after dotenv has loaded)
    if (!this.initialized) {
      this.initialize();
    }
    
    if (this.keys.length === 0) {
      throw new Error("Key rotation not initialized");
    }

    // Check if current key is on cooldown
    const currentStats = this.keyStats.get(this.currentIndex);
    if (this.isKeyCoolingDown(currentStats)) {
      console.log(`⏳ Key ${this.currentIndex} is cooling down, rotating...`);
      this.rotateToNextKey();
    }

    const key = this.keys[this.currentIndex];
    console.log(`🔑 Using Groq key ${this.currentIndex + 1}/${this.keys.length}: ${this.maskKey(key)}`);
    
    return key;
  }

  /**
   * Check if a key is on cooldown
   */
  isKeyCoolingDown(stats) {
    if (!stats.isExhausted || !stats.exhaustedAt) return false;
    
    const cooldownEnd = new Date(stats.exhaustedAt).getTime() + CONFIG.COOLDOWN_PERIOD;
    const now = Date.now();
    
    if (now >= cooldownEnd) {
      // Cooldown period over, reset the key
      stats.isExhausted = false;
      stats.exhaustedAt = null;
      stats.consecutiveErrors = 0;
      stats.status = "active";
      console.log(`✅ Key ${stats.keyIndex} cooldown period ended, marking as active`);
      this.saveState();
      return false;
    }
    
    return true;
  }

  /**
   * Rotate to the next available key
   */
  rotateToNextKey() {
    const startIndex = this.currentIndex;
    let attempts = 0;
    
    while (attempts < this.keys.length) {
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
      const stats = this.keyStats.get(this.currentIndex);
      
      // Check if this key is available
      if (!this.isKeyCoolingDown(stats) && stats.consecutiveErrors < CONFIG.MAX_ERRORS_BEFORE_SKIP) {
        console.log(`🔄 Rotated from key ${startIndex + 1} to key ${this.currentIndex + 1}`);
        this.saveState();
        return;
      }
      
      attempts++;
    }
    
    // All keys are exhausted or in cooldown
    console.warn("⚠️ All API keys are exhausted or in cooldown! Using current key anyway...");
    this.currentIndex = startIndex;
  }

  /**
   * Record a successful request
   */
  recordSuccess(keyIndex = this.currentIndex) {
    const stats = this.keyStats.get(keyIndex);
    if (stats) {
      stats.totalRequests++;
      stats.successfulRequests++;
      stats.lastUsed = new Date().toISOString();
      stats.consecutiveErrors = 0;
      stats.status = "active";
      this.saveState();
    }
  }

  /**
   * Record a failed request and handle rotation
   */
  recordFailure(error, keyIndex = this.currentIndex) {
    const stats = this.keyStats.get(keyIndex);
    if (!stats) return;

    stats.totalRequests++;
    stats.failedRequests++;
    stats.lastError = {
      message: error.message || String(error),
      timestamp: new Date().toISOString(),
    };
    stats.consecutiveErrors++;

    // Check if it's a rate limit error
    const isRateLimit = this.isRateLimitError(error);
    
    if (isRateLimit) {
      stats.rateLimitHits++;
      stats.isExhausted = true;
      stats.exhaustedAt = new Date().toISOString();
      stats.status = "exhausted";
      
      console.warn(`🚫 Rate limit hit on key ${keyIndex + 1}. Rotating to next key...`);
      this.rotateToNextKey();
    } else if (stats.consecutiveErrors >= CONFIG.MAX_ERRORS_BEFORE_SKIP) {
      stats.status = "error";
      console.warn(`❌ Key ${keyIndex + 1} has ${stats.consecutiveErrors} consecutive errors. Rotating...`);
      this.rotateToNextKey();
    } else {
      stats.status = "error";
    }

    this.saveState();
    return isRateLimit;
  }

  /**
   * Check if error is related to rate limiting
   */
  isRateLimitError(error) {
    const errorString = (error.message || String(error)).toLowerCase();
    return CONFIG.RATE_LIMIT_KEYWORDS.some(keyword => 
      errorString.includes(keyword.toLowerCase())
    );
  }

  /**
   * Get statistics for all keys
   */
  getStats() {
    // Initialize on first use
    if (!this.initialized) {
      this.initialize();
    }
    
    const stats = Array.from(this.keyStats.values()).map(stat => ({
      ...stat,
      isCurrent: stat.keyIndex === this.currentIndex,
      cooldownRemaining: this.getCooldownRemaining(stat),
    }));

    return {
      totalKeys: this.keys.length,
      currentKeyIndex: this.currentIndex,
      stats,
      summary: this.getSummary(stats),
    };
  }

  /**
   * Get remaining cooldown time in milliseconds
   */
  getCooldownRemaining(stats) {
    if (!stats.isExhausted || !stats.exhaustedAt) return 0;
    
    const cooldownEnd = new Date(stats.exhaustedAt).getTime() + CONFIG.COOLDOWN_PERIOD;
    const remaining = cooldownEnd - Date.now();
    
    return Math.max(0, remaining);
  }

  /**
   * Get summary statistics
   */
  getSummary(stats) {
    return {
      activeKeys: stats.filter(s => s.status === "active").length,
      exhaustedKeys: stats.filter(s => s.status === "exhausted").length,
      errorKeys: stats.filter(s => s.status === "error").length,
      totalRequests: stats.reduce((sum, s) => sum + s.totalRequests, 0),
      totalSuccesses: stats.reduce((sum, s) => sum + s.successfulRequests, 0),
      totalFailures: stats.reduce((sum, s) => sum + s.failedRequests, 0),
      totalRateLimitHits: stats.reduce((sum, s) => sum + s.rateLimitHits, 0),
    };
  }

  /**
   * Reset a specific key (remove from cooldown/error state)
   */
  resetKey(keyIndex) {
    const stats = this.keyStats.get(keyIndex);
    if (stats) {
      stats.isExhausted = false;
      stats.exhaustedAt = null;
      stats.consecutiveErrors = 0;
      stats.status = "active";
      stats.lastError = null;
      this.saveState();
      console.log(`🔄 Reset key ${keyIndex + 1} to active state`);
      return true;
    }
    return false;
  }

  /**
   * Reset all keys
   */
  resetAllKeys() {
    this.keyStats.forEach(stats => {
      stats.isExhausted = false;
      stats.exhaustedAt = null;
      stats.consecutiveErrors = 0;
      stats.status = "active";
      stats.lastError = null;
    });
    this.saveState();
    console.log("🔄 Reset all keys to active state");
  }

  /**
   * Manually set the current key index
   */
  setCurrentKey(keyIndex) {
    if (keyIndex >= 0 && keyIndex < this.keys.length) {
      this.currentIndex = keyIndex;
      this.saveState();
      console.log(`🔑 Manually set current key to ${keyIndex + 1}`);
      return true;
    }
    return false;
  }
}

// Create singleton instance
const keyRotation = new GroqKeyRotation();

export default keyRotation;
