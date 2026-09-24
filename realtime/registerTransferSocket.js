const crypto = require('crypto');
const net = require('net');
const cleanupSession = require('../cleanupSession');
const { MAX_VERIFICATION_ATTEMPTS } = require('../config');

// Longer than a transfer's claim window, so reconnecting cannot reset guesses.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const sourceAttempts = new Map();
let nextRateCleanup = 0;

function sourceAddress(socket) {
    // Render terminates public traffic at Cloudflare; the socket peer is a proxy.
    const edgeAddress = socket.handshake.headers['cf-connecting-ip'];
    if (process.env.RENDER === 'true' && typeof edgeAddress === 'string' && net.isIP(edgeAddress)) {
        return edgeAddress;
    }
    return socket.handshake.address;
}

function allowAttempt(socket, kind, code, limit) {
    const now = Date.now();
    if (now >= nextRateCleanup) {
        for (const [key, bucket] of sourceAttempts) {
            if (bucket.until <= now) sourceAttempts.delete(key);
        }
        nextRateCleanup = now + RATE_WINDOW_MS;
    }
    const key = `${sourceAddress(socket)}:${kind}:${code}`;
    let bucket = sourceAttempts.get(key);
    if (!bucket || bucket.until <= now) {
        bucket = { count: 0, until: now + RATE_WINDOW_MS };
        sourceAttempts.set(key, bucket);
    }
    bucket.count += 1;
    return bucket.count <= limit;
}

function registerTransferSocket(io, sessionManager) {
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        socket.on('register-sender', ({ code, senderToken } = {}) => {
            const session = sessionManager.getSession(code);
            if (!session || senderToken !== session.senderToken) {
                return socket.emit('error', { message: 'Invalid sender registration' });
            }
            session.senderSocketId = socket.id;
            socket.join(code);
        });

        socket.on('join-receiver', (code) => {
            if (typeof code !== 'string' || !/^\d{4}$/.test(code) ||
                !allowAttempt(socket, 'join', '*', 30) || !allowAttempt(socket, 'join', code, 4)) {
                return socket.emit('error', { message: 'Invalid or unavailable code' });
            }
            const session = sessionManager.getSession(code);
            if (!session || session.status !== 'waiting') {
                return socket.emit('error', { message: 'Invalid or unavailable code' });
            }

            socket.data.pendingCode = code;
            socket.data.verificationAttempts = 0;
            socket.emit('verification-options', {
                options: sessionManager.generateVerificationOptions(session.emoji),
                type: session.type
            });
            if (session.senderSocketId) io.to(session.senderSocketId).emit('receiver-joined');
        });

        socket.on('verify-emoji', ({ code, emoji } = {}) => {
            if (typeof code !== 'string' || socket.data.pendingCode !== code) return;
            const session = sessionManager.getSession(code);
            if (!session || session.status !== 'waiting') {
                socket.data.pendingCode = null;
                return socket.emit('error', { message: 'Transfer unavailable' });
            }
            if (!allowAttempt(socket, 'verify', code, MAX_VERIFICATION_ATTEMPTS)) {
                socket.data.pendingCode = null;
                return socket.emit('error', { message: 'Too many attempts. Try again later.' });
            }

            if (emoji !== session.emoji) {
                socket.data.verificationAttempts += 1;
                if (socket.data.verificationAttempts >= MAX_VERIFICATION_ATTEMPTS) {
                    socket.data.pendingCode = null;
                    socket.emit('error', { message: 'Too many failed attempts. Try again later.' });
                } else {
                    socket.emit('verification-failed');
                }
                return;
            }

            socket.data.pendingCode = null;
            session.status = 'approved';
            session.receiverSocketId = socket.id;
            session.receiverToken = crypto.randomBytes(32).toString('base64url');
            session.redeemToken = crypto.randomBytes(32).toString('base64url');
            session.redeemExpiresAt = Date.now() + 30 * 1000;
            sessionManager.startReceiveLease(session);
            socket.join(code);
            socket.emit('transfer-approved', {
                type: session.type,
                receiverToken: session.receiverToken,
                redeemToken: session.redeemToken,
                expiresAt: session.expiresAt
            });
            socket.emit('verification-success');
            if (session.senderSocketId) io.to(session.senderSocketId).emit('verification-success', { expiresAt: session.expiresAt });
        });

        socket.on('complete-session', (code, acknowledge) => {
            const session = sessionManager.getSession(code);
            if (!session || session.status !== 'approved' || session.receiverSocketId !== socket.id) {
                if (typeof acknowledge === 'function') acknowledge({ finished: false, error: 'Transfer unavailable' });
                return;
            }
            if (session.senderSocketId) io.to(session.senderSocketId).emit('transfer-completed');
            cleanupSession(sessionManager, session);
            if (typeof acknowledge === 'function') acknowledge({ finished: true });
        });

        socket.on('disconnect', () => console.log('User disconnected:', socket.id));
    });
}

module.exports = registerTransferSocket;
