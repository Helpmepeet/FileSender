const express = require('express');
const archiver = require('archiver');
const crypto = require('crypto');
const { MAX_TOTAL_UPLOAD_SIZE } = require('../config');
const { deleteUploadedFiles, trackActiveDownload } = require('../fileStore');

function createTransferRoutes({ sessionManager, upload }) {
    const router = express.Router();

    router.post('/upload', upload.array('files'), (req, res) => {
        const type = req.body.type || 'file';
        // The short code is a locator, never sufficient proof to receive a transfer.
        const securityEnabled = true;
        const emoji = req.body.emoji;
        let payload;

        if (type === 'file') {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: 'No files uploaded' });
            }
            const totalUploadSize = req.files.reduce((sum, file) => sum + file.size, 0);
            if (totalUploadSize > MAX_TOTAL_UPLOAD_SIZE) {
                deleteUploadedFiles(req.files);
                return res.status(400).json({ error: 'Total size cannot exceed 100MB' });
            }
            payload = req.files;
        } else if (type === 'text') {
            if (req.files && req.files.length > 0) {
                deleteUploadedFiles(req.files);
                return res.status(400).json({ error: 'Text transfers cannot include files' });
            }
            if (!req.body.text) {
                deleteUploadedFiles(req.files);
                return res.status(400).json({ error: 'No text content provided' });
            }
            payload = req.body.text;
        } else {
            deleteUploadedFiles(req.files);
            return res.status(400).json({ error: 'Invalid upload type' });
        }

        let session;
        try {
            session = sessionManager.createSession(type, payload, emoji, securityEnabled);
        } catch (error) {
            deleteUploadedFiles(req.files);
            return res.status(503).json({ error: 'No transfer codes available. Try again later.' });
        }
        res.json({
            code: session.code,
            emoji: session.emoji,
            securityEnabled: session.securityEnabled,
            senderToken: session.senderToken,
            type: session.type,
            expiresAt: session.expiresAt
        });
    });

    router.post('/api/transfers/:code/redeem', (req, res) => {
        const session = sessionManager.getSession(req.params.code);
        if (!session || session.status !== 'approved') return res.status(404).json({ error: 'Transfer unavailable' });
        const token = req.body && req.body.redeemToken;
        if (!sameToken(token, session.redeemToken) || Date.now() > session.redeemExpiresAt) {
            return res.status(403).json({ error: 'Invalid approval' });
        }

        session.redeemToken = null;
        session.redeemExpiresAt = null;
        res.cookie(`fs_receiver_${session.code}`, session.receiverToken, {
            httpOnly: true,
            secure: process.env.RENDER === 'true' || req.secure,
            sameSite: 'strict',
            path: '/',
            maxAge: Math.max(0, session.expiresAt - Date.now())
        });
        res.json({ approved: true, expiresAt: session.expiresAt });
    });

    router.get('/session/:code/metadata', (req, res) => {
        const session = sessionManager.getSession(req.params.code);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        if (!hasReceiverAccess(req, session)) return res.status(403).json({ error: 'Transfer not approved' });

        res.json({
            type: session.type,
            expiresAt: session.expiresAt,
            files: session.files && session.files.map((file, index) => ({
                name: file.originalname,
                size: file.size,
                index
            })),
            text: session.type === 'text' ? session.text : null
        });
    });

    router.get('/download/:code', (req, res) => {
        const session = sessionManager.getSession(req.params.code);
        if (!session) return res.status(404).send('Session not found or expired');
        if (!hasReceiverAccess(req, session)) return res.status(403).send('Transfer not approved');
        if (session.type === 'text') return res.json({ type: 'text', content: session.text });

        const { files } = session;
        if (req.query.index !== undefined) {
            const fileIndex = Number.parseInt(req.query.index, 10);
            if (!Number.isInteger(fileIndex) || fileIndex < 0 || fileIndex >= files.length) {
                return res.status(400).send('Invalid file index');
            }
            trackActiveDownload(session, res);
            return res.download(files[fileIndex].path, files[fileIndex].originalname, (error) => handleDownloadError(error, res));
        }

        if (files.length === 1) {
            trackActiveDownload(session, res);
            return res.download(files[0].path, files[0].originalname, (error) => handleDownloadError(error, res));
        }

        trackActiveDownload(session, res);
        res.attachment('files.zip');
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('error', (error) => {
            console.error('Archiver error:', error);
            if (!res.headersSent) res.status(500).send({ error: error.message });
            else res.destroy(error);
        });
        archive.pipe(res);
        files.forEach((file) => archive.file(file.path, { name: file.originalname }));
        archive.finalize();
    });

    return router;
}

function sameToken(provided, expected) {
    if (typeof provided !== 'string' || typeof expected !== 'string') return false;
    const left = Buffer.from(provided);
    const right = Buffer.from(expected);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function hasReceiverAccess(req, session) {
    if (session.status !== 'approved' || !session.receiverToken) return false;
    const authorization = req.get('authorization') || '';
    const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
    const cookieName = `fs_receiver_${session.code}=`;
    const cookie = (req.headers.cookie || '').split(';').map((part) => part.trim())
        .find((part) => part.startsWith(cookieName));
    const cookieToken = cookie ? cookie.slice(cookieName.length) : null;
    return sameToken(bearer, session.receiverToken) || sameToken(cookieToken, session.receiverToken);
}

function handleDownloadError(error, res) {
    if (!error) return;
    console.error('Download error:', error);
    if (!res.headersSent) res.status(500).send('Download failed');
    else res.destroy(error);
}

module.exports = createTransferRoutes;
