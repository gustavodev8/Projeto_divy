const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { pool } = require('./server'); // Usar o pool do PostgreSQL

let sock;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('📱 Escaneie o QR Code com seu WhatsApp:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('❌ Conexão fechada. Reconectando:', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp conectado!');
        }
    });

    // ===== RECEBER MENSAGENS =====
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        
        if (!msg.message || msg.key.fromMe) return;
        
        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        
        console.log('📩 Mensagem de:', from);
        console.log('💬 Texto:', text);
        
        await handleMessage(from, text, msg);
    });
}

// ===== PROCESSAR COMANDOS =====
async function handleMessage(from, text, msg) {
    const comando = text.toLowerCase().trim();
    
    // Extrair número de telefone
    const phoneNumber = from.replace('@s.whatsapp.net', '');
    
    console.log('==========================================');
    console.log('📱 Telefone:', phoneNumber);
    console.log('💬 Comando:', comando);
    console.log('==========================================');
    
    try {
        // ===== COMANDOS =====
        
        if (comando === 'oi' || comando === 'olá' || comando === 'hey' || comando === 'ola') {
            console.log('✅ Executando comando: OI');
            await sock.sendMessage(from, {
                text: `👋 Olá! Eu sou o assistente do *NURA*!\n\n` +
                      `📋 Comandos disponíveis:\n\n` +
                      `• *tarefas* - Ver suas tarefas pendentes\n` +
                      `• *adicionar [tarefa]* - Criar nova tarefa\n` +
                      `• *hoje* - Tarefas de hoje\n` +
                      `• *vincular [email]* - Vincular WhatsApp\n` +
                      `• *ajuda* - Ver comandos`
            });
            console.log('✅ Mensagem enviada com sucesso');
        }
        
        else if (comando.startsWith('vincular ')) {
            console.log('✅ Executando comando: VINCULAR');
            const email = text.substring(9).trim();
            
            console.log('📧 Email recebido:', email);
            
            if (!email || !email.includes('@')) {
                await sock.sendMessage(from, {
                    text: '❌ Use: *vincular [seu-email]*\nExemplo: vincular seu@email.com'
                });
                return;
            }
            
            console.log('🔍 Buscando usuário no banco...');
            
            // Buscar user_id pelo email
            const result = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
            
            console.log('📊 Resultado da busca:', result.rows);
            
            if (result.rows.length === 0) {
                await sock.sendMessage(from, {
                    text: '❌ Email não encontrado. Crie sua conta em https://nura.app primeiro!'
                });
                return;
            }
            
            const userId = result.rows[0].id;
            console.log('✅ User ID encontrado:', userId);
            
            // Criar tabela se não existir
            console.log('🔧 Criando/verificando tabela users_whatsapp...');
            await pool.query(`
                CREATE TABLE IF NOT EXISTS users_whatsapp (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    phone_number TEXT UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);
            console.log('✅ Tabela OK');
            
            // Vincular telefone ao user_id
            console.log('🔗 Vinculando telefone...');
            await pool.query(
                'INSERT INTO users_whatsapp (user_id, phone_number) VALUES ($1, $2) ON CONFLICT (phone_number) DO UPDATE SET user_id = $1',
                [userId, phoneNumber]
            );
            console.log('✅ Vinculação concluída');
            
            await sock.sendMessage(from, {
                text: `✅ WhatsApp vinculado com sucesso!\n\nAgora você pode usar todos os comandos. Digite *ajuda* para ver.`
            });
        }
        
        else if (comando === 'tarefas') {
            console.log('✅ Executando comando: TAREFAS');
            const tarefas = await getTarefasPorTelefone(phoneNumber);
            
            console.log('📊 Tarefas encontradas:', tarefas.length);
            
            if (tarefas.length === 0) {
                await sock.sendMessage(from, {
                    text: '📋 Você não tem tarefas pendentes! 🎉\n\nDigite *adicionar [tarefa]* para criar uma.'
                });
            } else {
                let mensagem = '📋 *Suas Tarefas Pendentes:*\n\n';
                
                tarefas.forEach((t, i) => {
                    const prioridade = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
                    mensagem += `${i + 1}. ${prioridade} *${t.title}*\n`;
                    if (t.due_date) mensagem += `   📅 ${formatarData(t.due_date)}\n`;
                    mensagem += '\n';
                });
                
                await sock.sendMessage(from, { text: mensagem });
            }
        }
        
        else if (comando.startsWith('adicionar ')) {
            console.log('✅ Executando comando: ADICIONAR');
            const tarefa = text.substring(10).trim();
            
            console.log('📝 Tarefa:', tarefa);
            
            if (!tarefa) {
                await sock.sendMessage(from, {
                    text: '❌ Use: *adicionar [nome da tarefa]*\nExemplo: adicionar Comprar café'
                });
                return;
            }
            
            console.log('🔍 Buscando user_id...');
            const userId = await getUserIdPorTelefone(phoneNumber);
            
            console.log('👤 User ID:', userId);
            
            if (!userId) {
                await sock.sendMessage(from, {
                    text: '❌ Você precisa vincular seu WhatsApp primeiro!\n\n' +
                          'Use: *vincular [seu-email]*\nExemplo: vincular seu@email.com'
                });
                return;
            }
            
            console.log('💾 Salvando tarefa no banco...');
            await pool.query(
                'INSERT INTO tasks (title, user_id, status, priority) VALUES ($1, $2, $3, $4)',
                [tarefa, userId, 'pending', 'medium']
            );
            console.log('✅ Tarefa salva');
            
            await sock.sendMessage(from, {
                text: `✅ Tarefa criada: *${tarefa}*`
            });
        }
        
        else if (comando === 'hoje') {
            console.log('✅ Executando comando: HOJE');
            const hoje = new Date().toISOString().split('T')[0];
            const tarefas = await getTarefasHoje(phoneNumber, hoje);
            
            console.log('📊 Tarefas de hoje:', tarefas.length);
            
            if (tarefas.length === 0) {
                await sock.sendMessage(from, {
                    text: '📅 Você não tem tarefas para hoje!'
                });
            } else {
                let mensagem = '📅 *Tarefas de Hoje:*\n\n';
                
                tarefas.forEach((t, i) => {
                    const prioridade = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
                    mensagem += `${i + 1}. ${prioridade} *${t.title}*\n\n`;
                });
                
                await sock.sendMessage(from, { text: mensagem });
            }
        }
        
        else if (comando === 'ajuda' || comando === 'help') {
            console.log('✅ Executando comando: AJUDA');
            await sock.sendMessage(from, {
                text: `🤖 *NURA - Assistente WhatsApp*\n\n` +
                      `📋 *Comandos:*\n\n` +
                      `• *vincular [email]* - Vincular WhatsApp\n` +
                      `• *tarefas* - Listar tarefas pendentes\n` +
                      `• *adicionar [tarefa]* - Criar tarefa\n` +
                      `• *hoje* - Tarefas de hoje\n` +
                      `• *ajuda* - Mostrar este menu`
            });
        }
        
        else {
            console.log('⚠️ Comando não reconhecido');
            await sock.sendMessage(from, {
                text: '❓ Comando não reconhecido.\nDigite *ajuda* para ver os comandos.'
            });
        }
        
    } catch (error) {
        console.error('❌❌❌ ERRO COMPLETO:');
        console.error('Mensagem:', error.message);
        console.error('Stack:', error.stack);
        console.error('Nome:', error.name);
        console.error('==========================================');
        
        await sock.sendMessage(from, {
            text: '❌ Desculpe, ocorreu um erro. Tente novamente.\n\nErro: ' + error.message
        });
    }
}

// ===== FUNÇÕES DE BANCO DE DADOS =====

async function getTarefasPorTelefone(telefone) {
    const userId = await getUserIdPorTelefone(telefone);
    
    if (!userId) return [];
    
    const result = await pool.query(
        `SELECT * FROM tasks WHERE user_id = $1 AND status != 'completed' ORDER BY created_at DESC`,
        [userId]
    );
    
    return result.rows;
}

async function getTarefasHoje(telefone, hoje) {
    const userId = await getUserIdPorTelefone(telefone);
    
    if (!userId) return [];
    
    const result = await pool.query(
        `SELECT * FROM tasks WHERE user_id = $1 AND due_date = $2 AND status != 'completed'`,
        [userId, hoje]
    );
    
    return result.rows;
}

async function getUserIdPorTelefone(telefone) {
    try {
        const result = await pool.query(
            `SELECT user_id FROM users_whatsapp WHERE phone_number = $1`,
            [telefone]
        );
        
        return result.rows.length > 0 ? result.rows[0].user_id : null;
    } catch (error) {
        console.error('Erro ao buscar user_id:', error);
        return null;
    }
}

// ===== UTILITÁRIOS =====

function formatarData(dateString) {
    const date = new Date(dateString);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const diffDays = Math.ceil((date - hoje) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Amanhã';
    if (diffDays === -1) return 'Ontem';
    
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

// ===== INICIAR BOT =====
console.log('🤖 Iniciando bot WhatsApp...');
connectToWhatsApp().catch(err => {
    console.error('❌ Erro ao conectar WhatsApp:', err);
});

module.exports = { sock };