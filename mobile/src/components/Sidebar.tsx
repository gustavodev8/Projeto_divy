/**
 * DIVY - Sidebar Component
 * Menu lateral com navegação e listas
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { List, getLists } from '../services/listService';

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.65; // 65% da largura da tela

type IconType = 'ionicons' | 'mci';

interface MenuItem {
  id: string;
  icon: string;
  iconType: IconType;
  label: string;
  screen: string | null;
}

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
  navigation: any; // TODO: Type navigation properly when migrating screens
  selectedListId?: number | null;
  onSelectList?: (listId: number) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  visible,
  onClose,
  navigation,
  selectedListId,
  onSelectList
}) => {
  const { user, signOut } = useAuth();
  const slideAnim = React.useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const [activeItem, setActiveItem] = React.useState<string>('inicio');
  const [lists, setLists] = useState<List[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);

  // Carregar listas quando abrir sidebar
  useEffect(() => {
    if (visible && lists.length === 0) {
      loadUserLists();
    }
  }, [visible]);

  const loadUserLists = async () => {
    console.log('📋 SIDEBAR: Carregando listas...');
    setLoadingLists(true);
    const result = await getLists();
    console.log('📋 SIDEBAR: Resultado getLists:', result);

    if (result.success && result.lists) {
      console.log(`✅ SIDEBAR: ${result.lists.length} listas carregadas`);
      setLists(result.lists);
    } else {
      console.error('❌ SIDEBAR: Erro ao carregar listas:', result.error);
    }
    setLoadingLists(false);
  };

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 40,
          friction: 8,
          velocity: 2,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SIDEBAR_WIDTH,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  const menuItems: MenuItem[] = [
    { id: 'inicio', icon: 'home-outline', iconType: 'ionicons', label: 'Início', screen: 'Home' },
    { id: 'agenda', icon: 'calendar-outline', iconType: 'ionicons', label: 'Agenda', screen: null },
    { id: 'tarefas', icon: 'checkmark-circle-outline', iconType: 'ionicons', label: 'Tarefas', screen: 'Tasks' },
    { id: 'ia', icon: 'head-lightbulb-outline', iconType: 'mci', label: 'IA Assistente', screen: null },
    { id: 'favoritos', icon: 'star-outline', iconType: 'ionicons', label: 'Favoritos', screen: null },
    { id: 'arquivo', icon: 'archive-outline', iconType: 'ionicons', label: 'Arquivo', screen: null },
  ];

  const handleMenuPress = (item: MenuItem): void => {
    setActiveItem(item.id);
    if (item.screen) {
      navigation.navigate(item.screen);
    }
    onClose();
  };

  const handleSignOut = (): void => {
    onClose();
    setTimeout(() => {
      signOut();
    }, 300);
  };

  const handleListSelect = (listId: number): void => {
    console.log('🎯 SIDEBAR: handleListSelect CHAMADO! Lista ID:', listId);
    console.log('📌 SIDEBAR: onSelectList existe?', !!onSelectList);

    if (onSelectList) {
      console.log('✅ SIDEBAR: Chamando onSelectList com listId:', listId);
      onSelectList(listId);
    } else {
      console.warn('⚠️ SIDEBAR: onSelectList não foi passado como prop!');
    }

    console.log('🚪 SIDEBAR: Fechando sidebar...');
    onClose();
  };

  const renderIcon = (item: MenuItem): React.JSX.Element => {
    const isActive = activeItem === item.id;
    const color = isActive ? '#4f46e5' : '#111827';

    if (item.iconType === 'mci') {
      return <MaterialCommunityIcons name={item.icon as any} size={22} color={color} />;
    }
    return <Ionicons name={item.icon as any} size={22} color={color} />;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.sidebar,
            {
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <SafeAreaView style={styles.sidebarContent}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <View style={styles.logoContainer}>
                  <Text style={styles.logoText}>D</Text>
                </View>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.brandName}>DIVY</Text>
                  <Text style={styles.brandTagline}>Sua agenda inteligente</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Menu Items */}
              <View style={styles.menuContainer}>
                {menuItems.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.menuItem, activeItem === item.id && styles.menuItemActive]}
                    onPress={() => handleMenuPress(item)}
                    activeOpacity={0.7}
                  >
                    {renderIcon(item)}
                    <Text style={[styles.menuLabel, activeItem === item.id && styles.menuLabelActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Listas Section */}
              <View style={styles.listsSection}>
                <View style={styles.listsSectionHeader}>
                  <Text style={styles.listsSectionTitle}>MINHAS LISTAS</Text>
                  <TouchableOpacity style={styles.addListButton}>
                    <Ionicons name="add" size={16} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                {loadingLists ? (
                  <ActivityIndicator size="small" color="#4f46e5" style={styles.listsLoader} />
                ) : (
                  lists.map((list) => (
                    <TouchableOpacity
                      key={list.id}
                      style={[
                        styles.listItem,
                        selectedListId === list.id && styles.listItemActive
                      ]}
                      onPress={() => handleListSelect(list.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.listItemContent}>
                        <Text style={styles.listEmoji}>{list.emoji || '📋'}</Text>
                        <Text style={[
                          styles.listName,
                          selectedListId === list.id && styles.listNameActive
                        ]}>
                          {list.name}
                        </Text>
                      </View>
                      {list.is_default && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Padrão</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity style={styles.footerItem} activeOpacity={0.7}>
                <Ionicons name="person-outline" size={20} color="#111827" />
                <Text style={styles.footerLabel}>Minha conta</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.footerItem} activeOpacity={0.7}>
                <Ionicons name="settings-outline" size={20} color="#111827" />
                <Text style={styles.footerLabel}>Configurações</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.footerItem} onPress={handleSignOut} activeOpacity={0.7}>
                <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                <Text style={[styles.footerLabel, styles.footerLabelDanger]}>Sair</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Animated.View>

        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    height: '100%',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  sidebarContent: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerTextContainer: {
    flex: 1,
  },
  brandName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 0.3,
  },
  brandTagline: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 1,
  },
  closeButton: {
    padding: 4,
  },
  menuContainer: {
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 2,
  },
  menuItemActive: {
    backgroundColor: '#eef2ff',
  },
  menuLabel: {
    fontSize: 15,
    color: '#111827',
    marginLeft: 16,
    fontWeight: '500',
  },
  menuLabelActive: {
    color: '#4f46e5',
    fontWeight: '600',
  },
  listsSection: {
    paddingHorizontal: 12,
    paddingTop: 20,
    paddingBottom: 20,
  },
  listsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  listsSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.5,
  },
  addListButton: {
    padding: 4,
  },
  listsLoader: {
    paddingVertical: 20,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  listItemActive: {
    backgroundColor: '#eef2ff',
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  listEmoji: {
    fontSize: 16,
    marginRight: 12,
  },
  listName: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
  },
  listNameActive: {
    color: '#4f46e5',
    fontWeight: '600',
  },
  defaultBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
  },
  spacer: {
    flex: 1,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
  },
  footerLabel: {
    fontSize: 14,
    color: '#111827',
    marginLeft: 16,
    fontWeight: '500',
  },
  footerLabelDanger: {
    color: '#ef4444',
    fontWeight: '600',
  },
});

export default Sidebar;
