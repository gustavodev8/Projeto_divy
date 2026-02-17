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
  SafeAreaView,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Animated,
} from 'react-native';
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
    priority: 'medium'
  });

  // Carregar dados completos: Listas → Seções → Tarefas
  const loadData = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      console.log('🔄 INICIANDO CARREGAMENTO DE DADOS...');
      console.log('👤 Usuário atual:', user?.name, '(ID:', user?.id, ')');

      // 1. Buscar todas as listas
      console.log('📡 Chamando listService.getLists()...');
      const listsResult = await listService.getLists();
      console.log('📥 Resultado getLists:', listsResult);

      if (!listsResult.success || !listsResult.lists) {
        console.error('❌ Erro ao carregar listas:', listsResult.error);
        Alert.alert('Erro', listsResult.error || 'Erro ao carregar listas');
        setLoading(false);
        return;
      }

      const listsData = listsResult.lists;
      console.log(`✅ ${listsData.length} listas carregadas:`, listsData.map(l => `${l.emoji} ${l.name}`));

      // 2. Para cada lista, buscar suas seções
      console.log('📂 Carregando seções para cada lista...');
      const listsWithSections: ListWithSections[] = await Promise.all(
        listsData.map(async (list) => {
          console.log(`  📋 Lista: ${list.emoji} ${list.name} (ID: ${list.id})`);

          const sectionsResult = await sectionService.getSectionsByList(list.id);
          console.log(`    📁 Seções recebidas:`, sectionsResult);

          const sections = sectionsResult.success ? sectionsResult.sections || [] : [];
          console.log(`    ✅ ${sections.length} seções para lista ${list.id}`);

          // 3. Para cada seção, buscar suas tarefas
          const sectionsWithTasks: SectionWithTasks[] = await Promise.all(
            sections.map(async (section) => {
              console.log(`      📁 Seção: ${section.emoji || ''} ${section.name} (ID: ${section.id})`);

              const tasksResult = await taskService.getTasksBySection(section.id);
              const tasks = tasksResult.success ? tasksResult.tasks || [] : [];
              console.log(`        ✅ ${tasks.length} tarefas para seção ${section.id}`);

              return {
                ...section,
                tasks,
                expanded: true, // Seções começam expandidas
              };
            })
          );

          return {
            ...list,
            sections: sectionsWithTasks,
            expanded: true, // Listas começam expandidas
          };
        })
      );

      console.log('💾 Salvando listas no estado...');
      setLists(listsWithSections);
      console.log('✅ Listas salvas no estado!');

      // Selecionar primeira lista como padrão se nenhuma estiver selecionada
      if (!selectedListId && listsWithSections.length > 0) {
        const defaultList = listsWithSections.find(l => l.is_default) || listsWithSections[0];
        console.log('🎯 Selecionando lista padrão:', defaultList.name, '(ID:', defaultList.id, ')');
        setSelectedListId(defaultList.id);
      } else {
        console.log('📌 Lista já selecionada:', selectedListId);
      }

      console.log('✅ ✅ ✅ DADOS CARREGADOS COM SUCESSO! ✅ ✅ ✅');
      console.log('📊 Resumo:');
      console.log(`  - ${listsWithSections.length} listas`);
      console.log(`  - Lista selecionada: ${selectedListId}`);
      listsWithSections.forEach(list => {
        console.log(`  - ${list.emoji} ${list.name}: ${list.sections.length} seções`);
        list.sections.forEach(section => {
          console.log(`    - ${section.emoji || ''} ${section.name}: ${section.tasks.length} tarefas`);
        });
      });
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      Alert.alert('Erro', 'Erro ao carregar dados');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  // Debug: monitorar mudanças na lista selecionada
  useEffect(() => {
    console.log('🔄 selectedListId MUDOU:', selectedListId);
    console.log('📋 Total de listas carregadas:', lists.length);
    const selected = lists.find(l => l.id === selectedListId);
    if (selected) {
      console.log('✅ Lista encontrada:', selected.name, 'com', selected.sections.length, 'seções');
    } else {
      console.log('⚠️ Lista não encontrada no array de listas');
    }
  }, [selectedListId, lists]);

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
      newTask.priority
    );

    if (result.success) {
      setModalVisible(false);
      setNewTask({ title: '', description: '', priority: 'medium' });
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

  // Renderizar seção como card completo (sempre expandido)
  const renderSection = (list: ListWithSections, section: SectionWithTasks): React.JSX.Element => (
    <View key={section.id} style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleContainer}>
          {section.emoji && <Text style={styles.sectionEmoji}>{section.emoji}</Text>}
          <Text style={styles.sectionTitle}>{section.name}</Text>
        </View>
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionBadgeText}>{section.tasks.length}</Text>
        </View>
      </View>

      <View style={styles.taskList}>
        {section.tasks.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma tarefa nesta seção</Text>
        ) : (
          section.tasks.map(renderTask)
        )}
      </View>
    </View>
  );

  // Handler para selecionar lista
  const handleSelectList = (listId: number): void => {
    console.log('🎯 handleSelectList CHAMADO! Lista ID:', listId);
    console.log('📋 Lista anterior:', selectedListId);
    setSelectedListId(listId);
    console.log('✅ Lista atualizada para:', listId);
  };

  // Filtrar lista selecionada
  const selectedList = selectedListId ? lists.find(l => l.id === selectedListId) : lists[0];

  // Renderizar lista selecionada
  const renderSelectedList = (): React.JSX.Element | null => {
    console.log('🎨 renderSelectedList CHAMADO');
    console.log('  selectedListId:', selectedListId);
    console.log('  selectedList:', selectedList ? `${selectedList.emoji} ${selectedList.name}` : 'null');

    if (!selectedList) {
      console.log('⚠️ Nenhuma lista selecionada para renderizar');
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Nenhuma lista selecionada</Text>
        </View>
      );
    }

    console.log('✅ Renderizando lista:', selectedList.name);
    console.log('  Seções:', selectedList.sections.length);

    return (
      <View style={styles.listCard}>
        <View style={styles.listHeaderView}>
          <View style={styles.listTitleContainer}>
            <Text style={styles.listEmoji}>{selectedList.emoji}</Text>
            <Text style={styles.listTitle}>{selectedList.name}</Text>
          </View>
          <View style={styles.listBadgeContainer}>
            <View style={[styles.listBadge, { backgroundColor: selectedList.color }]}>
              <Text style={styles.listBadgeText}>{selectedList.sections.length}</Text>
            </View>
          </View>
        </View>

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
            selectedList.sections.map(section => {
              console.log('  📁 Renderizando seção:', section.name, 'com', section.tasks.length, 'tarefas');
              return renderSection(selectedList, section);
            })
          )}
        </View>
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

      {/* Bottom Navigation */}
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
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova Tarefa</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Título da tarefa"
              placeholderTextColor="#9ca3af"
              value={newTask.title}
              onChangeText={(text) => setNewTask({ ...newTask, title: text })}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Descrição (opcional)"
              placeholderTextColor="#9ca3af"
              value={newTask.description}
              onChangeText={(text) => setNewTask({ ...newTask, description: text })}
              multiline
              numberOfLines={4}
            />

            <Text style={styles.label}>Prioridade:</Text>
            <View style={styles.priorityContainer}>
              {(['low', 'medium', 'high'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityButton,
                    newTask.priority === p && styles.priorityButtonActive,
                  ]}
                  onPress={() => setNewTask({ ...newTask, priority: p })}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.priorityButtonText,
                      newTask.priority === p && styles.priorityButtonTextActive,
                    ]}
                  >
                    {p === 'low' ? 'Baixa' : p === 'medium' ? 'Média' : 'Alta'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.modalButtonSave}
              onPress={handleCreateTask}
              activeOpacity={0.85}
            >
              <Text style={styles.modalButtonTextSave}>Criar Tarefa</Text>
            </TouchableOpacity>
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
  },
  scrollContent: {
    paddingBottom: 100,
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
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sectionEmoji: {
    fontSize: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as any,
    color: '#111827',
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
    bottom: 90,
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
    elevation: 8,
  },
  bottomNav: {
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
    elevation: 5,
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700' as any,
    color: '#111827',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    backgroundColor: '#ffffff',
    marginBottom: 16,
    color: '#111827',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as any,
    color: '#111827',
    marginBottom: 10,
  },
  priorityContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  priorityButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  priorityButtonActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  priorityButtonText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500' as any,
  },
  priorityButtonTextActive: {
    color: '#ffffff',
    fontWeight: '700' as any,
  },
  modalButtonSave: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  modalButtonTextSave: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '700' as any,
  },
});

export default HomeScreen;
