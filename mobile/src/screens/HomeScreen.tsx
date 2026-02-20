/**
 * DIVY - Home Screen
 * Tela principal com estrutura: Listas → Seções → Tarefas
 * Design fidedigno à referência — Plus Jakarta Sans, barras azuis
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
  Easing,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, Feather } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useAuth } from '../contexts/AuthContext';
import * as taskService from '../services/taskService';
import * as listService from '../services/listService';
import * as sectionService from '../services/sectionService';
import { List } from '../services/listService';
import { Section } from '../services/sectionService';
import Sidebar from '../components/Sidebar';
import { Task } from '../types/api';
import { NavigationProp } from '../types/navigation';

// ── Tipos ──────────────────────────────────────────────────
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

interface EditTaskState {
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
  fullDate: string;
}

interface ListWithSections extends List {
  sections: SectionWithTasks[];
  expanded: boolean;
}

interface SectionWithTasks extends Section {
  tasks: Task[];
  expanded: boolean;
}

// ── Font family helpers ────────────────────────────────────
const F = {
  regular:   'PlusJakartaSans_400Regular',
  medium:    'PlusJakartaSans_500Medium',
  semibold:  'PlusJakartaSans_600SemiBold',
  bold:      'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

// ── Cores do design ────────────────────────────────────────
const C = {
  bg:        '#f8fafc',
  card:      '#ffffff',
  border:    '#e2e8f0',
  fg:        '#1e293b',
  fgSub:     '#64748b',
  muted:     '#94a3b8',
  primary:   '#3b82f6',
  primaryBg: '#eff6ff',
  accent:    '#4b6ef5',
};

// ═══ TaskItem — tarefa com animação de risco ═══════════════
interface TaskItemProps {
  task: Task;
  onToggle: () => void;
  onLongPress: () => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onToggle, onLongPress }) => {
  const completed = task.status === 'completed';
  const strikeAnim = useRef(new Animated.Value(completed ? 1 : 0)).current;
  const contentOpacity = useRef(new Animated.Value(completed ? 0.45 : 1)).current;
  const checkAnim = useRef(new Animated.Value(completed ? 1 : 0)).current;
  const prevCompleted = useRef(completed);

  useEffect(() => {
    if (prevCompleted.current === completed) return;
    prevCompleted.current = completed;

    if (completed) {
      Animated.parallel([
        Animated.timing(strikeAnim, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(contentOpacity, { toValue: 0.45, duration: 320, delay: 100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(checkAnim, { toValue: 1, duration: 220, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(strikeAnim, { toValue: 0, duration: 280, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
        Animated.timing(contentOpacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(checkAnim, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start();
    }
  }, [completed]);

  const checkScale = checkAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.18, 1],
  });

  const pColor = task.priority === 'high' ? '#f97316' : task.priority === 'medium' ? '#f59e0b' : '#22c55e';
  const pLabel = task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa';

  const formatDueDate = (iso?: string): string | null => {
    if (!iso) return null;
    try {
      const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      const d = new Date(iso);
      if (isNaN(d.getTime())) return null;
      const day = d.getDate();
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      const thisYear = new Date().getFullYear();
      return year === thisYear ? `${day} ${month}` : `${day} ${month} ${year}`;
    } catch { return null; }
  };

  return (
    <TouchableOpacity
      style={[st.taskItem, completed && st.taskItemCompleted]}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7} style={{ marginHorizontal: 14 }}>
        <Animated.View style={[
          st.checkbox,
          completed && st.checkboxChecked,
          { transform: [{ scale: checkScale }] },
        ]}>
          {completed && <Ionicons name="checkmark" size={13} color="#ffffff" />}
        </Animated.View>
      </TouchableOpacity>

      <Animated.View style={[st.taskContent, { opacity: contentOpacity }]}>
        <View style={{ position: 'relative' }}>
          <Text style={[st.taskTitle, completed && { color: C.muted }]} numberOfLines={1}>
            {task.title}
          </Text>
          <Animated.View
            style={{
              position: 'absolute', top: '50%', left: 0, height: 1.5,
              backgroundColor: C.muted,
              width: strikeAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }}
            pointerEvents="none"
          />
        </View>

        {task.description ? (
          <Text style={st.taskDescription} numberOfLines={1}>{task.description}</Text>
        ) : null}

        {task.priority && (
          <View style={st.taskPriorityRow}>
            <View style={[st.taskPriorityDot, { backgroundColor: completed ? '#cbd5e1' : pColor }]} />
            <Text style={[st.taskPriorityLabel, { color: completed ? C.muted : pColor }]}>{pLabel}</Text>
          </View>
        )}
      </Animated.View>

      {formatDueDate(task.due_date) ? (
        <View style={st.taskDueDateBadge}>
          <Ionicons name="calendar-outline" size={11} color={completed ? '#cbd5e1' : C.fgSub} />
          <Text style={[st.taskDueDateText, completed && { color: '#cbd5e1' }]}>
            {formatDueDate(task.due_date)}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

// ═══ SectionAccordion — seção colapsável ═══════════════════
interface SectionAccordionProps {
  section: SectionWithTasks;
  onToggle: () => void;
  onLongPress: () => void;
  renderTask: (task: Task) => React.JSX.Element;
}

const SectionAccordion: React.FC<SectionAccordionProps> = ({ section, onToggle, onLongPress, renderTask }) => {
  const animHeight = useRef(new Animated.Value(0)).current;
  const animRotate = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(0);
  const [measured, setMeasured] = useState(false);

  useEffect(() => {
    if (!measured) return;
    Animated.parallel([
      Animated.timing(animHeight, {
        toValue: section.expanded ? contentHeight : 0,
        duration: 280,
        easing: section.expanded ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(animRotate, {
        toValue: section.expanded ? 1 : 0,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [section.expanded, contentHeight, measured]);

  const rotate = animRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  return (
    <View style={st.sectionCard}>
      <TouchableOpacity
        style={[st.sectionHeader, !section.expanded && st.sectionHeaderCollapsed]}
        onPress={onToggle}
        onLongPress={onLongPress}
        delayLongPress={400}
        activeOpacity={0.7}
      >
        <View style={st.sectionTitleContainer}>
          {/* Barra azul à esquerda — sempre azul */}
          <View style={st.sectionAccent} />
          <Text style={st.sectionTitle}>{section.name}</Text>
        </View>
        <View style={st.sectionBadgeContainer}>
          <View style={st.sectionBadge}>
            <Text style={st.sectionBadgeText}>{section.tasks.length}</Text>
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
            const h = e.nativeEvent.layout.height - 8;
            setContentHeight(h);
            setMeasured(true);
            if (section.expanded) animHeight.setValue(h);
          }}
        >
          <View style={[st.taskList, { paddingTop: 8 }]}>
            {section.tasks.length === 0 ? (
              <Text style={st.emptyText}>Nenhuma tarefa nesta seção</Text>
            ) : (
              section.tasks.map(renderTask)
            )}
          </View>
        </View>
      )}

      <Animated.View style={{ height: animHeight, overflow: 'hidden' }}>
        <View style={[st.taskList, { paddingTop: 8 }]}>
          {section.tasks.length === 0 ? (
            <Text style={st.emptyText}>Nenhuma tarefa nesta seção</Text>
          ) : (
            section.tasks.map(renderTask)
          )}
        </View>
      </Animated.View>
    </View>
  );
};

// ═══ HomeScreen — Componente principal ═════════════════════
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
    title: '', description: '', priority: 'medium', dueDate: '', sectionId: null,
  });

  // Modal para editar tarefa (legado, mantido por compatibilidade)
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<EditTaskState>({
    title: '', description: '', priority: 'medium', dueDate: '', sectionId: null,
  });

  // Date picker nativo
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [datePickerTarget, setDatePickerTarget] = useState<'create' | 'edit'>('create');

  // Modal de nova seção
  const [showAddSection, setShowAddSection] = useState<boolean>(false);
  const [addingSectionName, setAddingSectionName] = useState<string>('');

  // Modal de edição de seção (long press)
  const [editSectionModal, setEditSectionModal] = useState<boolean>(false);
  const [editingSection, setEditingSection] = useState<SectionWithTasks | null>(null);
  const [editSectionName, setEditSectionName] = useState<string>('');

  // ── Carregar dados ───────────────────────────────────────
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

  useEffect(() => { loadData(); }, []);

  const onRefresh = (): void => { setRefreshing(true); loadData(); };

  // ── CRUD Tarefas ─────────────────────────────────────────
  const handleCreateTask = async (): Promise<void> => {
    if (!newTask.title.trim()) {
      Alert.alert('Erro', 'Digite um título para a tarefa');
      return;
    }

    const result = await taskService.createTask(
      newTask.title, newTask.description, newTask.priority,
      { due_date: newTask.dueDate || undefined, list_id: selectedList?.id || undefined, section_id: newTask.sectionId || undefined }
    );

    if (result.success) {
      setModalVisible(false);
      setNewTask({ title: '', description: '', priority: 'medium', dueDate: '', sectionId: null });

      if (result.task) {
        const createdTask = result.task;
        setLists(prev => prev.map(list => {
          if (list.id !== selectedList?.id) return list;
          return {
            ...list,
            sections: list.sections.map(section => {
              const targetSectionId = createdTask.section_id ?? list.sections[0]?.id;
              if (section.id !== targetSectionId) return section;
              return { ...section, tasks: [...section.tasks, createdTask] };
            }),
          };
        }));
      } else {
        loadData();
      }
    } else {
      Alert.alert('Erro', result.error || 'Erro ao criar tarefa');
    }
  };

  const updateTaskInState = (taskId: number, updates: Partial<Task>): void => {
    setLists(prev => prev.map(list => ({
      ...list,
      sections: list.sections.map(section => ({
        ...section,
        tasks: section.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t),
      })),
    })));
  };

  const removeTaskFromState = (taskId: number): void => {
    setLists(prev => prev.map(list => ({
      ...list,
      sections: list.sections.map(section => ({
        ...section,
        tasks: section.tasks.filter(t => t.id !== taskId),
      })),
    })));
  };

  const handleToggleTask = async (task: Task): Promise<void> => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    updateTaskInState(task.id, { status: newStatus });
    const result = await taskService.toggleTaskStatus(task.id, task.status);
    if (!result.success) {
      updateTaskInState(task.id, { status: task.status });
      Alert.alert('Erro', result.error || 'Erro ao atualizar tarefa');
    }
  };

  const handleDeleteTask = async (taskId: number): Promise<void> => {
    Alert.alert('Confirmar', 'Deseja deletar esta tarefa?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Deletar', style: 'destructive',
        onPress: async () => {
          removeTaskFromState(taskId);
          const result = await taskService.deleteTask(taskId);
          if (!result.success) { loadData(); Alert.alert('Erro', result.error || 'Erro ao deletar tarefa'); }
        },
      },
    ]);
  };

  const handleOpenEdit = (task: Task): void => {
    navigation.navigate('TaskDetail', {
      taskId: task.id,
      listId: selectedList?.id ?? 0,
      task,
      onSave: (updatedTask: Task) => { updateTaskInState(updatedTask.id, updatedTask); },
      onDelete: (taskId: number) => { removeTaskFromState(taskId); },
    } as any);
  };

  const handleUpdateTask = async (): Promise<void> => {
    if (!editingTask || !editTask.title.trim()) {
      Alert.alert('Erro', 'O título não pode ficar vazio');
      return;
    }
    const sectionChanged = editTask.sectionId !== (editingTask.section_id || null);
    const result = await taskService.updateTask(editingTask.id, {
      title: editTask.title, description: editTask.description, priority: editTask.priority,
      due_date: editTask.dueDate || undefined,
      section_id: editTask.sectionId !== null ? editTask.sectionId : undefined,
    });

    if (result.success && result.task) {
      const updatedTask = result.task;
      if (sectionChanged) {
        setLists(prev => prev.map(list => ({
          ...list,
          sections: list.sections.map(section => {
            if (section.id === editingTask.section_id) return { ...section, tasks: section.tasks.filter(t => t.id !== editingTask.id) };
            if (section.id === editTask.sectionId) return { ...section, tasks: [...section.tasks, updatedTask] };
            return section;
          }),
        })));
      } else {
        updateTaskInState(editingTask.id, updatedTask);
      }
      setEditModalVisible(false);
      setEditingTask(null);
    } else {
      Alert.alert('Erro', result.error || 'Erro ao atualizar tarefa');
    }
  };

  // ── CRUD Seções ──────────────────────────────────────────
  const handleCreateSection = async (): Promise<void> => {
    const name = addingSectionName.trim();
    if (!name || !selectedList) return;
    setShowAddSection(false);
    setAddingSectionName('');
    const result = await sectionService.createSection(name, selectedList.id);
    if (result.success && result.section) {
      const newSection = { ...result.section, tasks: [], expanded: true } as SectionWithTasks;
      setLists(prev => prev.map(list =>
        list.id === selectedList.id ? { ...list, sections: [...list.sections, newSection] } : list
      ));
    } else {
      Alert.alert('Erro', result.error || 'Erro ao criar seção');
    }
  };

  const handleOpenEditSection = (section: SectionWithTasks): void => {
    setEditingSection(section);
    setEditSectionName(section.name);
    setEditSectionModal(true);
  };

  const handleRenameSection = async (): Promise<void> => {
    const name = editSectionName.trim();
    if (!name || !editingSection) return;
    const result = await sectionService.updateSection(editingSection.id, name);
    if (result.success) {
      setLists(prev => prev.map(list => ({
        ...list, sections: list.sections.map(s => s.id === editingSection.id ? { ...s, name } : s),
      })));
      setEditSectionModal(false);
      setEditingSection(null);
    } else {
      Alert.alert('Erro', result.error || 'Erro ao renomear seção');
    }
  };

  const handleDeleteSection = (): void => {
    if (!editingSection) return;
    Alert.alert(
      'Excluir seção',
      `Tem certeza que deseja excluir "${editingSection.name}"? As tarefas desta seção serão mantidas sem seção.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir', style: 'destructive',
          onPress: async () => {
            const result = await sectionService.deleteSection(editingSection.id);
            if (result.success) {
              setLists(prev => prev.map(list => ({
                ...list, sections: list.sections.filter(s => s.id !== editingSection.id),
              })));
              setEditSectionModal(false);
              setEditingSection(null);
            } else {
              Alert.alert('Erro', result.error || 'Erro ao excluir seção');
            }
          },
        },
      ]
    );
  };

  const MAX_SECTION_NAME = 20;

  // ── DateTimePicker handler ───────────────────────────────
  const handleDateChange = (event: DateTimePickerEvent, date?: Date): void => {
    setShowDatePicker(false);
    if (event.type === 'set' && date) {
      const iso = date.toISOString();
      if (datePickerTarget === 'create') {
        setNewTask(prev => ({ ...prev, dueDate: iso }));
      } else {
        setEditTask(prev => ({ ...prev, dueDate: iso }));
      }
    }
  };

  // ── Toggle expansão ──────────────────────────────────────
  const toggleSection = (listId: number, sectionId: number): void => {
    setLists(lists.map(list =>
      list.id === listId
        ? { ...list, sections: list.sections.map(s => s.id === sectionId ? { ...s, expanded: !s.expanded } : s) }
        : list
    ));
  };

  // ── Data atual ───────────────────────────────────────────
  const getCurrentDate = (): DateInfo => {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const now = new Date();
    return {
      dayName: days[now.getDay()],
      day: now.getDate(),
      month: months[now.getMonth()],
      fullDate: `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`,
    };
  };

  const dateInfo = getCurrentDate();

  const formatDueDate = (iso?: string): string | null => {
    if (!iso) return null;
    try {
      const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      const d = new Date(iso);
      if (isNaN(d.getTime())) return null;
      const day = d.getDate();
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      const thisYear = new Date().getFullYear();
      return year === thisYear ? `${day} ${month}` : `${day} ${month} ${year}`;
    } catch { return null; }
  };

  // ── Render helpers ───────────────────────────────────────
  const renderTask = (task: Task): React.JSX.Element => (
    <TaskItem
      key={task.id}
      task={task}
      onToggle={() => handleToggleTask(task)}
      onLongPress={() => handleOpenEdit(task)}
    />
  );

  const renderSection = (list: ListWithSections, section: SectionWithTasks): React.JSX.Element => (
    <SectionAccordion
      key={section.id}
      section={section}
      onToggle={() => toggleSection(list.id, section.id)}
      onLongPress={() => handleOpenEditSection(section)}
      renderTask={renderTask}
    />
  );

  const handleSelectList = (listId: number): void => { setSelectedListId(listId); };

  const selectedList = selectedListId ? lists.find(l => l.id === selectedListId) : lists[0];

  const getFirstName = (name?: string): string => {
    if (!name) return 'bem-vindo';
    return name.split(' ')[0];
  };

  const totalTasks = selectedList?.sections.reduce((sum, s) => sum + s.tasks.length, 0) || 0;

  // ═══ RENDER ══════════════════════════════════════════════
  return (
    <SafeAreaView style={st.container}>
      <StatusBar style="dark" />

      {/* Sidebar */}
      <Sidebar
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
        selectedListId={selectedListId}
        onSelectList={handleSelectList}
      />

      {/* ── HEADER ── */}
      <View style={st.header}>
        <View style={st.headerLeft}>
          <TouchableOpacity style={st.menuButton} onPress={() => setSidebarVisible(true)}>
            <Ionicons name="menu" size={24} color={C.fg} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={st.greeting}>Olá, {getFirstName(user?.name)}!</Text>
            <Text style={st.date}>{dateInfo.dayName}, {dateInfo.day} {dateInfo.month}</Text>
          </View>
        </View>
        <View style={st.dateChip}>
          <Ionicons name="calendar-outline" size={14} color={C.primary} />
          <Text style={st.dateChipText}>{dateInfo.fullDate}</Text>
        </View>
      </View>

      {/* ── SEARCH BAR ── */}
      <View style={st.searchContainer}>
        <Feather name="search" size={18} color={C.muted} />
        <TextInput
          style={st.searchInput}
          placeholder="Buscar tarefas, listas..."
          placeholderTextColor={C.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* ── CONTENT ── */}
      {loading ? (
        <ActivityIndicator size="large" color={C.primary} style={st.loading} />
      ) : (
        <ScrollView
          style={st.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={st.scrollContent}
        >
          {/* Título "Tarefas" + contagem */}
          <View style={st.titleRow}>
            <View>
              <Text style={st.pageTitle}>Tarefas</Text>
              <Text style={st.pageSubtitle}>
                {selectedList?.sections.length || 0} seção(ões) · {totalTasks} tarefa(s)
              </Text>
            </View>
          </View>

          {/* Seções */}
          {selectedList ? (
            <View style={st.sectionsContainer}>
              {selectedList.sections.length === 0 ? (
                <View style={st.emptyStateCard}>
                  <Ionicons name="folder-open-outline" size={48} color="#d1d5db" />
                  <Text style={st.emptyStateTitle}>Nenhuma seção nesta lista</Text>
                  <Text style={st.emptyStateSub}>
                    As seções ajudam a organizar suas tarefas em grupos
                  </Text>
                </View>
              ) : (
                selectedList.sections.map(section => renderSection(selectedList, section))
              )}

              {/* Botão Nova Seção */}
              <TouchableOpacity
                style={st.addSectionBtn}
                onPress={() => { setAddingSectionName(''); setShowAddSection(true); }}
                activeOpacity={0.6}
              >
                <Ionicons name="add" size={16} color={C.muted} />
                <Text style={st.addSectionBtnText}>Nova Seção</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={st.emptyContainer}>
              <Text style={st.emptyText}>Nenhuma lista selecionada</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── FAB ── */}
      <TouchableOpacity style={st.fab} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
        <Ionicons name="add" size={30} color="#ffffff" />
      </TouchableOpacity>

      {/* ── BOTTOM NAV ── */}
      <View style={st.bottomNav}>
        <TouchableOpacity style={st.navItem} onPress={() => setActiveTab('tasks')} activeOpacity={0.7}>
          <Ionicons
            name={activeTab === 'tasks' ? 'checkmark-circle' : 'checkmark-circle-outline'}
            size={24}
            color={activeTab === 'tasks' ? C.primary : C.muted}
          />
          <Text style={[st.navLabel, activeTab === 'tasks' && st.navLabelActive]}>Tarefas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.navItem} onPress={() => setActiveTab('agenda')} activeOpacity={0.7}>
          <Ionicons
            name={activeTab === 'agenda' ? 'calendar' : 'calendar-outline'}
            size={24}
            color={activeTab === 'agenda' ? C.primary : C.muted}
          />
          <Text style={[st.navLabel, activeTab === 'agenda' && st.navLabelActive]}>Agenda</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.navItem} onPress={() => setActiveTab('ia')} activeOpacity={0.7}>
          <Ionicons
            name={activeTab === 'ia' ? 'sparkles' : 'sparkles-outline'}
            size={24}
            color={activeTab === 'ia' ? C.primary : C.muted}
          />
          <Text style={[st.navLabel, activeTab === 'ia' && st.navLabelActive]}>IA</Text>
        </TouchableOpacity>
      </View>

      {/* ═══ Modal Criar Tarefa ═══ */}
      <Modal visible={modalVisible} animationType="fade" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>Nova Tarefa</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={st.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={st.modalInput}
              placeholder="Título da tarefa"
              placeholderTextColor={C.muted}
              value={newTask.title}
              onChangeText={(text) => setNewTask({ ...newTask, title: text })}
              autoFocus
            />

            <TextInput
              style={[st.modalInput, st.modalTextArea]}
              placeholder="Descrição (opcional)"
              placeholderTextColor={C.muted}
              value={newTask.description}
              onChangeText={(text) => setNewTask({ ...newTask, description: text })}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={st.modalRow}>
              <View style={st.modalFieldHalf}>
                <View style={st.modalFieldLabel}>
                  <Ionicons name="calendar-outline" size={13} color="#6b7280" />
                  <Text style={st.modalFieldLabelText}>Data de vencimento</Text>
                </View>
                <TouchableOpacity
                  style={st.modalInputSmall}
                  onPress={() => { setDatePickerTarget('create'); setShowDatePicker(true); }}
                  activeOpacity={0.7}
                >
                  <Text style={newTask.dueDate ? st.datePickerText : st.datePickerPlaceholder}>
                    {newTask.dueDate ? formatDueDate(newTask.dueDate) : 'Selecionar'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={st.modalFieldHalf}>
                <View style={st.modalFieldLabel}>
                  <Ionicons name="flag-outline" size={13} color="#6b7280" />
                  <Text style={st.modalFieldLabelText}>Prioridade</Text>
                </View>
                <TouchableOpacity
                  style={st.modalInputSmall}
                  onPress={() => {
                    const order: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
                    const next = order[(order.indexOf(newTask.priority) + 1) % 3];
                    setNewTask({ ...newTask, priority: next });
                  }}
                  activeOpacity={0.7}
                >
                  <View style={st.priorityRow}>
                    <View style={[
                      st.priorityDot,
                      newTask.priority === 'high' && st.priorityDotHigh,
                      newTask.priority === 'medium' && st.priorityDotMedium,
                      newTask.priority === 'low' && st.priorityDotLow,
                    ]} />
                    <Text style={st.prioritySelectText}>
                      {newTask.priority === 'high' ? 'Alta' : newTask.priority === 'medium' ? 'Média' : 'Baixa'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            <View style={st.modalFieldFull}>
              <View style={st.modalFieldLabel}>
                <Ionicons name="folder-outline" size={13} color="#6b7280" />
                <Text style={st.modalFieldLabelText}>Seção</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.sectionPicker}>
                <TouchableOpacity
                  style={[st.sectionPickerItem, newTask.sectionId === null && st.sectionPickerItemActive]}
                  onPress={() => setNewTask({ ...newTask, sectionId: null })}
                  activeOpacity={0.7}
                >
                  <Text style={[st.sectionPickerText, newTask.sectionId === null && st.sectionPickerTextActive]}>Sem seção</Text>
                </TouchableOpacity>
                {selectedList?.sections.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[st.sectionPickerItem, newTask.sectionId === s.id && st.sectionPickerItemActive]}
                    onPress={() => setNewTask({ ...newTask, sectionId: s.id })}
                    activeOpacity={0.7}
                  >
                    <Text style={[st.sectionPickerText, newTask.sectionId === s.id && st.sectionPickerTextActive]}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={st.modalButtons}>
              <TouchableOpacity style={st.modalBtnCancel} onPress={() => setModalVisible(false)} activeOpacity={0.7}>
                <Text style={st.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.modalBtnSave} onPress={handleCreateTask} activeOpacity={0.85}>
                <Ionicons name="add" size={18} color="#ffffff" />
                <Text style={st.modalBtnSaveText}>Criar Tarefa</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══ Modal Editar Seção ═══ */}
      <Modal visible={editSectionModal} animationType="fade" transparent onRequestClose={() => setEditSectionModal(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>Editar Seção</Text>
              <View style={st.modalHeaderActions}>
                <TouchableOpacity onPress={handleDeleteSection} style={st.modalDeleteBtn}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditSectionModal(false)} style={st.modalCloseBtn}>
                  <Ionicons name="close" size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={st.sectionModalLabel}>NOME DA SEÇÃO</Text>
            <TextInput
              style={st.sectionModalInput}
              placeholder="Nome da seção..."
              placeholderTextColor={C.muted}
              value={editSectionName}
              onChangeText={(t) => setEditSectionName(t.slice(0, MAX_SECTION_NAME))}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleRenameSection}
              maxLength={MAX_SECTION_NAME}
            />
            <Text style={st.sectionModalCounter}>{editSectionName.length}/{MAX_SECTION_NAME} caracteres</Text>

            <View style={st.modalButtons}>
              <TouchableOpacity style={st.modalBtnCancel} onPress={() => setEditSectionModal(false)} activeOpacity={0.7}>
                <Text style={st.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.modalBtnSave, !editSectionName.trim() && { opacity: 0.5 }]}
                onPress={handleRenameSection}
                activeOpacity={0.85}
                disabled={!editSectionName.trim()}
              >
                <Ionicons name="checkmark" size={18} color="#ffffff" />
                <Text style={st.modalBtnSaveText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══ Modal Nova Seção ═══ */}
      <Modal visible={showAddSection} animationType="fade" transparent onRequestClose={() => setShowAddSection(false)}>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>Nova Seção</Text>
              <TouchableOpacity onPress={() => setShowAddSection(false)} style={st.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text style={st.sectionModalLabel}>NOME DA SEÇÃO</Text>
            <TextInput
              style={st.sectionModalInput}
              placeholder="Ex: Trabalho, Pessoal, Urgente..."
              placeholderTextColor={C.muted}
              value={addingSectionName}
              onChangeText={(t) => setAddingSectionName(t.slice(0, MAX_SECTION_NAME))}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateSection}
              maxLength={MAX_SECTION_NAME}
            />
            <Text style={st.sectionModalCounter}>Máximo {MAX_SECTION_NAME} caracteres</Text>

            <View style={st.modalButtons}>
              <TouchableOpacity style={st.modalBtnCancel} onPress={() => setShowAddSection(false)} activeOpacity={0.7}>
                <Text style={st.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.modalBtnSave, !addingSectionName.trim() && { opacity: 0.5 }]}
                onPress={handleCreateSection}
                activeOpacity={0.85}
                disabled={!addingSectionName.trim()}
              >
                <Ionicons name="add" size={18} color="#ffffff" />
                <Text style={st.modalBtnSaveText}>Criar Seção</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* DateTimePicker nativo */}
      {showDatePicker && (
        <DateTimePicker
          value={(() => {
            const src = datePickerTarget === 'create' ? newTask.dueDate : editTask.dueDate;
            const d = src ? new Date(src) : new Date();
            return isNaN(d.getTime()) ? new Date() : d;
          })()}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════════
// STYLES — Plus Jakarta Sans + Design fidedigno à referência
// ═══════════════════════════════════════════════════════════
const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuButton: {
    marginRight: 14,
  },
  greeting: {
    fontSize: 18,
    fontFamily: F.bold,
    color: C.fg,
  },
  date: {
    fontSize: 13,
    fontFamily: F.medium,
    color: C.fgSub,
    marginTop: 2,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.primaryBg,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
  },
  dateChipText: {
    fontSize: 12,
    fontFamily: F.semibold,
    color: C.primary,
  },

  // ── Search ──
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: F.regular,
    color: C.fg,
  },

  // ── Loading ──
  loading: {
    flex: 1,
    justifyContent: 'center',
  },

  // ── Content / Scroll ──
  content: {
    flex: 1,
    paddingHorizontal: 20,
    marginBottom: 65,
  },
  scrollContent: {
    paddingBottom: 80,
    paddingTop: 4,
  },

  // ── Title row ──
  titleRow: {
    marginBottom: 18,
    marginTop: 8,
  },
  pageTitle: {
    fontSize: 24,
    fontFamily: F.bold,
    color: C.fg,
  },
  pageSubtitle: {
    fontSize: 13,
    fontFamily: F.medium,
    color: C.fgSub,
    marginTop: 3,
  },

  // ── Empty ──
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    fontFamily: F.regular,
    color: C.muted,
    fontSize: 14,
    paddingVertical: 20,
  },
  emptyStateCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  emptyStateTitle: {
    fontSize: 16,
    fontFamily: F.semibold,
    color: '#6b7280',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyStateSub: {
    fontSize: 14,
    fontFamily: F.regular,
    color: C.muted,
    marginTop: 4,
    textAlign: 'center',
  },

  // ── Sections ──
  sectionsContainer: {
    gap: 14,
  },
  sectionCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sectionHeaderCollapsed: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionAccent: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: C.primary,
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: F.bold,
    color: C.fg,
  },
  sectionBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionBadge: {
    backgroundColor: C.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 28,
    alignItems: 'center',
  },
  sectionBadgeText: {
    fontSize: 12,
    fontFamily: F.bold,
    color: '#ffffff',
  },

  // ── Tasks ──
  taskList: {},
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
    minHeight: 60,
  },
  taskItemCompleted: {
    backgroundColor: '#f8fafc',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  taskContent: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 8,
  },
  taskTitle: {
    fontSize: 14,
    fontFamily: F.semibold,
    color: C.fg,
  },
  taskDescription: {
    fontSize: 12,
    fontFamily: F.regular,
    color: C.fgSub,
    marginTop: 2,
  },
  taskPriorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },
  taskPriorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  taskPriorityLabel: {
    fontSize: 11,
    fontFamily: F.semibold,
  },
  taskDueDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    marginRight: 12,
    flexShrink: 0,
  },
  taskDueDateText: {
    fontSize: 11,
    fontFamily: F.medium,
    color: C.fgSub,
  },

  // ── Add Section ──
  addSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    marginTop: 4,
  },
  addSectionBtnText: {
    fontSize: 14,
    fontFamily: F.medium,
    color: C.muted,
  },

  // ── FAB ──
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 75,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 25,
    zIndex: 25,
  },

  // ── Bottom Nav ──
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: C.card,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: C.border,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 20,
    zIndex: 20,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  navLabel: {
    fontSize: 11,
    fontFamily: F.medium,
    color: C.muted,
    marginTop: 4,
  },
  navLabelActive: {
    fontSize: 11,
    fontFamily: F.bold,
    color: C.primary,
    marginTop: 4,
  },

  // ═══ Modals ═══
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: C.card,
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
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: F.bold,
    color: '#111827',
  },
  modalDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontFamily: F.regular,
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
    fontFamily: F.medium,
    color: '#6b7280',
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
  datePickerText: {
    fontSize: 14,
    fontFamily: F.medium,
    color: '#111827',
  },
  datePickerPlaceholder: {
    fontSize: 14,
    fontFamily: F.regular,
    color: C.muted,
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
    fontFamily: F.medium,
    color: '#111827',
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
    backgroundColor: C.primaryBg,
    borderColor: C.primary,
  },
  sectionPickerText: {
    fontSize: 13,
    fontFamily: F.medium,
    color: '#6b7280',
  },
  sectionPickerTextActive: {
    fontFamily: F.semibold,
    color: C.primary,
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
    backgroundColor: C.card,
  },
  modalBtnCancelText: {
    fontSize: 15,
    fontFamily: F.medium,
    color: '#374151',
  },
  modalBtnSave: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: C.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  modalBtnSaveText: {
    fontSize: 15,
    fontFamily: F.semibold,
    color: '#ffffff',
  },

  // ── Section modal ──
  sectionModalLabel: {
    fontSize: 11,
    fontFamily: F.bold,
    color: C.fgSub,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sectionModalInput: {
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: F.regular,
    backgroundColor: '#fafafa',
    color: C.fg,
  },
  sectionModalCounter: {
    fontSize: 12,
    fontFamily: F.regular,
    color: C.muted,
    marginTop: 6,
    marginBottom: 4,
  },
});

export default HomeScreen;
