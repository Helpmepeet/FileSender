const crypto = require('crypto');
const {
    TRANSFER_TTL_MS,
    RECEIVE_TTL_MS,
    VERIFICATION_EMOJIS
} = require('./config');

class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.expiryTimers = new Map();
        this.emojis = VERIFICATION_EMOJIS;
        this.expirationHandler = null;
    }

    generateCode() {
        if (this.sessions.size >= 9000) throw new Error('No transfer codes available');
        for (let attempt = 0; attempt < 100; attempt += 1) {
            const code = crypto.randomInt(1000, 10000).toString();
            if (!this.sessions.has(code)) return code;
        }
        const start = crypto.randomInt(1000, 10000);
        for (let offset = 0; offset < 9000; offset += 1) {
            const code = (1000 + (start - 1000 + offset) % 9000).toString();
            if (!this.sessions.has(code)) return code;
        }
        throw new Error('No transfer codes available');
    }

    generateEmoji() {
        return this.emojis[crypto.randomInt(0, this.emojis.length)];
    }

    generateVerificationOptions(correctEmoji) {
        const options = this.emojis.filter((emoji) => emoji !== correctEmoji);
        shuffle(options);
        options.push(correctEmoji);
        return shuffle(options);
    }

    createSession(type, payload, preferredEmoji = null, securityEnabled = true) {
        const code = this.generateCode();
        const createdAt = Date.now();
        const emoji = preferredEmoji && this.emojis.includes(preferredEmoji)
            ? preferredEmoji
            : this.generateEmoji();
        const session = {
            code,
            emoji,
            type,
            [type === 'file' ? 'files' : 'text']: payload,
            securityEnabled,
            senderToken: crypto.randomBytes(32).toString('base64url'),
            receiverToken: null,
            redeemToken: null,
            createdAt,
            expiresAt: createdAt + TRANSFER_TTL_MS,
            status: 'waiting',
            senderSocketId: null,
            receiverSocketId: null
        };

        this.sessions.set(code, session);
        this.expiryTimers.set(code, setTimeout(() => this.expireSession(code), TRANSFER_TTL_MS));
        return session;
    }

    getSession(code) {
        return this.sessions.get(code);
    }

    startReceiveLease(session) {
        const timer = this.expiryTimers.get(session.code);
        if (timer) clearTimeout(timer);
        session.expiresAt = Date.now() + RECEIVE_TTL_MS;
        this.expiryTimers.set(session.code, setTimeout(() => this.expireSession(session.code), RECEIVE_TTL_MS));
        return session.expiresAt;
    }

    removeSession(code) {
        const session = this.sessions.get(code);
        const timer = this.expiryTimers.get(code);
        if (timer) clearTimeout(timer);
        this.expiryTimers.delete(code);
        this.sessions.delete(code);
        return session;
    }

    setExpirationHandler(handler) {
        this.expirationHandler = handler;
    }

    expireSession(code) {
        const session = this.removeSession(code);
        if (!session) return;

        console.log(`Session ${code} expired`);
        if (this.expirationHandler) this.expirationHandler(session);
    }
}

function shuffle(items) {
    for (let index = items.length - 1; index > 0; index -= 1) {
        const swapIndex = crypto.randomInt(0, index + 1);
        [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
    return items;
}

module.exports = new SessionManager();
