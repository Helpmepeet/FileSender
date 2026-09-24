const fs = require('fs');
const path = require('path');

const uploadDir = path.join(__dirname, 'uploads');

function ensureUploadDir() {
    fs.mkdirSync(uploadDir, { recursive: true });
}

function deleteUploadedFiles(files) {
    if (!Array.isArray(files)) return;

    files.forEach((file) => {
        fs.unlink(file.path, (error) => {
            if (error && error.code !== 'ENOENT') {
                console.error('Error deleting file:', error);
            }
        });
    });
}

function deleteSessionFilesWhenIdle(session) {
    if (!session || session.type !== 'file' || session.filesDeleted) return;
    if (session.activeDownloads > 0) {
        session.deleteWhenIdle = true;
        return;
    }
    session.filesDeleted = true;
    deleteUploadedFiles(session.files);
}

function trackActiveDownload(session, response) {
    session.activeDownloads = (session.activeDownloads || 0) + 1;
    const drainDeadlineMs = Math.max(0, session.expiresAt - Date.now()) + 2 * 60 * 1000;
    const timeout = setTimeout(() => response.destroy(), drainDeadlineMs);
    let released = false;
    const release = () => {
        if (released) return;
        released = true;
        clearTimeout(timeout);
        session.activeDownloads -= 1;
        if (session.deleteWhenIdle) deleteSessionFilesWhenIdle(session);
    };
    response.once('finish', release);
    response.once('close', release);
}

module.exports = { ensureUploadDir, deleteUploadedFiles, deleteSessionFilesWhenIdle, trackActiveDownload, uploadDir };
