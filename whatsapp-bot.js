const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const db = require('./database'); // Usar o módulo de banco de dados

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

    // Extrair número de telefone real do remetente
    let phoneNumber = null;

    // Tentar obter o número real do participante (pode estar no pushName ou participant)
    const participant = msg.key.participant || from;

    // Se for LID (@lid), tentar resolver para número real
    if (from.includes('@lid') || participant.includes('@lid')) {
        // Tentar obter número do campo 'notify' ou do objeto da mensagem
        const senderNumber = msg.pushName ? null : null; // pushName é só o nome

        // Verificar se temos o número no verifiedBizName ou outros campos
        if (msg.verifiedBizName) {
            console.log('📱 Verified Biz:', msg.verifiedBizName);
        }

        // Para LID, vamos tentar usar a API de lookup
        try {
            // Tentar obter informações do contato
            const [result] = await sock.onWhatsApp(from.replace('@lid', '@s.whatsapp.net'));
            if (result && result.jid) {
                phoneNumber = result.jid.replace('@s.whatsapp.net', '');
                console.log('📱 Número resolvido via onWhatsApp:', phoneNumber);
            }
        } catch (e) {
            console.log('⚠️ Não foi possível resolver LID:', e.message);
        }

        // Se ainda não conseguiu, extrair o número do LID (remove sufixos)
        if (!phoneNumber) {
            phoneNumber = from
                .replace('@s.whatsapp.net', '')
                .replace('@lid', '')
                .replace('@g.us', '')
                .replace('@broadcast', '');
        }
    } else {
        // Número normal - extrair diretamente
        phoneNumber = from
            .replace('@s.whatsapp.net', '')
            .replace('@lid', '')
            .replace('@g.us', '')
            .replace('@broadcast', '');
    }

    // Log detalhado para debug
    console.log('==========================================');
    console.log('📱 FROM original:', from);
    console.log('📱 Participant:', participant);
    console.log('📱 Número extraído:', phoneNumber);
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
            const params = text.substring(9).trim();

            // Verificar se tem número manual: "vincular email 5575992488820"
            const partes = params.split(' ');
            let email = partes[0];
            let numeroManual = partes[1] || null;

            console.log('📧 Email recebido:', email);
            console.log('📱 Número manual:', numeroManual);

            if (!email || !email.includes('@')) {
                await sock.sendMessage(from, {
                    text: '❌ Use: *vincular [seu-email]*\nExemplo: vincular seu@email.com\n\n' +
                          'Ou com número manual:\n*vincular [email] [número]*\nExemplo: vincular seu@email.com 5575992488820'
                });
                return;
            }

            console.log('🔍 Buscando usuário no banco...');

            // Buscar user_id pelo email
            const result = await db.query('SELECT id FROM users WHERE email = $1', [email]);

            console.log('📊 Resultado da busca:', result);

            if (result.length === 0) {
                await sock.sendMessage(from, {
                    text: '❌ Email não encontrado. Crie sua conta em https://nura.app primeiro!'
                });
                return;
            }

            const userId = result[0].id;
            console.log('✅ User ID encontrado:', userId);

            // Usar número manual se fornecido, senão usar o extraído
            const numeroParaSalvar = numeroManual || phoneNumber;
            console.log('📱 Número que será salvo:', numeroParaSalvar);

            // Criar tabela se não existir
            console.log('🔧 Criando/verificando tabela users_whatsapp...');
            await db.query(`
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
            console.log('🔗 Vinculando telefone:', numeroParaSalvar, '-> user_id:', userId);
            await db.query(
                'INSERT INTO users_whatsapp (user_id, phone_number) VALUES ($1, $2) ON CONFLICT (phone_number) DO UPDATE SET user_id = $1',
                [userId, numeroParaSalvar]
            );
            console.log('✅ Vinculação concluída');

            // Verificar quantas tarefas o usuário já tem
            const tarefasExistentes = await db.query(
                `SELECT COUNT(*) as total FROM tasks WHERE user_id = $1 AND status NOT IN ('completed', 'concluido') AND (deleted_at IS NULL)`,
                [userId]
            );
            const totalTarefas = tarefasExistentes[0]?.total || 0;
            console.log('📊 Tarefas existentes do usuário:', totalTarefas);

            await sock.sendMessage(from, {
                text: `✅ *WhatsApp vinculado com sucesso!*\n\n` +
                      `📧 Email: ${email}\n` +
                      `📋 Tarefas pendentes: ${totalTarefas}\n\n` +
                      `Agora você pode gerenciar suas tarefas por aqui!\n\n` +
                      `Digite *tarefas* para ver sua lista.`
            });
        }
        
        else if (comando === 'tarefas') {
            console.log('✅ Executando comando: TAREFAS');
            console.log('📱 Telefone sendo usado:', phoneNumber);

            const tarefas = await getTarefasPorTelefone(phoneNumber);

            console.log('📊 Tarefas retornadas:', tarefas.length);

            if (tarefas.length === 0) {
                await sock.sendMessage(from, {
                    text: '📋 Você não tem tarefas pendentes! 🎉\n\nDigite *adicionar [tarefa]* para criar uma.'
                });
            } else {
                let mensagem = '📋 *Suas Tarefas Pendentes:*\n\n';

                tarefas.forEach((t, i) => {
                    const prioridade = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
                    // Usar title ou name dependendo do que existir
                    const nome = t.title || t.name || 'Sem título';
                    mensagem += `${i + 1}. ${prioridade} *${nome}*\n`;
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

            // Buscar lista padrão do usuário
            console.log('📋 Buscando lista padrão do usuário...');
            const listaResult = await db.query(
                `SELECT id FROM lists WHERE user_id = $1 AND is_default = true LIMIT 1`,
                [userId]
            );

            let listId = null;
            if (listaResult.length > 0) {
                listId = listaResult[0].id;
                console.log('📋 Lista padrão encontrada:', listId);
            } else {
                // Se não tem lista padrão, buscar qualquer lista do usuário
                const qualquerLista = await db.query(
                    `SELECT id FROM lists WHERE user_id = $1 ORDER BY position LIMIT 1`,
                    [userId]
                );
                if (qualquerLista.length > 0) {
                    listId = qualquerLista[0].id;
                    console.log('📋 Usando primeira lista:', listId);
                }
            }

            console.log('💾 Salvando tarefa no banco...');
            console.log('📝 Dados: título=', tarefa, 'userId=', userId, 'listId=', listId);
            await db.query(
                `INSERT INTO tasks (title, user_id, list_id, status, priority, created_at)
                 VALUES ($1, $2, $3, $4, $5, NOW())`,
                [tarefa, userId, listId, 'pending', 'medium']
            );
            console.log('✅ Tarefa salva com sucesso!');

            await sock.sendMessage(from, {
                text: `✅ Tarefa criada: *${tarefa}*`
            });
        }
        
        else if (comando === 'hoje') {
            console.log('✅ Executando comando: HOJE');

            // Usar timezone do Brasil para pegar a data correta
            const agora = new Date();
            const opcoes = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' };
            const dataFormatada = agora.toLocaleDateString('sv-SE', opcoes); // sv-SE retorna formato YYYY-MM-DD

            console.log('📅 Data de hoje (BR):', dataFormatada);
            console.log('📅 Data UTC:', agora.toISOString());

            const tarefas = await getTarefasHoje(phoneNumber, dataFormatada);

            console.log('📊 Tarefas de hoje retornadas:', tarefas.length);

            if (tarefas.length === 0) {
                await sock.sendMessage(from, {
                    text: '📅 Você não tem tarefas para hoje!'
                });
            } else {
                let mensagem = '📅 *Tarefas de Hoje:*\n\n';

                tarefas.forEach((t, i) => {
                    const prioridade = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
                    const nome = t.title || t.name || 'Sem título';
                    mensagem += `${i + 1}. ${prioridade} *${nome}*\n\n`;
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

    console.log('🔍 getTarefasPorTelefone - userId:', userId, 'telefone:', telefone);

    if (!userId) return [];

    const result = await db.query(
        `SELECT * FROM tasks
         WHERE user_id = $1
           AND status NOT IN ('completed', 'concluido')
           AND (deleted_at IS NULL)
         ORDER BY created_at DESC`,
        [userId]
    );

    console.log('📊 Tarefas encontradas no banco:', result.length, result);

    return result; // db.query já retorna rows
}

async function getTarefasHoje(telefone, hoje) {
    const userId = await getUserIdPorTelefone(telefone);

    console.log('🔍 getTarefasHoje - userId:', userId, 'hoje:', hoje);

    if (!userId) return [];

    // Debug: primeiro vamos ver todas as tarefas com due_date para entender o formato
    const todasTarefas = await db.query(
        `SELECT id, title, due_date, status,
                due_date::date as due_date_only,
                $2::date as hoje_param
         FROM tasks
         WHERE user_id = $1
           AND deleted_at IS NULL
           AND due_date IS NOT NULL
         LIMIT 10`,
        [userId, hoje]
    );
    console.log('🔍 Debug - Todas as tarefas com due_date:', JSON.stringify(todasTarefas, null, 2));

    // Usar cast explícito para DATE no PostgreSQL
    const result = await db.query(
        `SELECT * FROM tasks
         WHERE user_id = $1
           AND due_date::date = $2::date
           AND status NOT IN ('completed', 'concluido')
           AND deleted_at IS NULL`,
        [userId, hoje]
    );

    console.log('📊 Tarefas de hoje encontradas:', result.length);

    return result;
}

async function getUserIdPorTelefone(telefone) {
    try {
        console.log('🔎 Buscando user_id para telefone:', telefone);

        const result = await db.query(
            `SELECT user_id FROM users_whatsapp WHERE phone_number = $1`,
            [telefone]
        );

        console.log('📋 Resultado da busca users_whatsapp:', result);

        if (result.length > 0) {
            console.log('✅ User ID encontrado:', result[0].user_id);
            return result[0].user_id;
        } else {
            console.log('❌ Nenhum vínculo encontrado para este telefone');
            return null;
        }
    } catch (error) {
        console.error('❌ Erro ao buscar user_id:', error);
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

// ===== NOTIFICAÇÕES DIÁRIAS =====

// Busca todos os usuários vinculados com tarefas pendentes
async function getUsuariosComTarefasPendentes() {
    try {
        const result = await db.query(`
            SELECT DISTINCT
                uw.phone_number,
                uw.user_id,
                u.name
            FROM users_whatsapp uw
            JOIN users u ON u.id = uw.user_id
            JOIN tasks t ON t.user_id = uw.user_id
            WHERE t.status NOT IN ('completed', 'concluido')
              AND (t.deleted_at IS NULL)
        `);
        return result; // db.query já retorna rows
    } catch (error) {
        console.error('Erro ao buscar usuários com tarefas:', error);
        return [];
    }
}

// Busca tarefas pendentes para um usuário (incluindo sem data)
async function getTarefasPendentesUsuario(userId) {
    try {
        const hoje = new Date().toISOString().split('T')[0];
        const result = await db.query(`
            SELECT title, priority, due_date
            FROM tasks
            WHERE user_id = $1
              AND status NOT IN ('completed', 'concluido')
              AND (deleted_at IS NULL)
            ORDER BY
                CASE WHEN due_date IS NOT NULL AND due_date < $2 THEN 0
                     WHEN due_date = $2 THEN 1
                     WHEN due_date IS NULL THEN 2
                     ELSE 3 END,
                CASE priority
                    WHEN 'high' THEN 1
                    WHEN 'medium' THEN 2
                    ELSE 3
                END
        `, [userId, hoje]);
        return result; // db.query já retorna rows
    } catch (error) {
        console.error('Erro ao buscar tarefas do usuário:', error);
        return [];
    }
}

// Formata mensagem de resumo diário
function formatarMensagemDiaria(nome, tarefasHoje, tarefasAtrasadas, tarefasSemData) {
    let msg = `☀️ *Bom dia, ${nome || 'usuário'}!*\n\n`;

    if (tarefasAtrasadas.length > 0) {
        msg += `⚠️ *Tarefas atrasadas (${tarefasAtrasadas.length}):*\n`;
        tarefasAtrasadas.forEach((t, i) => {
            const prioIcon = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
            msg += `${i + 1}. ${prioIcon} ${t.title}\n`;
        });
        msg += '\n';
    }

    if (tarefasHoje.length > 0) {
        msg += `📋 *Tarefas para hoje (${tarefasHoje.length}):*\n`;
        tarefasHoje.forEach((t, i) => {
            const prioIcon = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
            msg += `${i + 1}. ${prioIcon} ${t.title}\n`;
        });
        msg += '\n';
    }

    if (tarefasSemData.length > 0) {
        msg += `📝 *Outras pendentes (${tarefasSemData.length}):*\n`;
        tarefasSemData.slice(0, 5).forEach((t, i) => {
            const prioIcon = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
            msg += `${i + 1}. ${prioIcon} ${t.title}\n`;
        });
        if (tarefasSemData.length > 5) {
            msg += `   _... e mais ${tarefasSemData.length - 5} tarefas_\n`;
        }
    }

    const total = tarefasAtrasadas.length + tarefasHoje.length + tarefasSemData.length;
    if (total === 0) {
        msg += `✨ Nenhuma tarefa pendente! Aproveite o dia!\n`;
    }

    msg += `\n💡 Responda "tarefas" para ver a lista completa.`;

    return msg;
}

// Envia resumo diário para todos os usuários vinculados
async function enviarResumoDiarioWhatsApp() {
    if (!sock) {
        console.log('❌ WhatsApp não conectado - não é possível enviar resumos');
        return { success: false, error: 'WhatsApp não conectado' };
    }

    console.log('📱 Iniciando envio de resumos diários via WhatsApp...');

    try {
        const usuarios = await getUsuariosComTarefasPendentes();
        console.log(`👥 Encontrados ${usuarios.length} usuários com tarefas pendentes`);

        let enviados = 0;
        let erros = 0;

        for (const usuario of usuarios) {
            try {
                const tarefas = await getTarefasPendentesUsuario(usuario.user_id);

                if (tarefas.length > 0) {
                    const hoje = new Date().toISOString().split('T')[0];

                    // Separar tarefas por categoria
                    const atrasadas = tarefas.filter(t => {
                        if (!t.due_date) return false;
                        const dueDate = new Date(t.due_date).toISOString().split('T')[0];
                        return dueDate < hoje;
                    });

                    const deHoje = tarefas.filter(t => {
                        if (!t.due_date) return false;
                        const dueDate = new Date(t.due_date).toISOString().split('T')[0];
                        return dueDate === hoje;
                    });

                    const semData = tarefas.filter(t => !t.due_date);

                    const mensagem = formatarMensagemDiaria(usuario.name, deHoje, atrasadas, semData);

                    await sock.sendMessage(
                        `${usuario.phone_number}@s.whatsapp.net`,
                        { text: mensagem }
                    );

                    console.log(`✅ Resumo enviado para ${usuario.phone_number}`);
                    enviados++;

                    // Delay de 2 segundos entre mensagens (evitar bloqueio do WhatsApp)
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            } catch (err) {
                console.error(`❌ Erro ao enviar para ${usuario.phone_number}:`, err.message);
                erros++;
            }
        }

        console.log(`📱 Resumo WhatsApp finalizado: ${enviados} enviados, ${erros} erros`);
        return { success: true, enviados, erros };

    } catch (error) {
        console.error('❌ Erro ao enviar resumos WhatsApp:', error);
        return { success: false, error: error.message };
    }
}

// ===== NOTIFICAÇÕES ALEATÓRIAS MOTIVACIONAIS =====

// Frases motivacionais para diferentes situações
const FRASES_MOTIVACIONAIS = {
    alta: [
        "🔥 Ei! Você tem tarefas urgentes esperando. Que tal resolver uma agora e sentir aquela satisfação de missão cumprida?",
        "⚡ Tarefa urgente na área! Lembra: feito é melhor que perfeito. Bora lá!",
        "🚀 Suas tarefas importantes estão chamando! 5 minutos de foco podem fazer toda a diferença.",
        "💪 Você é capaz! Essas tarefas urgentes não vão se resolver sozinhas, mas você consegue!",
        "🎯 Foco no que importa! Suas prioridades altas merecem sua atenção agora.",
        "⏰ Hora de brilhar! Tackle essas tarefas urgentes e depois celebre!",
        "🌟 Cada tarefa concluída é uma vitória. Comece pelas urgentes!"
    ],
    media: [
        "📋 Olha só, você tem algumas tarefas te esperando. Que tal dar uma olhada?",
        "✨ Um pouquinho de organização hoje evita correria amanhã. Bora ver essas tarefas?",
        "🌈 Dia perfeito para ser produtivo! Suas tarefas estão esperando por você.",
        "💡 Dica: resolver tarefas médias antes delas virarem urgentes = menos estresse!",
        "🎈 Você está indo bem! Mas não esquece de dar uma atenção às tarefas pendentes.",
        "☕ Pausa pro café e depois bora resolver algumas tarefas? Você consegue!"
    ],
    lembrete: [
        "👋 Oi! Só passando pra lembrar que você tem coisas pra fazer. Nada demais, só um toque amigo!",
        "🔔 Lembrete carinhoso: suas tarefas sentem sua falta! 😄",
        "📝 Ei produtivo(a)! Suas tarefas estão esperando. Que tal dar uma passadinha?",
        "🌻 Um pequeno passo hoje, grandes resultados amanhã. Olha suas tarefas!"
    ]
};

// Função para escolher frase aleatória
function escolherFraseMotivacional(tipo) {
    const frases = FRASES_MOTIVACIONAIS[tipo] || FRASES_MOTIVACIONAIS.lembrete;
    return frases[Math.floor(Math.random() * frases.length)];
}

// Busca tarefas de alta e média prioridade do usuário
async function getTarefasPorPrioridade(userId) {
    try {
        const result = await db.query(`
            SELECT
                COUNT(*) FILTER (WHERE priority = 'high') as alta,
                COUNT(*) FILTER (WHERE priority = 'medium') as media,
                COUNT(*) as total
            FROM tasks
            WHERE user_id = $1
              AND status NOT IN ('completed', 'concluido')
              AND deleted_at IS NULL
        `, [userId]);

        return {
            alta: parseInt(result[0]?.alta || 0),
            media: parseInt(result[0]?.media || 0),
            total: parseInt(result[0]?.total || 0)
        };
    } catch (error) {
        console.error('Erro ao buscar tarefas por prioridade:', error);
        return { alta: 0, media: 0, total: 0 };
    }
}

// Formata mensagem motivacional
function formatarMensagemMotivacional(nome, tarefas) {
    let tipo = 'lembrete';

    if (tarefas.alta > 0) {
        tipo = 'alta';
    } else if (tarefas.media > 0) {
        tipo = 'media';
    }

    const frase = escolherFraseMotivacional(tipo);

    let msg = `${frase}\n\n`;

    if (tarefas.alta > 0) {
        msg += `🔴 *${tarefas.alta}* tarefa${tarefas.alta > 1 ? 's' : ''} de prioridade ALTA\n`;
    }
    if (tarefas.media > 0) {
        msg += `🟡 *${tarefas.media}* tarefa${tarefas.media > 1 ? 's' : ''} de prioridade MÉDIA\n`;
    }

    const outras = tarefas.total - tarefas.alta - tarefas.media;
    if (outras > 0) {
        msg += `🟢 *${outras}* outra${outras > 1 ? 's' : ''} pendente${outras > 1 ? 's' : ''}\n`;
    }

    msg += `\n💬 Responda *tarefas* para ver a lista completa!`;

    return msg;
}

// Envia notificação motivacional para um usuário específico
async function enviarNotificacaoMotivacional(phoneNumber, userId, nome) {
    if (!sock) {
        console.log('❌ WhatsApp não conectado');
        return false;
    }

    try {
        const tarefas = await getTarefasPorPrioridade(userId);

        // Só envia se tiver tarefas pendentes
        if (tarefas.total === 0) {
            console.log(`⏭️ ${phoneNumber} não tem tarefas pendentes, pulando...`);
            return false;
        }

        const mensagem = formatarMensagemMotivacional(nome, tarefas);

        await sock.sendMessage(
            `${phoneNumber}@s.whatsapp.net`,
            { text: mensagem }
        );

        console.log(`✅ Notificação motivacional enviada para ${phoneNumber}`);
        return true;
    } catch (error) {
        console.error(`❌ Erro ao enviar notificação para ${phoneNumber}:`, error.message);
        return false;
    }
}

// Envia notificações motivacionais para todos os usuários vinculados
async function enviarNotificacoesAleatorias() {
    if (!sock) {
        console.log('❌ WhatsApp não conectado - não é possível enviar notificações');
        return { success: false, error: 'WhatsApp não conectado' };
    }

    console.log('🎲 Iniciando envio de notificações motivacionais aleatórias...');

    try {
        const usuarios = await getUsuariosComTarefasPendentes();
        console.log(`👥 ${usuarios.length} usuários com tarefas pendentes`);

        let enviados = 0;
        let erros = 0;

        for (const usuario of usuarios) {
            try {
                const sucesso = await enviarNotificacaoMotivacional(
                    usuario.phone_number,
                    usuario.user_id,
                    usuario.name
                );

                if (sucesso) enviados++;

                // Delay de 3 segundos entre mensagens
                await new Promise(resolve => setTimeout(resolve, 3000));
            } catch (err) {
                console.error(`❌ Erro: ${err.message}`);
                erros++;
            }
        }

        console.log(`🎲 Notificações aleatórias: ${enviados} enviadas, ${erros} erros`);
        return { success: true, enviados, erros };

    } catch (error) {
        console.error('❌ Erro ao enviar notificações aleatórias:', error);
        return { success: false, error: error.message };
    }
}

// Agendar próxima notificação aleatória (entre 2-4 horas)
function agendarProximaNotificacao() {
    // Intervalo aleatório entre 2 e 4 horas (em milissegundos)
    const minHoras = 2;
    const maxHoras = 4;
    const intervaloMs = (Math.random() * (maxHoras - minHoras) + minHoras) * 60 * 60 * 1000;

    // Converter para minutos para log
    const intervaloMin = Math.round(intervaloMs / 60000);

    console.log(`⏰ Próxima notificação aleatória em ${intervaloMin} minutos (${(intervaloMin / 60).toFixed(1)} horas)`);

    setTimeout(async () => {
        // Verificar se estamos no horário permitido (8h - 21h)
        const agora = new Date();
        const hora = agora.toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            hour: 'numeric',
            hour12: false
        });
        const horaNum = parseInt(hora);

        if (horaNum >= 8 && horaNum < 21) {
            console.log(`🎲 Executando notificação aleatória às ${hora}h`);
            await enviarNotificacoesAleatorias();
        } else {
            console.log(`💤 Fora do horário (${hora}h), pulando notificação`);
        }

        // Agendar próxima
        agendarProximaNotificacao();
    }, intervaloMs);
}

// ===== INICIAR BOT =====
console.log('🤖 Iniciando bot WhatsApp...');
connectToWhatsApp().catch(err => {
    console.error('❌ Erro ao conectar WhatsApp:', err);
});

// Iniciar sistema de notificações aleatórias após 30 segundos
setTimeout(() => {
    console.log('🎲 Iniciando sistema de notificações aleatórias...');
    agendarProximaNotificacao();
}, 30000);

// === FUNÇÃO DE TESTE MANUAL ===
// Para testar, chame: testarNotificacao('5575992488820', 4, 'Gustavo')
async function testarNotificacao(telefone, userId, nome) {
    if (!sock) {
        console.log('❌ WhatsApp não conectado');
        return;
    }

    console.log('🧪 TESTE: Enviando notificação motivacional...');
    try {
        const tarefas = await getTarefasPorPrioridade(userId);
        console.log('📊 Tarefas encontradas:', tarefas);

        if (tarefas.total === 0) {
            console.log('⚠️ Usuário não tem tarefas pendentes!');
            // Enviar mensagem mesmo assim para testar
            await sock.sendMessage(
                `${telefone}@s.whatsapp.net`,
                { text: `✅ Teste de conexão! Você não tem tarefas pendentes. Sistema funcionando!` }
            );
        } else {
            const mensagem = formatarMensagemMotivacional(nome, tarefas);
            console.log('📝 Mensagem:', mensagem);

            await sock.sendMessage(
                `${telefone}@s.whatsapp.net`,
                { text: mensagem }
            );
        }
        console.log('✅ Notificação de teste enviada com sucesso!');
    } catch (error) {
        console.error('❌ Erro no teste:', error);
    }
}

// Teste automático 45s após conexão (remover depois de testar)
setTimeout(async () => {
    if (sock) {
        await testarNotificacao('5575992488820', 4, 'Gustavo');
    }
}, 45000);

// Exporta o socket e as funções
module.exports = {
    get sock() { return sock; }, // Getter para sempre pegar o sock atual
    enviarResumoDiarioWhatsApp,
    enviarNotificacoesAleatorias,
    testarNotificacao // Para testes manuais
};