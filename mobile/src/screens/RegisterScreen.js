/**
 * DIVY - Register Screen
 * Tela de registro com verificação por código (2 steps)
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../contexts/AuthContext';
import authService from '../services/authService';
import theme from '../styles/theme';

const RegisterScreen = ({ navigation }) => {
  // Step 1: Formulário
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Step 2: Código
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);

  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

  // Step 1: Enviar código
  const handleSendCode = async () => {
    if (!name || !email || !password) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);
    const result = await authService.sendVerificationCode(name, email, password);
    setLoading(false);

    if (result.success) {
      setStep(2);
      // Focar no primeiro input
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 300);
    } else {
      Alert.alert('Erro', result.error || 'Erro ao enviar código');
    }
  };

  // Step 2: Verificar código
  const handleVerifyCode = async () => {
    const fullCode = code.join('');

    if (fullCode.length !== 6) {
      Alert.alert('Erro', 'Digite o código completo de 6 dígitos');
      return;
    }

    setLoading(true);
    const result = await signUp(email, fullCode);
    setLoading(false);

    if (!result.success) {
      Alert.alert('Erro', result.error || 'Código inválido');
    }
  };

  // Manipular input de código
  const handleCodeChange = (value, index) => {
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focar no próximo input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Voltar para step 1
  const goBackToStep1 = () => {
    setStep(1);
    setCode(['', '', '', '', '', '']);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>DIVY</Text>
          <Text style={styles.subtitle}>
            {step === 1 ? 'Crie sua conta' : 'Verificar email'}
          </Text>
        </View>

        {/* STEP 1: Formulário */}
        {step === 1 && (
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Nome de usuário</Text>
              <TextInput
                style={styles.input}
                placeholder="Seu nome de usuário"
                value={name}
                onChangeText={setName}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="seu@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Senha</Text>
              <TextInput
                style={styles.input}
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSendCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Criar conta</Text>
              )}
            </TouchableOpacity>

            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Já tem uma conta? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.signupLink}>Fazer login</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* STEP 2: Verificação */}
        {step === 2 && (
          <View style={styles.form}>
            <Text style={styles.verifyText}>
              Digite o código de 6 dígitos enviado para{'\n'}
              <Text style={styles.emailText}>{email}</Text>
            </Text>

            <View style={styles.codeContainer}>
              {code.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (inputRefs.current[index] = ref)}
                  style={[
                    styles.codeInput,
                    digit && styles.codeInputFilled,
                  ]}
                  value={digit}
                  onChangeText={(value) => handleCodeChange(value, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  autoFocus={index === 0}
                />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleVerifyCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verificar código</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={goBackToStep1}
            >
              <Text style={styles.backText}>← Voltar e editar dados</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  logo: {
    fontSize: theme.fontSize.xxxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
    letterSpacing: 3,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.fontSize.md,
    backgroundColor: theme.colors.surface,
  },
  button: {
    height: 50,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: theme.colors.textWhite,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signupText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  signupLink: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  // Step 2: Código
  verifyText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    lineHeight: 22,
  },
  emailText: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    textAlign: 'center',
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  codeInputFilled: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.infoLight,
  },
  backButton: {
    alignItems: 'center',
    padding: theme.spacing.sm,
  },
  backText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
});

export default RegisterScreen;
