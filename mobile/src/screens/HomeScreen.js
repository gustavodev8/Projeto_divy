/**
 * DIVY - Home Screen
 * Tela principal com lista de tarefas
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../contexts/AuthContext';
import theme from '../styles/theme';

const HomeScreen = () => {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Minhas Tarefas</Text>
        <Text style={styles.subtitle}>Olá, {user?.nome || 'Usuário'}!</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.placeholderText}>
          🎉 App mobile em construção!
        </Text>
        <Text style={styles.infoText}>
          A tela de tarefas será implementada em breve.
        </Text>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
        <Text style={styles.logoutText}>Sair</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    paddingTop: theme.spacing.xxl + 20,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textWhite,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textWhite,
    opacity: 0.9,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  placeholderText: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  infoText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  logoutButton: {
    margin: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.error,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  logoutText: {
    color: theme.colors.textWhite,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
});

export default HomeScreen;
