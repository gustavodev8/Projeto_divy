# 🔧 Troubleshooting - DIVY Mobile

## Problema: `expo não é reconhecido como comando`

**Causa:** As dependências não foram instaladas corretamente.

**Solução:**
```bash
# 1. Limpar tudo
cd mobile
rm -rf node_modules package-lock.json

# 2. Limpar cache npm
npm cache clean --force

# 3. Reinstalar
npm install

# 4. Testar
npm start
```

---

## Problema: `Cannot find module './Errors'`

**Causa:** Instalação corrompida do Expo.

**Solução:** Mesmo do item acima - limpar e reinstalar.

---

## Problema: Erro `ENOTEMPTY` ao instalar

**Causa:** Processo travado ou antivírus bloqueando.

**Solução:**
```bash
# Fechar todos os terminais
# Deletar manualmente a pasta node_modules
# Reinstalar
npm install
```

---

## Problema: QR Code não aparece

**Causa:** Firewall bloqueando.

**Solução:**
```bash
# Usar tunnel do Expo
npm start -- --tunnel
```

---

## Problema: App não conecta com backend local

**Causa:** Backend não está rodando OU URL errada.

**Verificar:**
1. Backend está rodando? `http://localhost:3000`
2. Celular está na mesma rede WiFi?

**Solução:**
Se estiver usando celular físico, troque no `api.js`:
```javascript
const API_URL = __DEV__
  ? 'http://SEU_IP_LOCAL:3000'  // Ex: 192.168.1.100:3000
  : 'https://projeto-divy.onrender.com';
```

Para descobrir seu IP local:
- Windows: `ipconfig` (procure IPv4)
- Mac/Linux: `ifconfig`

---

## Como rodar o app?

### Desenvolvimento (Expo Go)
```bash
cd mobile
npm start
```

Escanear QR Code com:
- **Android:** Expo Go
- **iOS:** Câmera do iPhone

### Build para produção

**Android (APK):**
```bash
npx expo build:android
```

**iOS (precisa de Mac):**
```bash
npx expo build:ios
```

---

## Deploy / Hospedagem

### ❌ NÃO rodar mobile no Render!

O Render hospeda apenas o **backend**. O app mobile funciona assim:

```
Backend (Render) ←→ App Mobile (Celular do usuário)
```

### Para distribuir o app:

1. **Para testar:** Expo Go (agora)
2. **Para SENAI:** Expo Go no seu celular
3. **Para produção:**
   - Build APK (Android)
   - Publicar na Play Store
   - OU distribuir APK direto

### Para apresentação no SENAI:

Você vai mostrar:
- ✅ Web rodando no Render (navegador)
- ✅ Mobile rodando no seu celular (Expo Go)
- ✅ WhatsApp Bot integrado (backend)

**Tudo usando o mesmo backend!**

---

## Comandos úteis

```bash
# Iniciar Expo
npm start

# Limpar cache Expo
npx expo start -c

# Ver logs
npx expo start --dev-client

# Build Android
npx expo build:android

# Atualizar Expo
npm install expo@latest

# Ver versão
npx expo --version
```
