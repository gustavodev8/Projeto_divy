/* ========================================
   UTILITÁRIOS DE SENHA
   ======================================== */

const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

/**
 * Hash de uma senha
 */
async function hashPassword(password) {
    return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifica se uma senha corresponde ao hash
 */
async function comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

/**
 * Verifica se uma string é um hash bcrypt válido
 */
function isHashedPassword(str) {
    // Hash bcrypt começa com $2a$, $2b$ ou $2y$
    return str && (str.startsWith('$2a$') || str.startsWith('$2b$') || str.startsWith('$2y$'));
}

module.exports = {
    hashPassword,
    comparePassword,
    isHashedPassword,
    SALT_ROUNDS
};
