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
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import authService from '../services/authService';
import theme from '../styles/theme';
import { NavigationProp } from '../types/navigation';

interface RegisterScreenProps {
  navigation: NavigationProp<'Register'>;
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  // Step 1: Formulário
  const [step, setStep] = useState<number>(1);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  // Step 2: Código
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const { signUp } = useAuth();

  // Step 1: Enviar código
  const handleSendCode = async (): Promise<void> => {
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
  const handleVerifyCode = async (): Promise<void> => {
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
  const handleCodeChange = (value: string, index: number): void => {
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focar no próximo input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Voltar para step 1
  const goBackToStep1 = (): void => {
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
          <View style={styles.logoCircle}>
            <Ionicons name="sparkles" size={28} color="#ffffff" />
          </View>
          <Text style={styles.logo}>DIVY</Text>
          <Text style={styles.tagline}>Sua agenda inteligente com IA</Text>
          <Text style={styles.subtitle}>
            {step === 1 ? 'Crie sua conta' : 'Verificar email'}
          </Text>
          {step === 1 && (
            <Text style={styles.subtitleDescription}>
              Preencha os dados abaixo para começar
            </Text>
          )}
        </View>

        {/* STEP 1: Formulário */}
        {step === 1 && (
          <View style={styles.form}>
            {/* Google Button */}
            <TouchableOpacity style={styles.googleButton}>
              <View style={styles.googleIconContainer}>
                <Text style={styles.googleIconMulticolor}>G</Text>
              </View>
              <Text style={styles.googleButtonText}>Continuar com o Google</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou continue com e-mail</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Nome de usuário</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={16} color="#9ca3af" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Seu nome de usuário"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="none"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={16} color="#9ca3af" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="seu@email.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Senha</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={16} color="#9ca3af" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSendCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>Criar conta</Text>
                  <Text style={styles.buttonArrow}>→</Text>
                </View>
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
                  ref={(ref) => { inputRefs.current[index] = ref; }}
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
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>Verificar código</Text>
                  <Text style={styles.buttonArrow}>→</Text>
                </View>
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
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -1,
    marginBottom: 8,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 32,
  },
  subtitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitleDescription: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    width: '100%',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  googleIconContainer: {
    width: 20,
    height: 20,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconMulticolor: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    fontSize: 12,
    color: '#9ca3af',
    paddingHorizontal: 16,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  button: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginRight: 8,
  },
  buttonArrow: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '300',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signupText: {
    fontSize: 15,
    color: '#6b7280',
  },
  signupLink: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  // Step 2: Código
  verifyText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  emailText: {
    color: '#111827',
    fontWeight: '600',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  codeInputFilled: {
    borderColor: '#111827',
    backgroundColor: '#ffffff',
  },
  backButton: {
    alignItems: 'center',
    padding: 12,
  },
  backText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '500',
  },
});

export default RegisterScreen;
