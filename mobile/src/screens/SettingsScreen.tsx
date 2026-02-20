/**
 * DIVY - Settings Screen
 * Tela de ajustes do usuário
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { getMyPlan, UserPlan } from '../services/planService';
import { NavigationProp } from '../types/navigation';

interface SettingsScreenProps {
  navigation: NavigationProp<'Settings'>;
}

// Configuração visual por plano
const PLAN_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  normal: {
    label: 'Gratuito',
    color: '#64748b',
    bg: '#f1f5f9',
    icon: 'person-outline',
  },
  pro: {
    label: 'Pro',
    color: '#3b82f6',
    bg: '#eff6ff',
    icon: 'star-outline',
  },
  promax: {
    label: 'Pro Max',
    color: '#2563eb',
    bg: '#dbeafe',
    icon: 'diamond-outline',
  },
};

interface SettingsItem {
  icon: string;
  iconColor: string;
  iconBg: string;
  label: string;
  sublabel: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const { user, signOut } = useAuth();
  const [plan, setPlan] = useState<UserPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);

  useEffect(() => {
    loadPlan();
  }, []);

  const loadPlan = async () => {
    setLoadingPlan(true);
    const result = await getMyPlan();
    if (result.success && result.plan) {
      setPlan(result.plan);
    }
    setLoadingPlan(false);
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sair da conta',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: () => signOut(),
        },
      ]
    );
  };

  const getFirstName = (name?: string | null) => {
    if (!name) return 'Usuário';
    return name.split(' ')[0];
  };

  // Usa o plano da API primeiro, senão usa o do AuthContext (que vem do login), senão 'normal'
  const rawPlanKey = plan?.id || user?.plan || 'normal';
  // Normaliza variações: 'pro_max' ou 'proMax' → 'promax'
  const planKey = rawPlanKey.toLowerCase().replace(/[_\s-]/g, '') as string;
  const planConfig = PLAN_CONFIG[planKey] || PLAN_CONFIG['normal'];
  const planLabel = plan?.name || planConfig.label;

  // Seções de configurações
  const sections: { items: SettingsItem[] }[] = [
    {
      items: [
        {
          icon: 'color-palette-outline',
          iconColor: '#3b82f6',
          iconBg: '#eff6ff',
          label: 'Aparência',
          sublabel: 'Tema, cores e fontes',
          onPress: () => Alert.alert('Em breve', 'Esta seção está em desenvolvimento.'),
        },
        {
          icon: 'notifications-outline',
          iconColor: '#3b82f6',
          iconBg: '#eff6ff',
          label: 'Notificações',
          sublabel: 'Sons e alertas',
          onPress: () => Alert.alert('Em breve', 'Esta seção está em desenvolvimento.'),
        },
        {
          icon: 'phone-portrait-outline',
          iconColor: '#3b82f6',
          iconBg: '#eff6ff',
          label: 'Geral',
          sublabel: 'Comportamento do app',
          onPress: () => Alert.alert('Em breve', 'Esta seção está em desenvolvimento.'),
        },
      ],
    },
    {
      items: [
        {
          icon: 'share-social-outline',
          iconColor: '#3b82f6',
          iconBg: '#eff6ff',
          label: 'Compartilhar DIVY',
          sublabel: 'Indique para amigos',
          onPress: () => Alert.alert('Em breve', 'Esta seção está em desenvolvimento.'),
        },
        {
          icon: 'help-circle-outline',
          iconColor: '#3b82f6',
          iconBg: '#eff6ff',
          label: 'Ajuda e Suporte',
          sublabel: 'FAQ e contato',
          onPress: () => Alert.alert('Em breve', 'Esta seção está em desenvolvimento.'),
        },
        {
          icon: 'chatbox-outline',
          iconColor: '#3b82f6',
          iconBg: '#eff6ff',
          label: 'Feedback',
          sublabel: 'Envie sugestões',
          onPress: () => Alert.alert('Em breve', 'Esta seção está em desenvolvimento.'),
        },
        {
          icon: 'document-text-outline',
          iconColor: '#3b82f6',
          iconBg: '#eff6ff',
          label: 'Termos de Uso',
          sublabel: 'Políticas e termos',
          onPress: () => Alert.alert('Em breve', 'Esta seção está em desenvolvimento.'),
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ajustes</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Card: Usuário */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.userCard} activeOpacity={0.7}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {getFirstName(user?.name).charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.name || 'Usuário DIVY'}</Text>
              <Text style={styles.userEmail}>{user?.email || ''}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* Card: Plano */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.planCard, { backgroundColor: planConfig.bg }]}
            activeOpacity={0.8}
            onPress={() => Alert.alert('Plano', `Você está no plano ${planLabel}.`)}
          >
            <View style={[styles.planIconContainer, { backgroundColor: planConfig.color + '22' }]}>
              <Ionicons name={planConfig.icon as any} size={22} color={planConfig.color} />
            </View>
            <View style={styles.planInfo}>
              {loadingPlan ? (
                <ActivityIndicator size="small" color={planConfig.color} />
              ) : (
                <>
                  <Text style={[styles.planName, { color: planConfig.color }]}>{planLabel}</Text>
                  <Text style={styles.planSublabel}>Plano atual</Text>
                </>
              )}
            </View>
            <TouchableOpacity
              style={[styles.manageButton, { borderColor: planConfig.color }]}
              activeOpacity={0.7}
              onPress={() => Alert.alert('Em breve', 'Gerenciamento de plano em desenvolvimento.')}
            >
              <Text style={[styles.manageButtonText, { color: planConfig.color }]}>Gerenciar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        {/* Seções de ajustes */}
        {sections.map((section, sIdx) => (
          <View key={sIdx} style={styles.section}>
            <View style={styles.sectionCard}>
              {section.items.map((item, iIdx) => (
                <React.Fragment key={iIdx}>
                  <TouchableOpacity
                    style={styles.settingsItem}
                    onPress={item.onPress}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.itemIconContainer, { backgroundColor: item.iconBg }]}>
                      <Ionicons name={item.icon as any} size={19} color={item.iconColor} />
                    </View>
                    <View style={styles.itemTextContainer}>
                      <Text style={styles.itemLabel}>{item.label}</Text>
                      <Text style={styles.itemSublabel}>{item.sublabel}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
                  </TouchableOpacity>
                  {iIdx < section.items.length - 1 && (
                    <View style={styles.itemDivider} />
                  )}
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}

        {/* Botão Sair */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={styles.signOutText}>Sair da conta</Text>
          </TouchableOpacity>
        </View>

        {/* Versão */}
        <Text style={styles.version}>DIVY v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
  },
  headerRight: {
    width: 38,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },

  // Card usuário
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  userEmail: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },

  // Card plano
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  planIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 15,
    fontWeight: '700',
  },
  planSublabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  manageButton: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  manageButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Card de seção de ajustes
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  itemIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextContainer: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  itemSublabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  itemDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginLeft: 66,
  },

  // Botão sair
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff1f2',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ef4444',
  },

  // Versão
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
});

export default SettingsScreen;
