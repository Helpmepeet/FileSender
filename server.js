const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sessionManager = require('./sessionManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Configure Multer for file uploads
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

app.use(express.static('public'));
app.use(express.json());

// Upload Endpoint
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const securityEnabled = req.body.securityEnabled === 'true';
    const session = sessionManager.createSession(req.file, req.body.emoji, securityEnabled);
    res.json({ code: session.code, emoji: session.emoji, securityEnabled: session.securityEnabled });
});

// Download Endpoint
app.get('/download/:code', (req, res) => {
    const code = req.params.code;
    const session = sessionManager.getSession(code);

    if (!session) {
        return res.status(404).send('Session not found or expired');
    }

    if (session.status !== 'approved') {
        return res.status(403).send('Transfer not approved');
    }

    const filePath = session.file.path;
    const originalName = session.file.originalname;

    res.download(filePath, originalName, (err) => {
        if (err) {
            console.error('Download error:', err);
        }

        // Cleanup after download
        sessionManager.removeSession(code);
        fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) console.error('Error deleting file:', unlinkErr);
        });
    });
});

// Socket.io Logic
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('register-sender', (code) => {
        const session = sessionManager.getSession(code);
        if (session) {
            session.senderSocketId = socket.id;
            socket.join(code);
            console.log(`Sender joined session ${code}`);
        }
    });

    socket.on('join-receiver', (code) => {
        const session = sessionManager.getSession(code);
        if (session) {
            session.receiverSocketId = socket.id;
            socket.join(code);
            session.status = 'connected';

            // Notify sender that receiver joined
            if (session.securityEnabled) {
                // Generate options
                const options = sessionManager.generateVerificationOptions(session.emoji);

                io.to(session.senderSocketId).emit('receiver-joined', {
                    emoji: session.emoji
                });

                // Send options to receiver
                socket.emit('verification-options', { options });
            } else {
                // Security disabled: Auto-approve immediately
                session.status = 'approved';
                io.to(session.receiverSocketId).emit('transfer-approved');
                io.to(session.senderSocketId).emit('verification-success'); // Reuse success event for sender
                console.log(`Session ${code} auto-approved (Security Disabled)`);
            }
            console.log(`Receiver joined session ${code} (Security: ${session.securityEnabled})`);
        } else {
            socket.emit('error', { message: 'Invalid code' });
        }
    });

    socket.on('verify-emoji', ({ code, emoji }) => {
        const session = sessionManager.getSession(code);
        if (session && session.receiverSocketId === socket.id) {
            if (emoji === session.emoji) {
                // Correct! Auto-approve
                session.status = 'approved';
                io.to(session.senderSocketId).emit('verification-success'); // Notify sender
                socket.emit('verification-success'); // Notify receiver (optional, can just send approved)

                // Trigger transfer immediately
                io.to(session.receiverSocketId).emit('transfer-approved');

                console.log(`Session ${code} verified and auto-approved`);
            } else {
                // Wrong!
                socket.emit('verification-failed');
                console.log(`Session ${code} failed verification`);
            }
        }
    });

    socket.on('approve-transfer', (code) => {
        const session = sessionManager.getSession(code);
        if (session && session.senderSocketId === socket.id) {
            session.status = 'approved';
            io.to(session.receiverSocketId).emit('transfer-approved');
            console.log(`Session ${code} approved`);
        }
    });

    socket.on('reject-transfer', (code) => {
        const session = sessionManager.getSession(code);
        if (session && session.senderSocketId === socket.id) {
            io.to(session.receiverSocketId).emit('transfer-rejected');
            sessionManager.removeSession(code);
            // Delete file
            fs.unlink(session.file.path, (unlinkErr) => {
                if (unlinkErr) console.error('Error deleting file:', unlinkErr);
            });
            console.log(`Session ${code} rejected`);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
