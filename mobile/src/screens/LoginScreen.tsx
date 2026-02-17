/**
 * DIVY - Login Screen
 * Tela de login do app mobile
 */

import React, { useState } from 'react';
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
import { NavigationProp } from '../types/navigation';

interface LoginScreenProps {
  navigation: NavigationProp<'Login'>;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const { signIn } = useAuth();

  const handleLogin = async (): Promise<void> => {
    if (!email || !password) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    setLoading(true);

    try {
      const result = await signIn(email, password);
      setLoading(false);

      if (!result.success) {
        Alert.alert('Erro', result.error || 'Erro ao fazer login');
      }
    } catch (error) {
      console.error('💥 Erro ao fazer login:', error);
      setLoading(false);
      Alert.alert('Erro', 'Erro inesperado ao fazer login');
    }
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
        {/* Logo & Header */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Ionicons name="sparkles" size={28} color="#ffffff" />
          </View>
          <Text style={styles.brandName}>DIVY</Text>
          <Text style={styles.brandTagline}>Sua agenda inteligente com IA</Text>
        </View>

        {/* Title */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>
            {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
          </Text>
          <Text style={styles.welcomeSubtitle}>
            {isLogin
              ? 'Entre com suas credenciais para acessar sua conta'
              : 'Preencha os dados abaixo para começar'}
          </Text>
        </View>

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

        {/* Email Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Email</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="mail-outline" size={16} color="#9ca3af" style={styles.inputIconLeft} />
            <TextInput
              style={styles.input}
              placeholder="seu@email.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>

        {/* Password Input */}
        <View style={styles.inputContainer}>
          <View style={styles.passwordHeader}>
            <Text style={styles.inputLabel}>Senha</Text>
            <TouchableOpacity>
              <Text style={styles.forgotText}>Esqueceu a senha?</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={16} color="#9ca3af" style={styles.inputIconLeft} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              placeholderTextColor="#9ca3af"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={16}
                color="#9ca3af"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Login/Signup Button */}
        <TouchableOpacity
          style={[styles.loginButton, loading && styles.loginButtonDisabled]}
          onPress={isLogin ? handleLogin : () => navigation.navigate('Register')}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.loginButtonContent}>
              <Text style={styles.loginButtonText}>
                {isLogin ? 'Entrar' : 'Criar conta'}
              </Text>
              <Text style={styles.loginButtonArrow}>→</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Toggle Login/Signup */}
        <View style={styles.signupContainer}>
          <Text style={styles.signupText}>
            {isLogin ? 'Não tem uma conta? ' : 'Já tem uma conta? '}
          </Text>
          <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
            <Text style={styles.signupLink}>
              {isLogin ? 'Criar conta' : 'Entrar'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          © 2026 DIVY. Todos os direitos reservados.
        </Text>
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
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  logoSection: {
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
  brandName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -1,
    marginBottom: 8,
    textAlign: 'center',
  },
  brandTagline: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '400',
    textAlign: 'center',
  },
  welcomeSection: {
    marginBottom: 32,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    lineHeight: 20,
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
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  forgotText: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
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
  inputIconLeft: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  eyeButton: {
    padding: 4,
  },
  loginButton: {
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
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginRight: 8,
  },
  loginButtonArrow: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '300',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
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
  footer: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default LoginScreen;
