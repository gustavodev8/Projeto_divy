/**
 * DIVY - Sidebar Component
 * Menu lateral — replica fidedigna da referencia
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { List, getLists } from '../services/listService';

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.78;

// Cores fixas para os circulos das listas — exatas da referencia
const LIST_COLORS = ['#4b6ef5', '#f59e0b', '#f97316', '#3b82f6', '#f43f5e', '#10b981', '#8b5cf6', '#06b6d4'];

interface MenuItem {
  id: string;
  icon: string;
  iconActive: string;
  label: string;
  screen: string | null;
}

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
  navigation: any;
  selectedListId?: number | null;
  onSelectList?: (listId: number) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  visible,
  onClose,
  navigation,
  selectedListId,
  onSelectList,
}) => {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const slideAnim = React.useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const [activeItem, setActiveItem] = React.useState<string>('inicio');
  const [lists, setLists] = useState<List[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  // Carregar listas quando abrir sidebar
  useEffect(() => {
    if (visible && lists.length === 0) {
      loadUserLists();
    }
  }, [visible]);

  const loadUserLists = async () => {
    setLoadingLists(true);
    const result = await getLists();
    if (result.success && result.lists) {
      setLists(result.lists);
    }
    setLoadingLists(false);
  };

  React.useEffect(() => {
    if (visible) {
      setModalVisible(true);
      slideAnim.setValue(-SIDEBAR_WIDTH);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SIDEBAR_WIDTH,
          duration: 260,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setModalVisible(false);
      });
    }
  }, [visible]);

  const menuItems: MenuItem[] = [
    { id: 'inicio',  icon: 'home-outline',             iconActive: 'home',             label: 'Inicio',  screen: 'Home' },
    { id: 'tarefas', icon: 'checkmark-circle-outline',  iconActive: 'checkmark-circle',  label: 'Tarefas', screen: 'Tasks' },
    { id: 'ajustes', icon: 'settings-outline',           iconActive: 'settings',          label: 'Ajustes', screen: 'Settings' },
  ];

  const handleMenuPress = (item: MenuItem): void => {
    setActiveItem(item.id);
    if (item.screen) navigation.navigate(item.screen);
    onClose();
  };

  const handleSignOut = (): void => {
    onClose();
    setTimeout(() => signOut(), 300);
  };

  const handleListSelect = (listId: number): void => {
    if (onSelectList) onSelectList(listId);
    onClose();
  };

  const getListInitial = (name: string): string => name.charAt(0).toUpperCase();
  const getFirstName = (name?: string): string => {
    if (!name) return 'Minha conta';
    return name.split(' ')[0];
  };

  // Cor do circulo da lista — usa list.color ou cores fixas
  const getListCircleColor = (list: List, index: number): string => {
    return list.color || LIST_COLORS[index % LIST_COLORS.length];
  };

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent={false}
    >
      <Animated.View style={[st.overlay, { opacity: fadeAnim }]}>
        <Animated.View style={[st.sidebar, { transform: [{ translateX: slideAnim }] }]}>
          <View style={[st.sidebarInner, { paddingTop: insets.top }]}>

            {/* ═══ HEADER ═══ */}
            <View style={st.header}>
              <View style={st.headerLeft}>
                <View style={st.logoBubble}>
                  <Text style={st.logoLetter}>D</Text>
                </View>
                <View>
                  <Text style={st.brandName}>DIVY</Text>
                  <Text style={st.brandSub}>Sua agenda inteligente</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* ═══ SCROLL BODY ═══ */}
            <ScrollView style={st.body} showsVerticalScrollIndicator={false}>

              {/* Menu principal */}
              <View style={st.menuBlock}>
                {menuItems.map(item => {
                  const isActive = activeItem === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[st.menuRow, isActive && st.menuRowActive]}
                      onPress={() => handleMenuPress(item)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={(isActive ? item.iconActive : item.icon) as any}
                        size={22}
                        color={isActive ? '#3b82f6' : '#475569'}
                      />
                      <Text style={[st.menuLabel, isActive && st.menuLabelActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Separador */}
              <View style={st.divider} />

              {/* Minhas listas */}
              <View style={st.listsBlock}>
                <View style={st.listsHeader}>
                  <Text style={st.listsTitle}>MINHAS LISTAS</Text>
                  <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="add" size={20} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                {loadingLists ? (
                  <ActivityIndicator size="small" color="#3b82f6" style={{ marginVertical: 20 }} />
                ) : (
                  lists.map((list, i) => {
                    const color = getListCircleColor(list, i);
                    const selected = selectedListId === list.id;
                    return (
                      <TouchableOpacity
                        key={list.id}
                        style={[st.listRow, selected && st.listRowActive]}
                        onPress={() => handleListSelect(list.id)}
                        activeOpacity={0.7}
                      >
                        {/* Circulo com inicial */}
                        <View style={[st.listCircle, { backgroundColor: color }]}>
                          <Text style={st.listCircleLetter}>{getListInitial(list.name)}</Text>
                        </View>

                        {/* Nome */}
                        <Text style={[st.listLabel, selected && st.listLabelActive]} numberOfLines={1}>
                          {list.name}
                        </Text>

                        {/* Badge padrao */}
                        {list.is_default && (
                          <View style={st.defaultBadge}>
                            <Text style={st.defaultBadgeText}>Padrao</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </ScrollView>

            {/* ═══ FOOTER ═══ */}
            <View style={[st.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>

              {/* User row */}
              <TouchableOpacity
                style={st.userRow}
                activeOpacity={0.7}
                onPress={() => { onClose(); navigation.navigate('Settings'); }}
              >
                <View style={st.userAvatar}>
                  <Text style={st.userAvatarLetter}>
                    {getFirstName(user?.name).charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={st.userInfo}>
                  <Text style={st.userName} numberOfLines={1}>{user?.username || getFirstName(user?.name)}</Text>
                  <Text style={st.userEmail} numberOfLines={1}>{user?.email || ''}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
              </TouchableOpacity>

              {/* Sair */}
              <TouchableOpacity style={st.signOutRow} onPress={handleSignOut} activeOpacity={0.7}>
                <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                <Text style={st.signOutLabel}>Sair da conta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* Backdrop */}
        <TouchableOpacity
          style={st.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES — Replica fiel da imagem de referencia
// ═══════════════════════════════════════════════════════════════
const st = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: SIDEBAR_WIDTH,
    right: 0,
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    height: '100%',
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  sidebarInner: {
    flex: 1,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBubble: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#4b6ef5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  brandName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: 0.3,
  },
  brandSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },

  // ── Body / Scroll ──
  body: {
    flex: 1,
  },

  // ── Menu items ──
  menuBlock: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 12,
    marginBottom: 2,
  },
  menuRowActive: {
    backgroundColor: '#eff6ff',
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1e293b',
  },
  menuLabelActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },

  // ── Divider ──
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 20,
    marginVertical: 6,
  },

  // ── Listas ──
  listsBlock: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 16,
  },
  listsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  listsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1,
  },

  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    marginBottom: 2,
  },
  listRowActive: {
    backgroundColor: '#eff6ff',
  },

  // Circulo colorido — redondo como na referencia
  listCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  listCircleLetter: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },

  listLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1e293b',
    flex: 1,
  },
  listLabelActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },

  defaultBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94a3b8',
  },

  // ── Footer ──
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: '#ffffff',
  },

  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarLetter: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  userEmail: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 1,
  },

  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  signOutLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ef4444',
  },
});

export default Sidebar;
