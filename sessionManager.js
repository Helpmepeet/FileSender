const crypto = require('crypto');

class SessionManager {
    constructor() {
        this.sessions = new Map();
        // The "Perfect 9": Distinct colors, shapes, and easy to name.
        this.emojis = [
            '🍎', // Red Apple
            '🍌', // Yellow Banana
            '🍇', // Purple Grapes
            '🥦', // Green Broccoli
            '🥕', // Orange Carrot
            '🐶', // Brown Dog
            '⚽', // Black/White Soccer Ball
            '🚀', // Rocket (Distinct Shape)
            '💧'  // Blue Water Drop
        ];
    }

    generateCode() {
        let code;
        do {
            code = Math.floor(100000 + Math.random() * 900000).toString();
        } while (this.sessions.has(code));
        return code;
    }

    generateEmoji() {
        return this.emojis[Math.floor(Math.random() * this.emojis.length)];
    }

    generateVerificationOptions(correctEmoji) {
        // Create a copy of emojis to pick decoys from
        const decoys = this.emojis.filter(e => e !== correctEmoji);
        // Shuffle decoys
        for (let i = decoys.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [decoys[i], decoys[j]] = [decoys[j], decoys[i]];
        }
        // Take 8 decoys
        const options = decoys.slice(0, 8);
        // Add correct emoji
        options.push(correctEmoji);
        // Shuffle options
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }
        return options;
    }

    createSession(file, preferredEmoji = null, securityEnabled = true) {
        const code = this.generateCode();
        // Use preferred emoji if valid (in our list), otherwise generate random
        const emoji = (preferredEmoji && this.emojis.includes(preferredEmoji))
            ? preferredEmoji
            : this.generateEmoji();

        const session = {
            code,
            emoji,
            file,
            securityEnabled,
            createdAt: Date.now(),
            status: 'waiting', // waiting, connected, transferring, completed
            senderSocketId: null,
            receiverSocketId: null
        };
        this.sessions.set(code, session);

        // Auto-cleanup after 5 minutes
        setTimeout(() => {
            if (this.sessions.has(code)) {
                console.log(`Session ${code} expired`);
                // In a real app, we might want to trigger file deletion here if not already deleted
                this.sessions.delete(code);
            }
        }, 5 * 60 * 1000);

        return session;
    }

    getSession(code) {
        return this.sessions.get(code);
    }

    removeSession(code) {
        this.sessions.delete(code);
    }
}

module.exports = new SessionManager();
