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
            code = Math.floor(1000 + Math.random() * 9000).toString();
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

    createSession(type, payload, preferredEmoji = null, securityEnabled = true) {
        const code = this.generateCode();
        // Use preferred emoji if valid (in our list), otherwise generate random
        const emoji = (preferredEmoji && this.emojis.includes(preferredEmoji))
            ? preferredEmoji
            : this.generateEmoji();

        const session = {
            code,
            emoji,
            type, // 'file' or 'text'
            [type === 'file' ? 'files' : 'text']: payload, // store payload based on type
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
                // Cleanup files if they exist
                if (session.type === 'file' && Array.isArray(session.files)) {
                    const fs = require('fs');
                    session.files.forEach(file => {
                        fs.unlink(file.path, (err) => {
                            if (err) console.error('Error auto-cleaning file:', err);
                        });
                    });
                }
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
