# 🏗️ Arquitetura do Projeto DIVY

## Visão Geral

O DIVY é um sistema de gerenciamento de tarefas com 3 interfaces:
- 📱 **App Mobile** (React Native + Expo)
- 🌐 **Web** (HTML/CSS/JS)
- 💬 **WhatsApp Bot** (Baileys)

Todos compartilham o **mesmo backend**.

---

## Diagrama da Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    RENDER.COM (Servidor)                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Backend (Node.js + Express)               │  │
│  │                                                         │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐ │  │
│  │  │   API REST  │  │   Database   │  │ WhatsApp Bot │ │  │
│  │  │             │  │   SQLite     │  │   Baileys    │ │  │
│  │  │ /v1/auth/*  │  │              │  │              │ │  │
│  │  │ /v1/tarefas │  │ users        │  │ QR Code      │ │  │
│  │  │ /v1/whatsapp│  │ tasks        │  │ Mensagens    │ │  │
│  │  └─────────────┘  └──────────────┘  └──────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
              ↑                    ↑                    ↑
              │                    │                    │
    ┌─────────┴──────┐   ┌────────┴────────┐   ┌──────┴──────┐
    │   WEB CLIENT   │   │  MOBILE CLIENT  │   │  WHATSAPP   │
    │                │   │                 │   │             │
    │   Browser      │   │  React Native   │   │  Usuário    │
    │   HTML/CSS/JS  │   │  Expo           │   │  Celular    │
    │                │   │                 │   │             │
    │  Login         │   │  Login          │   │  /minhas    │
    │  Tarefas       │   │  Tarefas        │   │  /criar     │
    │  Perfil        │   │  Perfil         │   │  /ajuda     │
    └────────────────┘   └─────────────────┘   └─────────────┘
```

---

## Componentes

### 1. Backend (Servidor)

**Localização:** Raiz do projeto
**Hospedagem:** Render.com
**Tecnologias:**
- Node.js + Express
- SQLite (database.js)
- Baileys (WhatsApp Bot)
- JWT para autenticação

**Arquivos principais:**
- `server.js` - Servidor principal
- `database.js` - Conexão com banco
- `whatsapp-bot.js` - Bot WhatsApp
- `routes/v1/*` - Rotas da API

**Endpoints:**
```
POST   /v1/auth/login          - Login
POST   /v1/auth/send-code      - Enviar código verificação
POST   /v1/auth/verify-code    - Verificar código
GET    /v1/tarefas             - Listar tarefas
POST   /v1/tarefas             - Criar tarefa
PUT    /v1/tarefas/:id         - Atualizar tarefa
DELETE /v1/tarefas/:id         - Deletar tarefa
GET    /v1/whatsapp/status     - Status do WhatsApp
```

---

### 2. Web Client

**Localização:** `public/`
**URL:** https://projeto-divy.onrender.com
**Tecnologias:**
- HTML5
- CSS3 (design moderno azul/branco)
- JavaScript vanilla
- Fetch API para comunicação

**Páginas:**
- `Tela_Login.html` - Login
- `Tela_CriaConta.html` - Registro
- `Tela_Inicial.html` - Dashboard
- `Tela_Gerenciamento.html` - Tarefas
- `Tela_Ajustes.html` - Configurações

**Deploy:** Automático via GitHub → Render

---

### 3. Mobile Client

**Localização:** `mobile/`
**Tecnologias:**
- React Native
- Expo
- React Navigation
- Axios
- AsyncStorage

**Estrutura:**
```
mobile/
├── src/
│   ├── screens/        - Telas
│   ├── services/       - API calls
│   ├── contexts/       - Estado global
│   ├── navigation/     - Navegação
│   └── styles/         - Tema
└── App.js
```

**Como rodar:**
```bash
cd mobile
npm install
npm start
# Escanear QR Code no Expo Go
```

**Deploy:** NÃO vai no Render!
- Desenvolvimento: Expo Go
- Produção: Build APK/IPA

---

### 4. WhatsApp Bot

**Localização:** `whatsapp-bot.js`
**Tecnologia:** Baileys (WhatsApp Web API)
**Funcionalidades:**
- Vincular número com conta
- Receber comandos (`/minhas`, `/criar`)
- Notificações de tarefas

**Como usar:**
1. QR Code gerado ao iniciar servidor
2. Escanear com WhatsApp
3. Enviar comandos

---

## Fluxo de Dados

### Login (Web/Mobile → Backend)

```
1. Usuário digita email/senha
2. Cliente → POST /v1/auth/login
3. Backend valida credenciais
4. Backend retorna JWT token
5. Cliente salva token (localStorage/AsyncStorage)
6. Token incluído em todas as próximas requisições
```

### Criar Tarefa (Mobile → Backend → WhatsApp)

```
1. Usuário cria tarefa no app
2. Mobile → POST /v1/tarefas
3. Backend salva no SQLite
4. Backend notifica via WhatsApp (se vinculado)
5. Backend retorna sucesso
6. Mobile atualiza lista
```

---

## Autenticação

**JWT (JSON Web Token)**

```javascript
// Header de todas as requisições autenticadas
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Flow:**
1. Login → Recebe token
2. Token salvo localmente
3. Token enviado em todas as requests
4. Backend valida token
5. Se inválido → 401 Unauthorized

---

## Banco de Dados

**SQLite** (`nura.db`)

**Tabelas:**
- `users` - Usuários
- `tasks` - Tarefas
- `whatsapp_links` - Vínculos WhatsApp

**Relacionamentos:**
```
users (1) ←→ (N) tasks
users (1) ←→ (1) whatsapp_links
```

---

## Ambiente de Desenvolvimento

### Variáveis de Ambiente (.env)

```env
PORT=3000
JWT_SECRET=sua_chave_secreta
GEMINI_API_KEY=sua_api_key
NODE_ENV=development
```

### Scripts úteis

```bash
# Backend
npm start                # Iniciar servidor

# Mobile
cd mobile
npm start                # Iniciar Expo
npm run android          # Build Android
npm run ios              # Build iOS
```

---

## Deploy

### Backend (Render)
- Build: `npm install`
- Start: `node server.js`
- Auto-deploy via GitHub
- URL: https://projeto-divy.onrender.com

### Web
- Servido pelo backend (pasta `public/`)
- Mesmo deploy do backend

### Mobile
- NÃO vai no Render
- Desenvolvimento: Expo Go
- Produção: Build APK/IPA

---

## Segurança

- ✅ JWT para autenticação
- ✅ Senhas hasheadas (bcrypt)
- ✅ CORS configurado
- ✅ Rate limiting em rotas sensíveis
- ✅ Validação de inputs
- ⚠️ HTTPS em produção (Render)

---

## Próximos Passos

- [ ] Implementar tela de tarefas no mobile
- [ ] Push notifications
- [ ] Sincronização real-time
- [ ] Testes automatizados
- [ ] CI/CD pipeline
