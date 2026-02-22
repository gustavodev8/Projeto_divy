const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const db = require('./database'); // Usar o módulo de banco de dados

let sock;

// Estado para rastrear conversas aguardando resposta
const conversationState = new Map();

// Mapa para associar números a LIDs pendentes
// Quando enviamos mensagem para um número, guardamos para depois associar o LID
const pendingLidAssociations = new Map();

// Limpar associações antigas a cada 30 minutos
setInterval(() => {
    const agora = Date.now();
    for (const [key, value] of pendingLidAssociations.entries()) {
        if (agora - value.timestamp > 30 * 60 * 1000) { // 30 minutos
            pendingLidAssociations.delete(key);
        }
    }
}, 30 * 60 * 1000);

// Limpar estados antigos a cada 10 minutos
setInterval(() => {
    const agora = Date.now();
    for (const [key, value] of conversationState.entries()) {
        if (agora - value.timestamp > 10 * 60 * 1000) { // 10 minutos
            conversationState.delete(key);
        }
    }
}, 10 * 60 * 1000);

let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    sock = makeWASocket({
        auth: state
        // printQRInTerminal removido (deprecado)
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('📱 Escaneie o QR Code com seu WhatsApp:');
            qrcode.generate(qr, { small: true });
            reconnectAttempts = 0; // Reset ao receber QR
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log(`❌ Conexão fechada. Status: ${statusCode}, Reconectando: ${shouldReconnect}`);

            if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                console.log(`🔄 Tentativa de reconexão ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
                setTimeout(() => connectToWhatsApp(), 5000); // Aguardar 5s antes de reconectar
            } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                console.log('⚠️ Máximo de tentativas atingido. Delete auth_info_baileys e escaneie o QR novamente.');
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp conectado!');
            reconnectAttempts = 0; // Reset ao conectar
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
        // ===== VERIFICAR ESTADO DE CONVERSA =====
        const state = conversationState.get(from);

        if (state && state.type === 'aguardando_ver_todas') {
            // Verificar se é uma resposta afirmativa
            const respostasAfirmativas = ['s', 'ss', 'sim', 'quero', 'yes', 'si', 'claro', 'bora', 'pode', 'manda', 'show', 'ok', 'beleza', 'blz', 'vamos', 'vai', 'manda ver', 'pode ser'];
            const respostasNegativas = ['n', 'nn', 'nao', 'não', 'no', 'nope', 'depois', 'agora não', 'agora nao'];

            if (respostasAfirmativas.includes(comando)) {
                // Limpar estado
                conversationState.delete(from);

                // Mostrar todas as tarefas pendentes
                const mensagem = formatarTodasTarefas(state.data);
                await sock.sendMessage(from, { text: mensagem });
                return;
            } else if (respostasNegativas.includes(comando)) {
                // Limpar estado
                conversationState.delete(from);
                await sock.sendMessage(from, { text: '👍 Ok! Qualquer coisa é só digitar *tarefas*.' });
                return;
            }
            // Se não for resposta relacionada, limpar estado e continuar processamento normal
            conversationState.delete(from);
        }

        // Aguardando escolha de intervalo de notificação
        if (state && state.type === 'aguardando_notificacao') {
            const opcoes = {
                '0': null,      // Desativado
                '1': 60,        // 1 hora
                '2': 120,       // 2 horas
                '3': 180,       // 3 horas
                '4': 240        // 4 horas
            };

            if (!(comando in opcoes)) {
                await sock.sendMessage(from, {
                    text: '❌ Responda com 0, 1, 2, 3 ou 4'
                });
                return;
            }

            const intervalo = opcoes[comando];

            // Salvar no banco
            await db.query(
                'UPDATE users_whatsapp SET notification_interval = $1 WHERE user_id = $2',
                [intervalo, state.data.userId]
            );

            conversationState.delete(from);

            if (intervalo) {
                await sock.sendMessage(from, {
                    text: `✅ Lembretes ativados!\n\nVocê receberá notificações a cada *${intervalo / 60} hora(s)* sobre suas tarefas pendentes.`
                });
            } else {
                await sock.sendMessage(from, {
                    text: '🔕 Lembretes desativados.\n\nDigite *notificar* para reativar.'
                });
            }
            return;
        }

        // ===== FLUXO DE ADICIONAR TAREFA =====

        // Aguardando escolha de lista
        if (state && state.type === 'aguardando_lista') {
            const numero = parseInt(comando);

            if (isNaN(numero) || numero < 1 || numero > state.data.listas.length) {
                await sock.sendMessage(from, {
                    text: `❌ Responda com um número de 1 a ${state.data.listas.length}`
                });
                return;
            }

            const listaSelecionada = state.data.listas[numero - 1];

            // Buscar seções da lista selecionada
            const secoes = await db.query(
                `SELECT id, name, emoji FROM sections WHERE list_id = $1 ORDER BY position`,
                [listaSelecionada.id]
            );

            if (secoes.length <= 1) {
                // Sem seções ou só uma, ir para prioridade
                conversationState.set(from, {
                    type: 'aguardando_prioridade',
                    data: {
                        tarefa: state.data.tarefa,
                        userId: state.data.userId,
                        listId: listaSelecionada.id,
                        sectionId: secoes.length === 1 ? secoes[0].id : null
                    },
                    timestamp: Date.now()
                });

                await sock.sendMessage(from, {
                    text: `Prioridade?\n1 🔴 Alta\n2 🟡 Média\n3 🟢 Baixa`
                });
            } else {
                // Perguntar seção
                conversationState.set(from, {
                    type: 'aguardando_secao',
                    data: {
                        tarefa: state.data.tarefa,
                        userId: state.data.userId,
                        listId: listaSelecionada.id,
                        listaNome: `${listaSelecionada.emoji || '📋'} ${listaSelecionada.name}`,
                        secoes
                    },
                    timestamp: Date.now()
                });

                let msg = `Seção?\n`;
                secoes.forEach((s, i) => {
                    msg += `${i + 1} ${s.emoji || '📁'} ${s.name}\n`;
                });

                await sock.sendMessage(from, { text: msg.trim() });
            }
            return;
        }

        // Aguardando escolha de seção
        if (state && state.type === 'aguardando_secao') {
            const numero = parseInt(comando);

            if (isNaN(numero) || numero < 1 || numero > state.data.secoes.length) {
                await sock.sendMessage(from, {
                    text: `❌ Responda com um número de 1 a ${state.data.secoes.length}`
                });
                return;
            }

            const secaoSelecionada = state.data.secoes[numero - 1];

            // Ir para prioridade
            conversationState.set(from, {
                type: 'aguardando_prioridade',
                data: {
                    tarefa: state.data.tarefa,
                    userId: state.data.userId,
                    listId: state.data.listId,
                    sectionId: secaoSelecionada.id,
                    secaoNome: `${secaoSelecionada.emoji || '📁'} ${secaoSelecionada.name}`
                },
                timestamp: Date.now()
            });

            await sock.sendMessage(from, {
                text: `Prioridade?\n1 🔴 Alta\n2 🟡 Média\n3 🟢 Baixa`
            });
            return;
        }

        // Aguardando escolha de prioridade
        if (state && state.type === 'aguardando_prioridade') {
            const prioridades = {
                '1': 'high',
                '2': 'medium',
                '3': 'low',
                'alta': 'high',
                'media': 'medium',
                'média': 'medium',
                'baixa': 'low'
            };

            const prioridade = prioridades[comando];

            if (!prioridade) {
                await sock.sendMessage(from, {
                    text: `1 🔴 Alta\n2 🟡 Média\n3 🟢 Baixa`
                });
                return;
            }

            // Ir para escolha de data
            conversationState.set(from, {
                type: 'aguardando_data',
                data: {
                    ...state.data,
                    prioridade
                },
                timestamp: Date.now()
            });

            await sock.sendMessage(from, {
                text: `Data?\n1 Hoje\n2 Amanhã\n3 Essa semana\n4 Próx. semana\n5 Sem data\n\n_ou digite: 15/02_`
            });
            return;
        }

        // Aguardando escolha de data
        if (state && state.type === 'aguardando_data') {
            let dueDate = null;
            const hoje = new Date();
            hoje.setHours(12, 0, 0, 0); // Meio-dia para evitar problemas de timezone

            // Opções pré-definidas
            if (comando === '1' || comando === 'hoje') {
                dueDate = hoje;
            } else if (comando === '2' || comando === 'amanha' || comando === 'amanhã') {
                dueDate = new Date(hoje);
                dueDate.setDate(dueDate.getDate() + 1);
            } else if (comando === '3' || comando === 'semana' || comando === 'esta semana') {
                // Próximo domingo
                dueDate = new Date(hoje);
                const diasAteDomingo = 7 - hoje.getDay();
                dueDate.setDate(dueDate.getDate() + (diasAteDomingo === 7 ? 7 : diasAteDomingo));
            } else if (comando === '4' || comando === 'proxima semana' || comando === 'próxima semana') {
                // Domingo da próxima semana
                dueDate = new Date(hoje);
                const diasAteDomingo = 7 - hoje.getDay() + 7;
                dueDate.setDate(dueDate.getDate() + diasAteDomingo);
            } else if (comando === '5' || comando === 'sem data' || comando === 'nenhuma' || comando === 'sem') {
                dueDate = null;
            } else {
                // Tentar parsear data no formato dd/mm ou dd/mm/aaaa
                const match = comando.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
                if (match) {
                    const dia = parseInt(match[1]);
                    const mes = parseInt(match[2]) - 1; // Mês começa em 0
                    let ano = match[3] ? parseInt(match[3]) : hoje.getFullYear();
                    if (ano < 100) ano += 2000; // 25 -> 2025

                    dueDate = new Date(ano, mes, dia, 12, 0, 0);

                    // Se a data já passou este ano, assume próximo ano
                    if (dueDate < hoje && !match[3]) {
                        dueDate.setFullYear(dueDate.getFullYear() + 1);
                    }
                } else {
                    await sock.sendMessage(from, {
                        text: `1 Hoje\n2 Amanhã\n3 Essa semana\n4 Próx. semana\n5 Sem data\n\n_ou digite: 15/02_`
                    });
                    return;
                }
            }

            // Criar a tarefa!
            const { tarefa, userId, listId, sectionId, prioridade } = state.data;

            await db.query(
                `INSERT INTO tasks (title, user_id, list_id, section_id, status, priority, due_date, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
                [tarefa, userId, listId, sectionId, 'pending', prioridade, dueDate]
            );

            // Limpar estado
            conversationState.delete(from);

            const prioridadeEmoji = prioridade === 'high' ? '🔴' : prioridade === 'medium' ? '🟡' : '🟢';
            const dataStr = dueDate ? ` 📅 ${formatarDataCurta(dueDate)}` : '';

            await sock.sendMessage(from, {
                text: `✅ *${tarefa}* ${prioridadeEmoji}${dataStr}`
            });
            return;
        }

        // ===== COMANDOS =====

        // Verificar se usuário está vinculado (busca por número ou LID)
        const lidAtual = from.includes('@lid') ? from.replace('@lid', '') : null;
        const userIdAtual = await getUserIdPorTelefone(phoneNumber, lidAtual);
        const estaVinculado = !!userIdAtual;

        if (comando === 'oi' || comando === 'olá' || comando === 'hey' || comando === 'ola' || comando === 'menu') {
            console.log('✅ Executando comando: OI');

            if (estaVinculado) {
                // Buscar config de notificação
                const configNotif = await db.query(
                    'SELECT notification_interval FROM users_whatsapp WHERE user_id = $1',
                    [userIdAtual]
                );
                const intervalo = configNotif[0]?.notification_interval;
                const statusNotif = intervalo ? `✅ A cada ${intervalo}min` : '❌ Desativado';

                await sock.sendMessage(from, {
                    text: `╔═══════════════════╗\n` +
                          `     *DIVY* — Assistente\n` +
                          `╚═══════════════════╝\n\n` +
                          `Olá! O que deseja fazer hoje?\n\n` +
                          `*📋 Tarefas*\n` +
                          `› *tarefas* — Ver pendentes\n` +
                          `› *hoje* — Tarefas de hoje\n` +
                          `› *adicionar* [nome] — Nova tarefa\n\n` +
                          `*🔔 Lembretes*\n` +
                          `› *notificar* — Configurar lembretes\n` +
                          `› *testar* — Enviar lembrete agora\n\n` +
                          `*⚙️ Status*\n` +
                          `› Lembretes: ${statusNotif}\n\n` +
                          `_Digite qualquer comando acima para começar._`
                });
            } else {
                await sock.sendMessage(from, {
                    text: `*DIVY* 📋\n\n` +
                          `Para usar o bot, vincule seu WhatsApp nas configurações do app:\n\n` +
                          `1️⃣ Acesse *divy.online*\n` +
                          `2️⃣ Vá em *Configurações*\n` +
                          `3️⃣ Na seção *WhatsApp*, insira seu número\n` +
                          `4️⃣ Digite o código recebido\n\n` +
                          `✅ Pronto! Depois é só digitar *oi* aqui.`
                });
            }
            console.log('✅ Mensagem enviada com sucesso');
        }

        // Comando de configurar notificações
        else if (comando === 'notificar' || comando === 'notificação' || comando === 'notificacao' || comando === 'lembrete') {
            console.log('✅ Executando comando: NOTIFICAR');

            if (!estaVinculado) {
                await sock.sendMessage(from, {
                    text: '❌ Vincule seu WhatsApp primeiro!\n\nAcesse as *Configurações* no app divy.online'
                });
                return;
            }

            // Buscar configuração atual
            const configAtual = await db.query(
                'SELECT notification_interval FROM users_whatsapp WHERE user_id = $1',
                [userIdAtual]
            );
            const intervaloAtual = configAtual[0]?.notification_interval;
            const statusAtual = intervaloAtual ? `✅ A cada ${intervaloAtual} minutos` : '❌ Desativado';

            // Salvar estado aguardando escolha
            conversationState.set(from, {
                type: 'aguardando_notificacao',
                data: { userId: userIdAtual },
                timestamp: Date.now()
            });

            await sock.sendMessage(from, {
                text: `🔔 *Lembretes de Tarefas*\n\n` +
                      `Status atual: ${statusAtual}\n\n` +
                      `Escolha o intervalo:\n` +
                      `1️⃣ A cada 1 hora\n` +
                      `2️⃣ A cada 2 horas\n` +
                      `3️⃣ A cada 3 horas\n` +
                      `4️⃣ A cada 4 horas\n` +
                      `0️⃣ Desativar\n\n` +
                      `_Responda com o número_`
            });
        }

        // Comando de teste de notificação
        else if (comando === 'testar' || comando === 'teste') {
            console.log('✅ Executando comando: TESTAR');

            if (!estaVinculado) {
                await sock.sendMessage(from, {
                    text: '❌ Vincule seu WhatsApp primeiro!\n\nAcesse as *Configurações* no app divy.online'
                });
                return;
            }

            await sock.sendMessage(from, {
                text: '⏳ Enviando notificação de teste...'
            });

            // Aguardar 3 segundos e enviar notificação
            setTimeout(async () => {
                const tarefas = await getTarefasPorPrioridade(userIdAtual);

                if (tarefas.total === 0) {
                    await sock.sendMessage(from, {
                        text: '✅ Funcionando! Você não tem tarefas pendentes. 🎉'
                    });
                } else {
                    const mensagem = formatarMensagemMotivacional('', tarefas);
                    await sock.sendMessage(from, { text: mensagem });
                }
                console.log('✅ Notificação de teste enviada via comando!');
            }, 3000);
        }

        else if (comando === 'tarefas') {
            console.log('✅ Executando comando: TAREFAS');

            if (!estaVinculado) {
                await sock.sendMessage(from, {
                    text: '❌ Vincule seu WhatsApp primeiro!\n\nAcesse as *Configurações* no app divy.online'
                });
                return;
            }

            console.log('📱 Telefone sendo usado:', phoneNumber);

            const resultado = await getTarefasPorTelefone(phoneNumber);

            console.log('📊 Tarefas retornadas:', resultado.total);

            if (resultado.total === 0) {
                await sock.sendMessage(from, {
                    text: '📋 Você não tem tarefas! 🎉\n\nDigite *adicionar [tarefa]* para criar uma.'
                });
            } else {
                const mensagem = formatarListaTarefas(resultado);
                await sock.sendMessage(from, { text: mensagem });

                // Se tem mais tarefas pendentes que não foram mostradas, perguntar
                if (resultado.pendentes.length > 10) {
                    // Salvar estado esperando resposta
                    conversationState.set(from, {
                        type: 'aguardando_ver_todas',
                        data: resultado.pendentes,
                        timestamp: Date.now()
                    });

                    await sock.sendMessage(from, {
                        text: `📝 Quer ver *todas* as ${resultado.pendentes.length} tarefas pendentes?`
                    });
                }
            }
        }
        
        else if (comando.startsWith('adicionar ')) {
            console.log('✅ Executando comando: ADICIONAR');

            if (!estaVinculado) {
                await sock.sendMessage(from, {
                    text: '❌ Vincule seu WhatsApp primeiro!\n\nAcesse as *Configurações* no app divy.online'
                });
                return;
            }

            const tarefa = text.substring(10).trim();

            console.log('📝 Tarefa:', tarefa);

            if (!tarefa) {
                await sock.sendMessage(from, {
                    text: '❌ Use: *adicionar [tarefa]*\nEx: adicionar Comprar café'
                });
                return;
            }

            const userId = userIdAtual;

            // Buscar todas as listas do usuário
            const listas = await db.query(
                `SELECT id, name, emoji FROM lists WHERE user_id = $1 ORDER BY position`,
                [userId]
            );

            if (listas.length === 0) {
                // Criar lista padrão se não existir
                const novaLista = await db.query(
                    `INSERT INTO lists (user_id, name, emoji, color, is_default, position)
                     VALUES ($1, 'Tarefas', '📋', '#146551', true, 0) RETURNING id`,
                    [userId]
                );

                // Salvar tarefa direto na lista criada
                await db.query(
                    `INSERT INTO tasks (title, user_id, list_id, status, priority, created_at)
                     VALUES ($1, $2, $3, $4, $5, NOW())`,
                    [tarefa, userId, novaLista[0].id, 'pending', 'medium']
                );

                await sock.sendMessage(from, {
                    text: `✅ Tarefa criada: *${tarefa}*`
                });
                return;
            }

            // Se só tem uma lista, perguntar direto a seção
            if (listas.length === 1) {
                const lista = listas[0];

                // Buscar seções da lista
                const secoes = await db.query(
                    `SELECT id, name, emoji FROM sections WHERE list_id = $1 ORDER BY position`,
                    [lista.id]
                );

                if (secoes.length <= 1) {
                    // Sem seções ou só uma, perguntar prioridade direto
                    conversationState.set(from, {
                        type: 'aguardando_prioridade',
                        data: {
                            tarefa,
                            userId,
                            listId: lista.id,
                            sectionId: secoes.length === 1 ? secoes[0].id : null
                        },
                        timestamp: Date.now()
                    });

                    await sock.sendMessage(from, {
                        text: `*${tarefa}*\nPrioridade?\n1 🔴 Alta\n2 🟡 Média\n3 🟢 Baixa`
                    });
                } else {
                    // Tem seções, perguntar qual
                    conversationState.set(from, {
                        type: 'aguardando_secao',
                        data: {
                            tarefa,
                            userId,
                            listId: lista.id,
                            secoes
                        },
                        timestamp: Date.now()
                    });

                    let msg = `*${tarefa}*\nSeção?\n`;
                    secoes.forEach((s, i) => {
                        msg += `${i + 1} ${s.emoji || '📁'} ${s.name}\n`;
                    });

                    await sock.sendMessage(from, { text: msg.trim() });
                }
            } else {
                // Múltiplas listas, perguntar qual
                conversationState.set(from, {
                    type: 'aguardando_lista',
                    data: {
                        tarefa,
                        userId,
                        listas
                    },
                    timestamp: Date.now()
                });

                let msg = `*${tarefa}*\nLista?\n`;
                listas.forEach((l, i) => {
                    msg += `${i + 1} ${l.emoji || '📋'} ${l.name}\n`;
                });

                await sock.sendMessage(from, { text: msg.trim() });
            }
        }
        
        else if (comando === 'hoje') {
            console.log('✅ Executando comando: HOJE');

            if (!estaVinculado) {
                await sock.sendMessage(from, {
                    text: '❌ Vincule seu WhatsApp primeiro!\n\nAcesse as *Configurações* no app divy.online'
                });
                return;
            }

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
                    text: '📅 Nenhuma tarefa para hoje!'
                });
            } else {
                let mensagem = '📅 *Hoje:*\n\n';

                tarefas.forEach((t, i) => {
                    const prioridade = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
                    const nome = t.title || t.name || 'Sem título';
                    mensagem += `${i + 1}. ${prioridade} ${nome}\n`;
                });

                await sock.sendMessage(from, { text: mensagem });
            }
        }
        
        else if (comando === 'ajuda' || comando === 'help') {
            console.log('✅ Executando comando: AJUDA');

            if (estaVinculado) {
                await sock.sendMessage(from, {
                    text: `╔═══════════════════╗\n` +
                          `     *DIVY* — Ajuda\n` +
                          `╚═══════════════════╝\n\n` +
                          `*📋 Tarefas*\n` +
                          `› *tarefas* — Ver tarefas pendentes\n` +
                          `› *hoje* — Tarefas com prazo hoje\n` +
                          `› *adicionar* [nome] — Criar nova tarefa\n\n` +
                          `*🔔 Lembretes*\n` +
                          `› *notificar* — Configurar intervalo\n` +
                          `› *testar* — Enviar lembrete agora\n\n` +
                          `_Acesse divy.online para gerenciar tudo pelo app._`
                });
            } else {
                await sock.sendMessage(from, {
                    text: `*DIVY* 📋\n\n` +
                          `Para usar o bot, vincule seu WhatsApp nas configurações do app:\n\n` +
                          `🌐 Acesse *divy.online*\n` +
                          `⚙️ Vá em *Configurações > WhatsApp*`
                });
            }
        }

        else {
            console.log('⚠️ Comando não reconhecido');
            await sock.sendMessage(from, {
                text: '❓ Comando não reconhecido.\nDigite *oi* para ver o menu.'
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

    if (!userId) return { pendentes: [], concluidas: [], total: 0 };

    // Buscar tarefas pendentes
    const pendentes = await db.query(
        `SELECT * FROM tasks
         WHERE user_id = $1
           AND status NOT IN ('completed', 'concluido')
           AND (deleted_at IS NULL)
         ORDER BY
           CASE WHEN priority = 'high' THEN 1
                WHEN priority = 'medium' THEN 2
                ELSE 3 END,
           due_date ASC NULLS LAST`,
        [userId]
    );

    // Buscar tarefas concluídas (últimas 30 dias)
    const concluidas = await db.query(
        `SELECT * FROM tasks
         WHERE user_id = $1
           AND status IN ('completed', 'concluido')
           AND (deleted_at IS NULL)
           AND (completed_at IS NULL OR completed_at > NOW() - INTERVAL '30 days')
         ORDER BY completed_at DESC NULLS LAST
         LIMIT 50`,
        [userId]
    );

    console.log('📊 Tarefas encontradas - Pendentes:', pendentes.length, 'Concluídas:', concluidas.length);

    return {
        pendentes,
        concluidas,
        total: pendentes.length + concluidas.length
    };
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

async function getUserIdPorTelefone(telefone, lid = null) {
    try {
        // Criar variações do número (com/sem 9)
        let telefoneVariacoes = [telefone];

        if (telefone && telefone.length === 12) {
            telefoneVariacoes.push(telefone.slice(0, 4) + '9' + telefone.slice(4));
        }
        if (telefone && telefone.length === 13 && telefone[4] === '9') {
            telefoneVariacoes.push(telefone.slice(0, 4) + telefone.slice(5));
        }

        // Adicionar números pendentes de associação de LID
        for (const [numero] of pendingLidAssociations.entries()) {
            if (!telefoneVariacoes.includes(numero)) {
                telefoneVariacoes.push(numero);
            }
        }

        const ultimos8 = telefone ? telefone.slice(-8) : '';

        const result = await db.query(
            `SELECT user_id, phone_number FROM users_whatsapp
             WHERE phone_number = ANY($1)
                OR whatsapp_lid = $2
                OR phone_number LIKE $3`,
            [telefoneVariacoes, lid || telefone, '%' + ultimos8]
        );

        if (result.length > 0) {
            // Atualizar LID se necessário
            if (lid && result[0].phone_number) {
                pendingLidAssociations.delete(result[0].phone_number);
                try {
                    await db.query(
                        'UPDATE users_whatsapp SET whatsapp_lid = $1 WHERE phone_number = $2',
                        [lid, result[0].phone_number]
                    );
                } catch (updateErr) {
                    // Ignorar erro
                }
            }
            return result[0].user_id;
        }

        // Se não encontrou e temos um LID, verificar se há algum número pendente de associação
        // que foi vinculado recentemente (últimos 30 minutos)
        // Verificar números pendentes de associação de LID
        if (lid && pendingLidAssociations.size > 0) {
            const numerosPendentes = Array.from(pendingLidAssociations.keys());
            const resultPendente = await db.query(
                `SELECT user_id, phone_number FROM users_whatsapp
                 WHERE phone_number = ANY($1)
                   AND created_at > NOW() - INTERVAL '30 minutes'
                 ORDER BY created_at DESC
                 LIMIT 1`,
                [numerosPendentes]
            );

            if (resultPendente.length > 0) {
                try {
                    await db.query(
                        'UPDATE users_whatsapp SET whatsapp_lid = $1 WHERE phone_number = $2',
                        [lid, resultPendente[0].phone_number]
                    );
                    pendingLidAssociations.delete(resultPendente[0].phone_number);
                } catch (updateErr) {
                    // Ignorar erro
                }
                return resultPendente[0].user_id;
            }
        }

        return null;
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

// Formata lista de tarefas no novo design
function formatarListaTarefas(resultado) {
    const { pendentes, concluidas, total } = resultado;

    // Separar por categoria
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const urgentes = []; // Alta prioridade ou atrasadas
    const deHoje = [];   // Tarefas de hoje
    const outras = [];   // Outras pendentes

    pendentes.forEach(t => {
        const nome = t.title || t.name || 'Sem título';
        let dataFormatada = '';
        let dataObj = null;

        if (t.due_date) {
            const dueDate = new Date(t.due_date);
            dueDate.setHours(0, 0, 0, 0);

            // Ignorar tarefas vencidas (antes de hoje)
            if (dueDate < hoje) {
                return;
            }

            dataFormatada = formatarDataCurta(t.due_date);
            dataObj = dueDate;

            // Verificar se é urgente (alta prioridade)
            if (t.priority === 'high') {
                urgentes.push({ nome, data: dataFormatada, dataObj });
            }
            // Verificar se é de hoje
            else if (dueDate.getTime() === hoje.getTime()) {
                deHoje.push({ nome, data: dataFormatada, dataObj });
            }
            // Outras com data
            else {
                outras.push({ nome, data: dataFormatada, dataObj });
            }
        } else {
            // Sem data - vai para urgentes se alta prioridade, senão outras
            if (t.priority === 'high') {
                urgentes.push({ nome, data: '', dataObj: null });
            } else {
                outras.push({ nome, data: '', dataObj: null });
            }
        }
    });

    // Ordenar cada categoria por data (mais antiga primeiro, sem data por último)
    const ordenarPorData = (a, b) => {
        if (!a.dataObj && !b.dataObj) return 0;
        if (!a.dataObj) return 1;
        if (!b.dataObj) return -1;
        return a.dataObj - b.dataObj;
    };

    urgentes.sort(ordenarPorData);
    deHoje.sort(ordenarPorData);
    outras.sort(ordenarPorData);

    // Calcular total de tarefas ativas (sem vencidas)
    const totalAtivas = urgentes.length + deHoje.length + outras.length + concluidas.length;

    // Montar mensagem
    let msg = `📋 *Suas Tarefas* (${totalAtivas})\n\n`;

    // Urgentes
    if (urgentes.length > 0) {
        msg += `🔴 *Urgentes (${urgentes.length}):*\n`;
        urgentes.slice(0, 5).forEach(t => {
            msg += `• ${t.nome}`;
            if (t.data) msg += ` - ${t.data}`;
            msg += '\n';
        });
        if (urgentes.length > 5) {
            msg += `_... e mais ${urgentes.length - 5}_\n`;
        }
        msg += '\n';
    }

    // Hoje
    if (deHoje.length > 0) {
        msg += `🟡 *Hoje (${deHoje.length}):*\n`;
        deHoje.slice(0, 5).forEach(t => {
            msg += `• ${t.nome}\n`;
        });
        if (deHoje.length > 5) {
            msg += `_... e mais ${deHoje.length - 5}_\n`;
        }
        msg += '\n';
    }

    // Outras pendentes (mostrar até 4)
    if (outras.length > 0) {
        msg += `🟠 *Outras pendentes (${outras.length}):*\n`;
        outras.slice(0, 4).forEach(t => {
            msg += `• ${t.nome}`;
            if (t.data) msg += ` - ${t.data}`;
            msg += '\n';
        });
        if (outras.length > 4) {
            msg += `_... e mais ${outras.length - 4}_\n`;
        }
        msg += '\n';
    }

    // Concluídas
    if (concluidas.length > 0) {
        msg += `🟢 *Concluídas (${concluidas.length})*`;
    }

    return msg;
}

// Formata data em formato curto (dd/mmm)
function formatarDataCurta(data) {
    if (!data) return '';
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const d = new Date(data);
    return `${d.getDate().toString().padStart(2, '0')}/${meses[d.getMonth()]}`;
}

// Formata TODAS as tarefas pendentes (lista completa)
function formatarTodasTarefas(pendentes) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Separar por prioridade
    const urgentes = [];
    const medias = [];
    const baixas = [];

    pendentes.forEach(t => {
        const nome = t.title || t.name || 'Sem título';
        let dataStr = '';
        let vencida = false;

        if (t.due_date) {
            const dueDate = new Date(t.due_date);
            dueDate.setHours(0, 0, 0, 0);
            dataStr = ` - ${formatarDataCurta(t.due_date)}`;
            vencida = dueDate < hoje;
        }

        const item = { nome, dataStr, vencida, dueDate: t.due_date ? new Date(t.due_date) : null };

        if (t.priority === 'high') {
            urgentes.push(item);
        } else if (t.priority === 'medium') {
            medias.push(item);
        } else {
            baixas.push(item);
        }
    });

    // Ordenar cada grupo: vencidas primeiro (por data), depois não vencidas (por data)
    const ordenar = (a, b) => {
        // Vencidas primeiro
        if (a.vencida && !b.vencida) return -1;
        if (!a.vencida && b.vencida) return 1;
        // Depois por data
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate - b.dueDate;
    };

    urgentes.sort(ordenar);
    medias.sort(ordenar);
    baixas.sort(ordenar);

    const total = urgentes.length + medias.length + baixas.length;
    let msg = `📋 *Todas as Tarefas Pendentes* (${total})\n\n`;
    let contador = 1;

    // Urgentes
    if (urgentes.length > 0) {
        msg += `*URGENTES:*\n`;
        urgentes.forEach(t => {
            const emoji = t.vencida ? '⚪' : '🔴';
            msg += `${contador}. ${emoji} ${t.nome}${t.dataStr}\n`;
            contador++;
        });
        msg += '\n';
    }

    // Médias
    if (medias.length > 0) {
        msg += `*MÉDIAS:*\n`;
        medias.forEach(t => {
            const emoji = t.vencida ? '⚪' : '🟡';
            msg += `${contador}. ${emoji} ${t.nome}${t.dataStr}\n`;
            contador++;
        });
        msg += '\n';
    }

    // Baixas
    if (baixas.length > 0) {
        msg += `*BAIXAS:*\n`;
        baixas.forEach(t => {
            const emoji = t.vencida ? '⚪' : '🟢';
            msg += `${contador}. ${emoji} ${t.nome}${t.dataStr}\n`;
            contador++;
        });
    }

    msg += `\n💡 Digite *adicionar [tarefa]* para criar novas tarefas.`;

    return msg;
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

// ===== SISTEMA DE NOTIFICAÇÕES AUTOMÁTICAS =====
// Rastrear última notificação de cada usuário
const ultimaNotificacao = new Map();

async function verificarEEnviarNotificacoes() {
    if (!sock) {
        console.log('❌ WhatsApp não conectado');
        return;
    }

    const agora = Date.now();

    try {
        // Buscar usuários com notificações ativadas
        const usuarios = await db.query(`
            SELECT uw.phone_number, uw.user_id, u.name, uw.notification_interval
            FROM users_whatsapp uw
            JOIN users u ON u.id = uw.user_id
            WHERE uw.notification_interval IS NOT NULL
        `);

        if (usuarios.length === 0) {
            return;
        }

        console.log(`🔔 Verificando notificações para ${usuarios.length} usuário(s)...`);

        for (const usuario of usuarios) {
            try {
                const intervaloMs = usuario.notification_interval * 60 * 1000; // Converter minutos para ms
                const ultimaEnviada = ultimaNotificacao.get(usuario.user_id) || 0;
                const tempoDesdeUltima = agora - ultimaEnviada;

                // Verificar se passou o intervalo
                if (tempoDesdeUltima < intervaloMs) {
                    const faltam = Math.round((intervaloMs - tempoDesdeUltima) / 60000);
                    console.log(`⏳ ${usuario.phone_number}: próxima em ${faltam}min`);
                    continue;
                }

                const tarefas = await getTarefasPorPrioridade(usuario.user_id);

                if (tarefas.total > 0) {
                    const mensagem = formatarMensagemMotivacional(usuario.name, tarefas);

                    await sock.sendMessage(
                        `${usuario.phone_number}@s.whatsapp.net`,
                        { text: mensagem }
                    );

                    // Atualizar timestamp
                    ultimaNotificacao.set(usuario.user_id, agora);

                    console.log(`✅ Notificação enviada para ${usuario.phone_number}`);

                    // Delay de 3 segundos entre mensagens
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            } catch (err) {
                console.error(`❌ Erro ao enviar para ${usuario.phone_number}:`, err.message);
            }
        }
    } catch (error) {
        console.error('❌ Erro nas notificações:', error);
    }
}

// ===== INICIAR BOT =====
console.log('🤖 Iniciando bot WhatsApp...');
connectToWhatsApp().catch(err => {
    console.error('❌ Erro ao conectar WhatsApp:', err);
});

// Sistema de notificações - verifica a cada 5 minutos
setTimeout(() => {
    console.log('🔔 Sistema de lembretes iniciado!');

    // Verificar a cada 5 minutos se algum usuário precisa de notificação
    setInterval(() => {
        verificarEEnviarNotificacoes();
    }, 5 * 60 * 1000); // 5 minutos

    // Primeira verificação após 1 minuto
    setTimeout(() => {
        verificarEEnviarNotificacoes();
    }, 60000);

}, 30000); // Aguarda 30s após iniciar o bot

// Função para registrar número aguardando associação de LID
function registerPendingLid(phoneNumber) {
    console.log('📝 Registrando número para associação de LID:', phoneNumber);
    pendingLidAssociations.set(phoneNumber, {
        timestamp: Date.now()
    });
}

// Exporta o socket e as funções
module.exports = {
    get sock() { return sock; },
    enviarResumoDiarioWhatsApp,
    verificarEEnviarNotificacoes,
    registerPendingLid
};
