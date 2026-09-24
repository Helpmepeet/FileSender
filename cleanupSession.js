const { deleteSessionFilesWhenIdle } = require('./fileStore');

function cleanupSession(sessionManager, session) {
    if (!session) return;

    sessionManager.removeSession(session.code);
    deleteSessionFilesWhenIdle(session);
}

module.exports = cleanupSession;
