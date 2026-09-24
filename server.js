const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const sessionManager = require('./sessionManager');
const { MAX_TOTAL_UPLOAD_SIZE } = require('./config');
const { ensureUploadDir, uploadDir, deleteSessionFilesWhenIdle } = require('./fileStore');
const createTransferRoutes = require('./routes/transferRoutes');
const registerTransferSocket = require('./realtime/registerTransferSocket');

ensureUploadDir();

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const io = new Server(server);
const upload = multer({
    dest: uploadDir,
    limits: { fileSize: MAX_TOTAL_UPLOAD_SIZE, files: 100, fields: 4, parts: 104 }
});

sessionManager.setExpirationHandler(deleteSessionFilesWhenIdle);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.get('/health', (req, res) => res.status(200).send('ok'));
app.use(createTransferRoutes({ sessionManager, upload }));
registerTransferSocket(io, sessionManager);
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        return res.status(413).json({ error: 'Upload exceeds allowed limits' });
    }
    next(error);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
