/**
 * DIVY - Home Screen
 * Tela principal com estrutura: Listas → Seções → Tarefas
 * Design moderno inspirado no Lovable
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import * as taskService from '../services/taskService';
import * as listService from '../services/listService';
import * as sectionService from '../services/sectionService';
import { List } from '../services/listService';
import { Section } from '../services/sectionService';
import Sidebar from '../components/Sidebar';
import { Task } from '../types/api';
import { NavigationProp } from '../types/navigation';

interface HomeScreenProps {
  navigation: NavigationProp<'Home'>;
}

interface NewTaskState {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
  sectionId: number | null;
}

interface DateInfo {
  dayName: string;
  day: number;
  month: string;
}

interface ListWithSections extends List {
  sections: SectionWithTasks[];
  expanded: boolean;
}

interface SectionWithTasks extends Section {
  tasks: Task[];
  expanded: boolean;
}

// Componente accordion para seção com animação de altura
interface SectionAccordionProps {
  section: SectionWithTasks;
  list: ListWithSections;
  onToggle: () => void;
  renderTask: (task: Task) => React.JSX.Element;
  styles: any;
}

const SectionAccordion: React.FC<SectionAccordionProps> = ({ section, list, onToggle, renderTask, styles }) => {
  const animHeight = React.useRef(new Animated.Value(0)).current;
  const animRotate = React.useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = React.useState(0);
  const [measured, setMeasured] = React.useState(false);

  React.useEffect(() => {
    if (!measured) return;
    Animated.parallel([
      Animated.spring(animHeight, {
        toValue: section.expanded ? contentHeight : 0,
        useNativeDriver: false,
        bounciness: 0,
        speed: 16,
      }),
      Animated.spring(animRotate, {
        toValue: section.expanded ? 1 : 0,
        useNativeDriver: true,
        bounciness: 0,
        speed: 16,
      }),
    ]).start();
  }, [section.expanded, contentHeight, measured]);

  const rotate = animRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  return (
    <View style={styles.sectionCard}>
      <TouchableOpacity
        style={[styles.sectionHeader, !section.expanded && styles.sectionHeaderCollapsed]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.sectionTitleContainer}>
          <View style={[styles.sectionAccent, { backgroundColor: list.color || '#111827' }]} />
          <Text style={styles.sectionTitle}>{section.name}</Text>
        </View>
        <View style={styles.sectionBadgeContainer}>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{section.tasks.length}</Text>
          </View>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Ionicons name="chevron-forward" size={20} color="#6b7280" />
          </Animated.View>
        </View>
      </TouchableOpacity>

      {/* Medir altura real do conteúdo de forma invisível */}
      {!measured && (
        <View
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
          onLayout={(e) => {
            setContentHeight(e.nativeEvent.layout.height);
            setMeasured(true);
            if (section.expanded) {
              animHeight.setValue(e.nativeEvent.layout.height);
            }
          }}
        >
          <View style={styles.taskList}>
            {section.tasks.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma tarefa nesta seção</Text>
            ) : (
              section.tasks.map(renderTask)
            )}
          </View>
        </View>
      )}

      {/* Conteúdo animado */}
      <Animated.View style={{ height: animHeight, overflow: 'hidden' }}>
        <View style={styles.taskList}>
          {section.tasks.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma tarefa nesta seção</Text>
          ) : (
            section.tasks.map(renderTask)
          )}
        </View>
      </Animated.View>
    </View>
  );
};

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [lists, setLists] = useState<ListWithSections[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('tasks');

  // Sidebar
  const [sidebarVisible, setSidebarVisible] = useState<boolean>(false);

  // Modal para criar tarefa
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [newTask, setNewTask] = useState<NewTaskState>({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
    sectionId: null,
  });

  // Carregar dados completos: Listas → Seções → Tarefas
  const loadData = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);

      const listsResult = await listService.getLists();

      if (!listsResult.success || !listsResult.lists) {
        Alert.alert('Erro', listsResult.error || 'Erro ao carregar listas');
        setLoading(false);
        return;
      }

      const listsData = listsResult.lists;

      const listsWithSections: ListWithSections[] = await Promise.all(
        listsData.map(async (list) => {
          const sectionsResult = await sectionService.getSectionsByList(list.id);
          const sections = sectionsResult.success ? sectionsResult.sections || [] : [];

          const sectionsWithTasks: SectionWithTasks[] = await Promise.all(
            sections.map(async (section) => {
              const tasksResult = await taskService.getTasksBySection(section.id);
              const tasks = tasksResult.success ? tasksResult.tasks || [] : [];
              return { ...section, tasks, expanded: false };
            })
          );

          return { ...list, sections: sectionsWithTasks, expanded: true };
        })
      );

      setLists(listsWithSections);

      if (!selectedListId && listsWithSections.length > 0) {
        const defaultList = listsWithSections.find(l => l.is_default) || listsWithSections[0];
        setSelectedListId(defaultList.id);
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao carregar dados');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);


  // Refresh
  const onRefresh = (): void => {
    setRefreshing(true);
    loadData();
  };

  // Criar nova tarefa
  const handleCreateTask = async (): Promise<void> => {
    if (!newTask.title.trim()) {
      Alert.alert('Erro', 'Digite um título para a tarefa');
      return;
    }

    const result = await taskService.createTask(
      newTask.title,
      newTask.description,
      newTask.priority,
      {
        due_date: newTask.dueDate || undefined,
        list_id: selectedList?.id || undefined,
        section_id: newTask.sectionId || undefined,
      }
    );

    if (result.success) {
      setModalVisible(false);
      setNewTask({ title: '', description: '', priority: 'medium', dueDate: '', sectionId: null });
      loadData();
    } else {
      Alert.alert('Erro', result.error || 'Erro ao criar tarefa');
    }
  };

  // Toggle status da tarefa
  const handleToggleTask = async (task: Task): Promise<void> => {
    const result = await taskService.toggleTaskStatus(task.id, task.status);
    if (result.success) {
      loadData();
    } else {
      Alert.alert('Erro', result.error || 'Erro ao atualizar tarefa');
    }
  };

  // Deletar tarefa
  const handleDeleteTask = async (taskId: number): Promise<void> => {
    Alert.alert(
      'Confirmar',
      'Deseja deletar esta tarefa?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Deletar',
          style: 'destructive',
          onPress: async () => {
            const result = await taskService.deleteTask(taskId);
            if (result.success) {
              loadData();
            } else {
              Alert.alert('Erro', result.error || 'Erro ao deletar tarefa');
            }
          },
        },
      ]
    );
  };

  // Toggle expansão de lista
  const toggleList = (listId: number): void => {
    setLists(lists.map(list =>
      list.id === listId ? { ...list, expanded: !list.expanded } : list
    ));
  };

  // Toggle expansão de seção
  const toggleSection = (listId: number, sectionId: number): void => {
    setLists(lists.map(list =>
      list.id === listId
        ? {
            ...list,
            sections: list.sections.map(section =>
              section.id === sectionId
                ? { ...section, expanded: !section.expanded }
                : section
            ),
          }
        : list
    ));
  };

  // Data atual
  const getCurrentDate = (): DateInfo => {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const now = new Date();
    return {
      dayName: days[now.getDay()],
      day: now.getDate(),
      month: months[now.getMonth()],
    };
  };

  const dateInfo = getCurrentDate();

  // Renderizar item de tarefa
  const renderTask = (task: Task): React.JSX.Element => (
    <TouchableOpacity
      key={task.id}
      style={styles.taskItem}
      onLongPress={() => handleDeleteTask(task.id)}
      activeOpacity={0.7}
    >
      <TouchableOpacity
        style={[styles.checkbox, task.status === 'completed' && styles.checkboxChecked]}
        onPress={() => handleToggleTask(task)}
      >
        {task.status === 'completed' && (
          <Ionicons name="checkmark" size={16} color="#ffffff" />
        )}
      </TouchableOpacity>
      <View style={styles.taskContent}>
        <Text style={[styles.taskTitle, task.status === 'completed' && styles.taskTitleCompleted]}>
          {task.title}
        </Text>
        {task.description && (
          <Text style={styles.taskDescription}>{task.description}</Text>
        )}
      </View>
      <View style={styles.taskMeta}>
        {task.priority && (
          <View style={[
            styles.priorityBadge,
            task.priority === 'high' && styles.priorityHigh,
            task.priority === 'medium' && styles.priorityMedium,
            task.priority === 'low' && styles.priorityLow,
          ]}>
            <Text style={styles.priorityText}>
              {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  // Renderizar seção como card (colapsável com animação accordion)
  const renderSection = (list: ListWithSections, section: SectionWithTasks): React.JSX.Element => (
    <SectionAccordion
      key={section.id}
      section={section}
      list={list}
      onToggle={() => toggleSection(list.id, section.id)}
      renderTask={renderTask}
      styles={styles}
    />
  );

  // Handler para selecionar lista
  const handleSelectList = (listId: number): void => {
    setSelectedListId(listId);
  };

  // Filtrar lista selecionada
  const selectedList = selectedListId ? lists.find(l => l.id === selectedListId) : lists[0];

  // Renderizar lista selecionada
  const renderSelectedList = (): React.JSX.Element | null => {
    if (!selectedList) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Nenhuma lista selecionada</Text>
        </View>
      );
    }

    return (
      <View style={styles.sectionsContainer}>
        {selectedList.sections.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <Ionicons name="folder-open-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyStateTitle}>Nenhuma seção nesta lista</Text>
            <Text style={styles.emptyStateSubtitle}>
              As seções ajudam a organizar suas tarefas em grupos
            </Text>
          </View>
        ) : (
          selectedList.sections.map(section => renderSection(selectedList, section))
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Sidebar */}
      <Sidebar
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
        selectedListId={selectedListId}
        onSelectList={handleSelectList}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.menuButton} onPress={() => setSidebarVisible(true)}>
            <Ionicons name="menu" size={24} color="#111827" />
          </TouchableOpacity>
          <View>
            <Text style={styles.greeting}>Olá, {user?.name || 'bem-vindo'}!</Text>
            <Text style={styles.date}>{dateInfo.dayName}, {dateInfo.day} {dateInfo.month}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.calendarButton}>
            <Ionicons name="calendar-outline" size={16} color="#111827" />
            <Text style={styles.calendarDate}>{dateInfo.day} {dateInfo.month}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar tarefas, listas..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* ScrollView com flex: 1 isolado */}
      {loading ? (
        <ActivityIndicator size="large" color="#111827" style={styles.loading} />
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.scrollContent}
        >
          {/* Título */}
          <View style={styles.titleContainer}>
            <Text style={styles.pageTitle}>{selectedList?.name || 'Minhas Tarefas'}</Text>
            <Text style={styles.pageSubtitle}>
              {selectedList?.sections.length || 0} seção(ões)
            </Text>
          </View>

          {/* Lista Selecionada */}
          {renderSelectedList()}
        </ScrollView>
      )}

      {/* FAB Moderno */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>

      {/* Bottom Navigation - SEMPRE FIXO */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('tasks')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === 'tasks' ? "checkmark-circle" : "checkmark-circle-outline"}
            size={24}
            color={activeTab === 'tasks' ? '#111827' : '#6b7280'}
          />
          <Text style={[styles.navLabel, activeTab === 'tasks' && styles.navLabelActive]}>
            Tarefas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('agenda')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === 'agenda' ? "calendar" : "calendar-outline"}
            size={24}
            color={activeTab === 'agenda' ? '#111827' : '#6b7280'}
          />
          <Text style={[styles.navLabel, activeTab === 'agenda' && styles.navLabelActive]}>
            Agenda
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('ia')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === 'ia' ? "sparkles" : "sparkles-outline"}
            size={24}
            color={activeTab === 'ia' ? '#111827' : '#6b7280'}
          />
          <Text style={[styles.navLabel, activeTab === 'ia' && styles.navLabelActive]}>
            IA
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal Criar Tarefa */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova Tarefa</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Título */}
            <TextInput
              style={styles.modalInput}
              placeholder="Título da tarefa"
              placeholderTextColor="#9ca3af"
              value={newTask.title}
              onChangeText={(text) => setNewTask({ ...newTask, title: text })}
              autoFocus
            />

            {/* Descrição */}
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              placeholder="Descrição (opcional)"
              placeholderTextColor="#9ca3af"
              value={newTask.description}
              onChangeText={(text) => setNewTask({ ...newTask, description: text })}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Linha: Data + Prioridade */}
            <View style={styles.modalRow}>
              {/* Data de vencimento */}
              <View style={styles.modalFieldHalf}>
                <View style={styles.modalFieldLabel}>
                  <Ionicons name="calendar-outline" size={13} color="#6b7280" />
                  <Text style={styles.modalFieldLabelText}>Data de vencimento</Text>
                </View>
                <TextInput
                  style={styles.modalInputSmall}
                  placeholder="dd/mm/aaaa"
                  placeholderTextColor="#9ca3af"
                  value={newTask.dueDate}
                  onChangeText={(text) => setNewTask({ ...newTask, dueDate: text })}
                  keyboardType="numeric"
                />
              </View>

              {/* Prioridade */}
              <View style={styles.modalFieldHalf}>
                <View style={styles.modalFieldLabel}>
                  <Ionicons name="flag-outline" size={13} color="#6b7280" />
                  <Text style={styles.modalFieldLabelText}>Prioridade</Text>
                </View>
                <TouchableOpacity
                  style={styles.modalInputSmall}
                  onPress={() => {
                    const order: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
                    const next = order[(order.indexOf(newTask.priority) + 1) % 3];
                    setNewTask({ ...newTask, priority: next });
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.priorityRow}>
                    <View style={[
                      styles.priorityDot,
                      newTask.priority === 'high' && styles.priorityDotHigh,
                      newTask.priority === 'medium' && styles.priorityDotMedium,
                      newTask.priority === 'low' && styles.priorityDotLow,
                    ]} />
                    <Text style={styles.prioritySelectText}>
                      {newTask.priority === 'high' ? 'Alta' : newTask.priority === 'medium' ? 'Média' : 'Baixa'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Seção */}
            <View style={styles.modalFieldFull}>
              <View style={styles.modalFieldLabel}>
                <Ionicons name="folder-outline" size={13} color="#6b7280" />
                <Text style={styles.modalFieldLabelText}>Seção</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sectionPicker}>
                <TouchableOpacity
                  style={[styles.sectionPickerItem, newTask.sectionId === null && styles.sectionPickerItemActive]}
                  onPress={() => setNewTask({ ...newTask, sectionId: null })}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sectionPickerText, newTask.sectionId === null && styles.sectionPickerTextActive]}>
                    Sem seção
                  </Text>
                </TouchableOpacity>
                {selectedList?.sections.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.sectionPickerItem, newTask.sectionId === s.id && styles.sectionPickerItemActive]}
                    onPress={() => setNewTask({ ...newTask, sectionId: s.id })}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.sectionPickerText, newTask.sectionId === s.id && styles.sectionPickerTextActive]}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Botões */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnSave}
                onPress={handleCreateTask}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={18} color="#ffffff" />
                <Text style={styles.modalBtnSaveText}>Criar Tarefa</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuButton: {
    marginRight: 16,
  },
  greeting: {
    fontSize: 17,
    fontWeight: '700' as any,
    color: '#111827',
  },
  date: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  calendarDate: {
    fontSize: 12,
    fontWeight: '600' as any,
    color: '#111827',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    marginBottom: 65,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  titleContainer: {
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700' as any,
    color: '#111827',
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 14,
    paddingVertical: 20,
  },
  emptyStateCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600' as any,
    color: '#6b7280',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },
  listCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listHeaderView: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  listTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  listEmoji: {
    fontSize: 24,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '700' as any,
    color: '#111827',
  },
  listBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  listBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 28,
    alignItems: 'center',
  },
  listBadgeText: {
    fontSize: 12,
    fontWeight: '700' as any,
    color: '#ffffff',
  },
  sectionsContainer: {
    gap: 16,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionHeaderCollapsed: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    flex: 1,
  },
  sectionAccent: {
    width: 3,
    height: 18,
    borderRadius: 2,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as any,
    color: '#111827',
  },
  sectionBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionBadge: {
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 28,
    alignItems: 'center',
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: '700' as any,
    color: '#ffffff',
  },
  taskList: {
    gap: 8,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500' as any,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  taskDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priorityHigh: {
    backgroundColor: '#fee2e2',
  },
  priorityMedium: {
    backgroundColor: '#fef3c7',
  },
  priorityLow: {
    backgroundColor: '#dcfce7',
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600' as any,
    color: '#111827',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 75,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 25,
    zIndex: 25,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 20,
    zIndex: 20,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  navLabelActive: {
    fontSize: 11,
    color: '#111827',
    fontWeight: '700' as any,
    marginTop: 4,
  },
  navLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600' as any,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as any,
    color: '#111827',
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    backgroundColor: '#fafafa',
    marginBottom: 12,
    color: '#111827',
  },
  modalTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  modalFieldHalf: {
    flex: 1,
  },
  modalFieldFull: {
    marginBottom: 16,
  },
  modalFieldLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  modalFieldLabelText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500' as any,
  },
  modalInputSmall: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fafafa',
    color: '#111827',
    justifyContent: 'center',
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#d1d5db',
  },
  priorityDotHigh: {
    backgroundColor: '#ef4444',
  },
  priorityDotMedium: {
    backgroundColor: '#f59e0b',
  },
  priorityDotLow: {
    backgroundColor: '#22c55e',
  },
  prioritySelectText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500' as any,
  },
  sectionPicker: {
    flexDirection: 'row',
  },
  sectionPickerItem: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
    backgroundColor: '#fafafa',
  },
  sectionPickerItemActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  sectionPickerText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500' as any,
  },
  sectionPickerTextActive: {
    color: '#3b82f6',
    fontWeight: '600' as any,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  modalBtnCancelText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500' as any,
  },
  modalBtnSave: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  modalBtnSaveText: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '600' as any,
  },
});

export default HomeScreen;
