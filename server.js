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

const archiver = require('archiver');

// Configure Multer for file uploads
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit per file (approx)
});

app.use(express.static('public'));
app.use(express.json());

// Upload Endpoint
app.post('/upload', upload.array('files'), (req, res) => { // Changed to array
    const type = req.body.type || 'file'; // 'file' or 'text'
    const securityEnabled = req.body.securityEnabled === 'true';
    const emoji = req.body.emoji;

    let payload = null;

    if (type === 'file') {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        payload = req.files;
    } else if (type === 'text') {
        if (!req.body.text) {
            return res.status(400).json({ error: 'No text content provided' });
        }
        payload = req.body.text;
    } else {
        return res.status(400).json({ error: 'Invalid upload type' });
    }

    const session = sessionManager.createSession(type, payload, emoji, securityEnabled);
    res.json({ code: session.code, emoji: session.emoji, securityEnabled: session.securityEnabled, type: session.type });
});

// Metadata Endpoint
app.get('/session/:code/metadata', (req, res) => {
    const code = req.params.code;
    const session = sessionManager.getSession(code);

    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Only return safe metadata
    const metadata = {
        type: session.type,
        emoji: session.emoji,
        // Map files to be safe objects if they exist
        files: session.files ? session.files.map((f, i) => ({
            name: f.originalname,
            size: f.size,
            index: i
        })) : null,
        text: session.type === 'text' ? session.text : null
    };

    res.json(metadata);
});

// Download Endpoint
app.get('/download/:code', (req, res) => {
    const code = req.params.code;
    const session = sessionManager.getSession(code);

    const index = req.query.index; // Optional file index

    if (!session) {
        return res.status(404).send('Session not found or expired');
    }

    if (session.status !== 'approved') {
        return res.status(403).send('Transfer not approved');
    }

    if (session.type === 'text') {
        // For text, we might just return it as JSON or plain text. 
        // But the client expects a download usually. 
        // Let's return JSON and client handles display/copy.
        // Wait, the client download flow expects a file download currently.
        // We will update client to handle this.
        return res.json({ type: 'text', content: session.text });
    } else if (session.type === 'file') {
        const files = session.files;

        // Single file requested by index
        if (index !== undefined && index !== null) {
            const fileIndex = parseInt(index);
            if (fileIndex >= 0 && fileIndex < files.length) {
                const file = files[fileIndex];
                res.download(file.path, file.originalname, (err) => {
                    if (err) console.error('Download error:', err);
                    // Do NOT cleanup session here, as user might download other files
                });
                return;
            } else {
                return res.status(400).send('Invalid file index');
            }
        }

        if (files.length === 1) {
            // Single file - Direct Download
            const file = files[0];
            res.download(file.path, file.originalname, (err) => {
                if (err) console.error('Download error:', err);
                // Do NOT cleanup session here, as user might download other files
            });
        } else {
            // Multiple files - Zip
            res.attachment('files.zip');
            const archive = archiver('zip', {
                zlib: { level: 9 }
            });

            archive.on('error', (err) => {
                console.error('Archiver error:', err);
                res.status(500).send({ error: err.message });
            });

            archive.on('end', () => {
                cleanupSession(session);
            });

            archive.pipe(res);

            files.forEach(file => {
                archive.file(file.path, { name: file.originalname });
            });

            archive.finalize();
        }
    }
});

function cleanupSession(session) {
    sessionManager.removeSession(session.code);
    if (session.type === 'file' && session.files) {
        session.files.forEach(file => {
            fs.unlink(file.path, (unlinkErr) => {
                if (unlinkErr) console.error('Error deleting file:', unlinkErr);
            });
        });
    }
}

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
                socket.emit('verification-options', { options, type: session.type });
            } else {
                // Security disabled: Auto-approve immediately
                session.status = 'approved';
                io.to(session.receiverSocketId).emit('transfer-approved', { type: session.type });
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
                io.to(session.receiverSocketId).emit('transfer-approved', { type: session.type });

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
            io.to(session.receiverSocketId).emit('transfer-approved', { type: session.type });
            console.log(`Session ${code} approved`);
        }
    });

    socket.on('reject-transfer', (code) => {
        const session = sessionManager.getSession(code);
        if (session && session.senderSocketId === socket.id) {
            io.to(session.receiverSocketId).emit('transfer-rejected');
            sessionManager.removeSession(code);
            // Delete files
            if (session.type === 'file' && session.files) {
                session.files.forEach(file => {
                    fs.unlink(file.path, (unlinkErr) => {
                        if (unlinkErr) console.error('Error deleting file:', unlinkErr);
                    });
                });
            }
            console.log(`Session ${code} rejected`);
        }
    });

    socket.on('complete-session', (code) => {
        const session = sessionManager.getSession(code);
        if (session && session.receiverSocketId === socket.id) {
            // Notify sender of completion
            io.to(session.senderSocketId).emit('transfer-completed');

            // Clean up session data
            sessionManager.removeSession(code);
            // Delete files
            if (session.type === 'file' && session.files) {
                session.files.forEach(file => {
                    fs.unlink(file.path, (unlinkErr) => {
                        if (unlinkErr) console.error('Error deleting file:', unlinkErr);
                    });
                });
            }
            console.log(`Session ${code} completed and cleaned up`);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
