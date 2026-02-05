/* ========================================
   SISTEMA DE RECUPERAÇÃO DE SENHA - NURA
   ======================================== */

const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin;

// Estado
let pendingEmail = '';
let resendTimerInterval = null;
let resendCountdown = 60;

// ===== NAVEGAÇÃO ENTRE ETAPAS =====
function goToStep(step) {
    // Esconder todas as etapas
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));

    // Mostrar etapa desejada
    const stepElement = document.getElementById(`step-${step}`);
    if (stepElement) {
        stepElement.classList.add('active');
    }

    // Ações específicas por etapa
    if (step === 'code') {
        // Focar no primeiro input
        setTimeout(() => {
            const firstInput = document.querySelector('.code-input[data-index="0"]');
            if (firstInput) firstInput.focus();
        }, 300);

        // Iniciar timer
        startResendTimer();
    } else if (step === 'password') {
        // Focar no campo de senha
        setTimeout(() => {
            const passwordInput = document.getElementById('inova-senha');
            if (passwordInput) passwordInput.focus();
        }, 300);
    } else if (step === 'email') {
        // Parar timer se existir
        stopResendTimer();
        // Limpar código
        clearCodeInputs();
    }
}

// ===== ETAPA 1: ENVIAR EMAIL =====
async function sendResetCode(event) {
    if (event) event.preventDefault();

    const email = document.getElementById('iemail').value.trim();
    const submitButton = document.getElementById('ienviar');
    const messageContainer = document.getElementById('message-container');

    // Validações
    if (!email) {
        showMessage('Por favor, digite seu e-mail', 'error');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showMessage('Por favor, insira um e-mail válido', 'error');
        return;
    }

    // Desabilitar botão
    submitButton.disabled = true;
    const originalValue = submitButton.value;
    submitButton.value = 'Enviando...';

    try {
        console.log('📧 Enviando código de recuperação...');

        const response = await fetch(`${API_URL}/v1/auth/forgot-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email })
        });

        const data = await response.json();
        console.log('📬 Resposta forgot-password:', data);

        if (response.ok && data.success) {
            console.log('✅ Código enviado!');
            pendingEmail = email;

            // Mostrar email na etapa 2
            document.getElementById('email-display').textContent = email;

            // Ir para etapa de código
            goToStep('code');
        } else {
            showMessage(data.error || 'Erro ao enviar código', 'error');
        }

        submitButton.disabled = false;
        submitButton.value = originalValue;

    } catch (error) {
        console.error('💥 Erro de conexão:', error);
        showMessage('Erro de conexão com o servidor', 'error');
        submitButton.disabled = false;
        submitButton.value = originalValue;
    }
}

// ===== ETAPA 2: VERIFICAR CÓDIGO =====
async function verifyCode() {
    const code = getCodeFromInputs();

    if (code.length !== 6) {
        showCodeError('Digite o código completo de 6 dígitos');
        return;
    }

    const btnVerify = document.getElementById('btn-verify');
    btnVerify.disabled = true;
    btnVerify.textContent = 'Verificando...';

    try {
        console.log('🔐 Verificando código...');

        const response = await fetch(`${API_URL}/v1/auth/verify-reset-code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: pendingEmail,
                code: code
            })
        });

        const data = await response.json();
        console.log('📬 Resposta verify-reset-code:', data);

        const isVerified = data.success && (data.data?.verified || data.verified);

        if (response.ok && isVerified) {
            console.log('✅ Código verificado!');

            // Parar timer
            stopResendTimer();

            // Ir para etapa de nova senha
            goToStep('password');
        } else {
            showCodeError(data.error || 'Código inválido ou expirado');
            btnVerify.disabled = false;
            btnVerify.textContent = 'Verificar código';
            shakeCodeInputs();
        }

    } catch (error) {
        console.error('💥 Erro de conexão:', error);
        showCodeError('Erro de conexão. Tente novamente.');
        btnVerify.disabled = false;
        btnVerify.textContent = 'Verificar código';
    }
}

// ===== ETAPA 3: REDEFINIR SENHA =====
async function resetPassword(event) {
    if (event) event.preventDefault();

    const newPassword = document.getElementById('inova-senha').value;
    const confirmPassword = document.getElementById('iconfirmar-senha').value;
    const submitButton = document.getElementById('isubmit-reset');
    const errorDiv = document.getElementById('password-error');

    // Validações
    if (!newPassword || newPassword.length < 6) {
        showPasswordError('Senha deve ter pelo menos 6 caracteres');
        return;
    }

    if (newPassword !== confirmPassword) {
        showPasswordError('As senhas não coincidem');
        return;
    }

    // Esconder erro
    errorDiv.classList.remove('visible');

    // Desabilitar botão
    submitButton.disabled = true;
    const originalValue = submitButton.value;
    submitButton.value = 'Redefinindo...';

    try {
        console.log('🔐 Redefinindo senha...');

        const response = await fetch(`${API_URL}/v1/auth/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: pendingEmail,
                newPassword: newPassword
            })
        });

        const data = await response.json();
        console.log('📬 Resposta reset-password:', data);

        if (response.ok && data.success) {
            console.log('✅ Senha redefinida!');

            // Ir para etapa de sucesso
            goToStep('success');
        } else {
            showPasswordError(data.error || 'Erro ao redefinir senha');
            submitButton.disabled = false;
            submitButton.value = originalValue;
        }

    } catch (error) {
        console.error('💥 Erro de conexão:', error);
        showPasswordError('Erro de conexão. Tente novamente.');
        submitButton.disabled = false;
        submitButton.value = originalValue;
    }
}

// ===== REENVIAR CÓDIGO =====
async function resendCode() {
    const btnResend = document.getElementById('btn-resend');
    btnResend.disabled = true;
    btnResend.textContent = 'Enviando...';

    try {
        const response = await fetch(`${API_URL}/v1/auth/forgot-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: pendingEmail
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log('✅ Código reenviado!');
            showCodeError('Novo código enviado!', 'success');
            clearCodeInputs();
            startResendTimer();
        } else {
            showCodeError(data.error || 'Erro ao reenviar código');
            btnResend.disabled = false;
            btnResend.innerHTML = 'Reenviar';
        }

    } catch (error) {
        console.error('💥 Erro de conexão:', error);
        showCodeError('Erro de conexão. Tente novamente.');
        btnResend.disabled = false;
        btnResend.innerHTML = 'Reenviar';
    }
}

// ===== TIMER DE REENVIO =====
function startResendTimer() {
    resendCountdown = 60;
    const btnResend = document.getElementById('btn-resend');
    const timerSpan = document.getElementById('resend-timer');

    btnResend.disabled = true;
    timerSpan.textContent = resendCountdown;
    btnResend.innerHTML = `Reenviar (<span id="resend-timer">${resendCountdown}</span>s)`;

    resendTimerInterval = setInterval(() => {
        resendCountdown--;
        const timerSpan = document.getElementById('resend-timer');
        if (timerSpan) timerSpan.textContent = resendCountdown;

        if (resendCountdown <= 0) {
            stopResendTimer();
            btnResend.disabled = false;
            btnResend.innerHTML = 'Reenviar';
        }
    }, 1000);
}

function stopResendTimer() {
    if (resendTimerInterval) {
        clearInterval(resendTimerInterval);
        resendTimerInterval = null;
    }
}

// ===== HELPERS =====
function getCodeFromInputs() {
    const inputs = document.querySelectorAll('.code-input');
    let code = '';
    inputs.forEach(input => {
        code += input.value;
    });
    return code;
}

function clearCodeInputs() {
    const inputs = document.querySelectorAll('.code-input');
    inputs.forEach(input => {
        input.value = '';
    });
    const firstInput = document.querySelector('.code-input[data-index="0"]');
    if (firstInput) firstInput.focus();
}

function shakeCodeInputs() {
    const container = document.querySelector('.code-inputs-container');
    if (container) {
        container.classList.add('shake');
        setTimeout(() => container.classList.remove('shake'), 500);
    }
}

function showMessage(message, type) {
    const container = document.getElementById('message-container');
    if (container) {
        container.textContent = message;
        container.className = type;
        container.style.display = 'block';

        setTimeout(() => {
            container.style.display = 'none';
        }, 5000);
    }
}

function showCodeError(message, type = 'error') {
    const errorDiv = document.getElementById('code-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.className = `error-message visible ${type}`;
    }
}

function showPasswordError(message) {
    const errorDiv = document.getElementById('password-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.className = 'error-message visible';
    }
}

// ===== CONFIGURAR INPUTS DE CÓDIGO =====
function setupCodeInputs() {
    const inputs = document.querySelectorAll('.code-input');

    inputs.forEach((input, index) => {
        // Ao digitar
        input.addEventListener('input', (e) => {
            const value = e.target.value;

            // Aceitar apenas números
            if (!/^\d*$/.test(value)) {
                e.target.value = '';
                return;
            }

            // Se digitou um número, ir para o próximo
            if (value && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }

            // Se todos os campos estão preenchidos, verificar automaticamente
            if (getCodeFromInputs().length === 6) {
                verifyCode();
            }
        });

        // Ao colar
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);

            pastedData.split('').forEach((char, i) => {
                if (inputs[i]) {
                    inputs[i].value = char;
                }
            });

            // Focar no último campo preenchido ou no próximo vazio
            const lastIndex = Math.min(pastedData.length, 5);
            inputs[lastIndex].focus();

            // Se colou 6 dígitos, verificar
            if (pastedData.length === 6) {
                verifyCode();
            }
        });

        // Backspace
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
        });

        // Focar
        input.addEventListener('focus', () => {
            input.select();
        });
    });
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Sistema de recuperação de senha inicializado');

    // Capturar o formulário de email
    const forgotForm = document.getElementById('forgot-form');
    if (forgotForm) {
        forgotForm.addEventListener('submit', sendResetCode);
    }

    // Capturar o formulário de reset
    const resetForm = document.getElementById('reset-form');
    if (resetForm) {
        resetForm.addEventListener('submit', resetPassword);
    }

    // Configurar inputs de código
    setupCodeInputs();

    // Enter no campo de email submete o formulário
    const emailInput = document.getElementById('iemail');
    if (emailInput) {
        emailInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendResetCode(e);
            }
        });
    }
});

// Expor funções globais
window.goToStep = goToStep;
window.verifyCode = verifyCode;
window.resendCode = resendCode;

console.log('✅ forgotPassword.js carregado!');
