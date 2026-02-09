/* ========================================
   ROTAS DE CONFIGURAÇÃO PÚBLICA - API v1
   ======================================== */

const express = require('express');
const router = express.Router();
const { success } = require('../../utils/response');

// ===== GOOGLE CLIENT ID =====
router.get('/google-client-id', (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';

    return success(res, {
        clientId: clientId,
        configured: !!clientId
    }, 'Google Client ID');
});

module.exports = router;
