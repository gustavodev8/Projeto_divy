# 🚀 Como rodar o app mobile DIVY

## ✅ Pré-requisitos

1. **Node.js** instalado
2. **Expo Go** no celular:
   - [Android - Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - [iOS - App Store](https://apps.apple.com/br/app/expo-go/id982107779)

---

## 📱 Passo a passo

### 1. Instalar dependências (só a primeira vez)

```bash
cd mobile
npm install
```

### 2. Iniciar o servidor Expo

```bash
npm start
```

**Vai aparecer:**
```
› Metro waiting on exp://192.168.1.100:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)
```

### 3. Abrir no celular

**Android:**
1. Abra o app **Expo Go**
2. Toque em **"Scan QR Code"**
3. Escaneie o QR Code que apareceu no terminal

**iOS:**
1. Abra o app **Câmera** do iPhone
2. Aponte para o QR Code
3. Toque na notificação que aparecer

**Importante:** Celular e PC devem estar na **mesma rede WiFi**!

---

## 🔧 Se der problema

### Problema: `expo não é reconhecido`

```bash
# Limpar tudo
rm -rf node_modules package-lock.json

# Reinstalar
npm install

# Tentar novamente
npm start
```

### Problema: QR Code não funciona

```bash
# Usar tunnel do Expo
npm start -- --tunnel
```

### Problema: Não conecta com backend

**Backend está rodando?**
```bash
# Em outro terminal, na pasta raiz
node server.js
```

Deve aparecer: `Servidor rodando na porta 3000`

### Problema: Firewall bloqueando

1. Libere a porta 8081 no firewall
2. OU use tunnel: `npm start -- --tunnel`

---

## 🎯 Testando o app

1. **Login:**
   - Email: (qualquer conta criada no web)
   - Senha: (sua senha)

2. **Criar conta:**
   - Preencha nome, email, senha
   - Receberá código por email
   - Digite o código de 6 dígitos

3. **Home:**
   - Placeholder por enquanto
   - Logout funciona

---

## 🌐 Backend (deve estar rodando)

**Desenvolvimento local:**
```
http://localhost:3000
```

**Produção (Render):**
```
https://projeto-divy.onrender.com
```

O app detecta automaticamente qual usar!

---

## 📊 Status das telas

- ✅ **Login** - Funcional
- ✅ **Registro** - Funcional (2 steps)
- 🟡 **Home** - Placeholder
- ⏳ **Tarefas** - Em breve
- ⏳ **Perfil** - Em breve

---

## 🆘 Comandos úteis

```bash
# Iniciar
npm start

# Limpar cache
npx expo start -c

# Ver logs
npx expo start --dev-client

# Parar
Ctrl + C
```

---

## ✨ Pronto!

Se tudo deu certo, você verá a tela de login no celular! 🎉

**Próximos passos:**
- Criar conta ou fazer login
- Testar sincronização com web
- Aguardar implementação das tarefas
