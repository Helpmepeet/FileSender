const TRANSFER_TTL_MS = 5 * 60 * 1000;
const RECEIVE_TTL_MS = 30 * 60 * 1000;
const MAX_TOTAL_UPLOAD_SIZE = 100 * 1024 * 1024;
const MAX_VERIFICATION_ATTEMPTS = 2;

const VERIFICATION_EMOJIS = [
    '🍎', '🍌', '🍇', '🥦', '🥕',
    '🐶', '⚽', '🚀', '💧'
];

module.exports = {
    TRANSFER_TTL_MS,
    RECEIVE_TTL_MS,
    MAX_TOTAL_UPLOAD_SIZE,
    MAX_VERIFICATION_ATTEMPTS,
    VERIFICATION_EMOJIS
};
