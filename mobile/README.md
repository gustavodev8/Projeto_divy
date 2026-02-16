# DIVY Mobile App

App mobile do Divy construído com React Native + Expo.

## 🚀 Como rodar

### Pré-requisitos
- Node.js instalado
- Expo Go no celular (Android/iOS)
- Backend rodando em `http://localhost:3000`

### Instalação

```bash
# Entrar na pasta mobile
cd mobile

# Instalar dependências
npm install

# Iniciar o servidor Expo
npm start
```

### Testar no celular

1. Instale o app **Expo Go** no seu celular:
   - Android: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - iOS: [App Store](https://apps.apple.com/br/app/expo-go/id982107779)

2. Execute `npm start` na pasta `mobile/`

3. Escaneie o QR Code que aparece no terminal com o Expo Go

## 📱 Telas Implementadas

- ✅ Login
- ✅ Registro (com verificação por código)
- ✅ Home (placeholder)

## 🔌 Integração com Backend

O app usa a mesma API REST do backend web:
- **Desenvolvimento**: `http://localhost:3000`
- **Produção**: `https://projeto-divy.onrender.com`

### Endpoints usados
- `POST /v1/auth/login` - Login
- `POST /v1/auth/send-code` - Enviar código de verificação
- `POST /v1/auth/verify-code` - Verificar código
- `GET /v1/tarefas` - Listar tarefas (em breve)

## 📦 Dependências Principais

- **expo** - Framework React Native
- **@react-navigation** - Navegação
- **axios** - Cliente HTTP
- **@react-native-async-storage** - Armazenamento local

## 🎨 Tema

O app usa o mesmo tema azul e branco do web:
- Primary: `#3b82f6`
- Background: `#ffffff`
- Texto: `#111827`

---

**Próximos passos:**
- [ ] Implementar tela de listagem de tarefas
- [ ] Criar/editar/deletar tarefas
- [ ] Integração com WhatsApp bot
- [ ] Notificações push
