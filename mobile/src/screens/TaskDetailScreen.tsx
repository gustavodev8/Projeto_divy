/**
 * DIVY - Task Detail Screen
 * Replica EXATA do TaskDetail.tsx do projeto Lovable (referencia)
 * Com subtarefas 100% funcionais via API
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import * as taskService from '../services/taskService';
import * as subtaskService from '../services/subtaskService';
import type { Subtask } from '../services/subtaskService';

// Lucide React Native — mesmos ícones do Lovable
import {
  ArrowLeft,
  Circle,
  CheckCircle2,
  FileText,
  CalendarDays,
  Flag,
  ListChecks,
  Sparkles,
  Plus,
  Trash2,
  ChevronDown,
  X,
  Loader2,
} from 'lucide-react-native';

type TaskDetailNavigationProp = StackNavigationProp<RootStackParamList, 'TaskDetail'>;
type TaskDetailRouteProp = RouteProp<RootStackParamList, 'TaskDetail'>;

interface Props {
  navigation: TaskDetailNavigationProp;
  route: TaskDetailRouteProp;
}

// ── Cores exatas do index.css ──────────────────────────────────
const BG        = '#f7f8fb';
const CARD      = '#ffffff';
const BORDER    = '#e2e5eb';
const FG        = '#161d2e';
const MUTED     = '#838c99';
const PRIMARY   = '#4b6ef5';
const SECONDARY = '#f0f1f5';
const DESTRUCT  = '#f03e3e';

// Prioridades — sem Urgente, Alta é vermelha
const PRIORITIES: { value: 'low' | 'medium' | 'high'; label: string; dot: string }[] = [
  { value: 'low',    label: 'Baixa', dot: '#4ade80' },
  { value: 'medium', label: 'Média', dot: '#facc15' },
  { value: 'high',   label: 'Alta',  dot: '#ef4444' },
];

const formatDate = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

// ── Componente de item de subtarefa ───────────────────────────
interface SubtaskItemProps {
  subtask: Subtask;
  onToggle: () => void;
  onDelete: () => void;
}

const SubtaskItem: React.FC<SubtaskItemProps> = ({ subtask, onToggle, onDelete }) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const handleDelete = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => onDelete());
  };

  return (
    <Animated.View style={[s.subtaskItem, { opacity: fadeAnim }]}>
      {/* Checkbox */}
      <TouchableOpacity onPress={onToggle} style={s.subtaskCheck} activeOpacity={0.7}>
        {subtask.completed ? (
          <CheckCircle2 size={18} color={PRIMARY} strokeWidth={2} />
        ) : (
          <Circle size={18} color={MUTED + '66'} strokeWidth={2} />
        )}
      </TouchableOpacity>

      {/* Texto */}
      <Text
        style={[s.subtaskText, subtask.completed && s.subtaskTextDone]}
        numberOfLines={2}
      >
        {subtask.title}
      </Text>

      {/* Deletar */}
      <TouchableOpacity onPress={handleDelete} style={s.subtaskDeleteBtn} activeOpacity={0.7}>
        <X size={14} color={MUTED + '99'} strokeWidth={2} />
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── Tela principal ─────────────────────────────────────────────
const TaskDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { task: initialTask, onSave, onDelete: onDeleteTask } = route.params as any;

  // ── Estados da tarefa ──
  const [title, setTitle]             = useState<string>(initialTask?.title ?? '');
  const [done, setDone]               = useState<boolean>(false);
  const [description, setDescription] = useState<string>(initialTask?.description ?? '');
  const [priority, setPriority]       = useState<'low' | 'medium' | 'high'>(initialTask?.priority ?? 'medium');
  const [dueDate, setDueDate]         = useState<string>(initialTask?.due_date ?? '');
  const [saving, setSaving]           = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ── Estados do dropdown de prioridade ──
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const dropdownAnim = useRef(new Animated.Value(0)).current;

  const openDropdown = () => {
    setShowPriorityPicker(true);
    dropdownAnim.setValue(0);
    Animated.timing(dropdownAnim, {
      toValue: 1, duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const closeDropdown = (cb?: () => void) => {
    Animated.timing(dropdownAnim, {
      toValue: 0, duration: 140,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => { setShowPriorityPicker(false); cb?.(); });
  };

  // ── Estados das subtarefas ──
  const [subtasks, setSubtasks]         = useState<Subtask[]>([]);
  const [loadingSubtasks, setLoadingSubtasks] = useState(true);
  const [showNewSubtask, setShowNewSubtask]   = useState(false);
  const [newSubtaskText, setNewSubtaskText]   = useState('');
  const [addingSubtask, setAddingSubtask]     = useState(false);
  const newSubtaskInputRef = useRef<TextInput>(null);

  // Barra de progresso animada
  const progressAnim = useRef(new Animated.Value(0)).current;

  const completedCount = subtasks.filter(s => s.completed).length;
  const totalCount = subtasks.length;

  // Anima barra de progresso ao mudar contagem
  useEffect(() => {
    const pct = totalCount > 0 ? completedCount / totalCount : 0;
    Animated.timing(progressAnim, {
      toValue: pct,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [completedCount, totalCount]);

  // Foca o input ao abrir o campo de nova subtarefa
  useEffect(() => {
    if (showNewSubtask) {
      setTimeout(() => newSubtaskInputRef.current?.focus(), 80);
    }
  }, [showNewSubtask]);

  // ── Carregar subtarefas ao abrir a tela ──
  useEffect(() => {
    const load = async () => {
      setLoadingSubtasks(true);
      const res = await subtaskService.getSubtasks(initialTask.id);
      if (res.success) setSubtasks(res.subtasks ?? []);
      setLoadingSubtasks(false);
    };
    load();
  }, [initialTask.id]);

  const selPriority = PRIORITIES.find(p => p.value === priority) ?? PRIORITIES[1];

  // ── Handler: salvar tarefa ──
  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Erro', 'O título não pode ficar vazio'); return; }
    setSaving(true);
    const result = await taskService.updateTask(initialTask.id, {
      title: title.trim(), description, priority,
      due_date: dueDate || undefined,
      section_id: initialTask.section_id ?? undefined,
    });
    setSaving(false);
    if (result.success) {
      if (onSave && result.task) onSave(result.task);
      navigation.goBack();
    } else {
      Alert.alert('Erro', result.error || 'Erro ao salvar tarefa');
    }
  };

  // ── Handler: excluir tarefa ──
  const handleDeleteTask = () => {
    Alert.alert('Excluir tarefa', `Tem certeza que deseja excluir "${title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive',
        onPress: async () => {
          const result = await taskService.deleteTask(initialTask.id);
          if (result.success) {
            if (onDeleteTask) onDeleteTask(initialTask.id);
            navigation.goBack();
          } else {
            Alert.alert('Erro', result.error || 'Erro ao excluir tarefa');
          }
        },
      },
    ]);
  };

  // ── Handler: adicionar subtarefa ──
  const handleAddSubtask = async () => {
    const text = newSubtaskText.trim();
    if (!text) return;
    setAddingSubtask(true);

    const res = await subtaskService.createSubtask(
      initialTask.id,
      text,
      subtasks.length  // position = ao final
    );

    setAddingSubtask(false);

    if (res.success && res.subtask) {
      setSubtasks(prev => [...prev, res.subtask!]);
      setNewSubtaskText('');
      setShowNewSubtask(false);
    } else if (res.limitReached) {
      Alert.alert('Limite atingido', res.error || 'Limite de subtarefas do seu plano atingido.');
      setShowNewSubtask(false);
    } else {
      Alert.alert('Erro', res.error || 'Erro ao criar subtarefa');
    }
  };

  // ── Handler: toggle subtarefa ──
  const handleToggleSubtask = async (sub: Subtask) => {
    const newCompleted = !sub.completed;
    // Otimistic update
    setSubtasks(prev => prev.map(s => s.id === sub.id ? { ...s, completed: newCompleted } : s));
    const res = await subtaskService.updateSubtask(sub.id, { completed: newCompleted });
    if (!res.success) {
      // Reverte se falhou
      setSubtasks(prev => prev.map(s => s.id === sub.id ? { ...s, completed: sub.completed } : s));
      Alert.alert('Erro', res.error || 'Erro ao atualizar subtarefa');
    }
  };

  // ── Handler: deletar subtarefa ──
  const handleDeleteSubtask = async (subtaskId: number) => {
    // Remove do estado imediatamente (animação de fade já foi feita no item)
    setSubtasks(prev => prev.filter(s => s.id !== subtaskId));
    const res = await subtaskService.deleteSubtask(subtaskId);
    if (!res.success) {
      // Recarrega se falhou
      const reload = await subtaskService.getSubtasks(initialTask.id);
      if (reload.success) setSubtasks(reload.subtasks ?? []);
      Alert.alert('Erro', res.error || 'Erro ao deletar subtarefa');
    }
  };

  // ── Handler: data ──
  const handleDateChange = (_: DateTimePickerEvent, selected?: Date) => {
    setShowDatePicker(false);
    if (selected) setDueDate(selected.toISOString());
  };

  // ── Render ──
  return (
    <SafeAreaView style={s.container} edges={['top']}>

      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={20} color={PRIMARY} strokeWidth={2} />
          <Text style={s.backText}>Voltar</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Detalhes da Tarefa</Text>
        <View style={{ width: 64 }} />
      </View>

      {/* CONTEÚDO */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Título + checkbox ── */}
        <View style={s.titleRow}>
          <TouchableOpacity onPress={() => setDone(!done)} style={s.checkBtn} activeOpacity={0.7}>
            {done
              ? <CheckCircle2 size={24} color={PRIMARY} strokeWidth={2} />
              : <Circle size={24} color={MUTED + '66'} strokeWidth={2} />
            }
          </TouchableOpacity>
          <TextInput
            style={[s.titleInput, done && s.titleDone]}
            value={title}
            onChangeText={setTitle}
            placeholder="Título da tarefa"
            placeholderTextColor={MUTED}
            multiline
          />
        </View>

        {/* ── Descrição ── */}
        <View style={s.fieldBlock}>
          <View style={s.labelRow}>
            <FileText size={14} color={MUTED} strokeWidth={2} />
            <Text style={s.label}>DESCRIÇÃO</Text>
          </View>
          <TextInput
            style={s.textarea}
            value={description}
            onChangeText={setDescription}
            placeholder="Adicione uma descrição..."
            placeholderTextColor={MUTED}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* ── Data de vencimento ── */}
        <View style={s.fieldBlock}>
          <View style={s.labelRow}>
            <CalendarDays size={14} color={MUTED} strokeWidth={2} />
            <Text style={s.label}>DATA DE VENCIMENTO</Text>
          </View>
          <TouchableOpacity style={s.inputCard} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
            <Text style={dueDate ? s.inputText : s.inputPlaceholder}>
              {dueDate ? formatDate(dueDate) : 'dd/mm/aaaa'}
            </Text>
            <CalendarDays size={16} color={MUTED} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* ── Prioridade ── */}
        <View style={s.fieldBlock}>
          <View style={s.labelRow}>
            <Flag size={14} color={MUTED} strokeWidth={2} />
            <Text style={s.label}>PRIORIDADE</Text>
          </View>

          <TouchableOpacity
            style={s.inputCard}
            onPress={() => showPriorityPicker ? closeDropdown() : openDropdown()}
            activeOpacity={0.8}
          >
            <View style={s.priorityLeft}>
              <View style={[s.dot, { backgroundColor: selPriority.dot }]} />
              <Text style={s.priorityText}>{selPriority.label}</Text>
            </View>
            <Animated.View style={{
              transform: [{
                rotate: dropdownAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }),
              }],
            }}>
              <ChevronDown size={16} color={MUTED} strokeWidth={2} />
            </Animated.View>
          </TouchableOpacity>

          {showPriorityPicker && (
            <Animated.View style={[s.dropdown, {
              opacity: dropdownAnim,
              transform: [{
                scaleY: dropdownAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }),
              }],
            }]}>
              {PRIORITIES.map(p => (
                <TouchableOpacity
                  key={p.value}
                  style={[s.dropdownItem, priority === p.value && s.dropdownItemActive]}
                  onPress={() => closeDropdown(() => setPriority(p.value))}
                  activeOpacity={0.7}
                >
                  <View style={[s.dot, { backgroundColor: p.dot }]} />
                  <Text style={[s.dropdownText, priority === p.value && s.dropdownTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </Animated.View>
          )}
        </View>

        {/* ── Subtarefas ── */}
        <View style={s.subtasksBlock}>

          {/* Cabeçalho */}
          <View style={s.subtasksHeader}>
            <View style={s.labelRow}>
              <ListChecks size={14} color={MUTED} strokeWidth={2} />
              <Text style={s.label}>SUBTAREFAS</Text>
              <View style={s.badge}>
                <Text style={s.badgeText}>{completedCount}/{totalCount}</Text>
              </View>
            </View>
            <TouchableOpacity style={s.aiBtn} activeOpacity={0.8}>
              <Sparkles size={14} color="#ffffff" strokeWidth={2} />
              <Text style={s.aiBtnText}>Gerar com IA</Text>
            </TouchableOpacity>
          </View>

          {/* Barra de progresso — aparece só quando há subtarefas */}
          {totalCount > 0 && (
            <View style={s.progressTrack}>
              <Animated.View style={[s.progressFill, {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              }]} />
            </View>
          )}

          {/* Lista de subtarefas */}
          {loadingSubtasks ? (
            <ActivityIndicator size="small" color={PRIMARY} style={{ marginVertical: 12 }} />
          ) : (
            <>
              {subtasks.map(sub => (
                <SubtaskItem
                  key={sub.id}
                  subtask={sub}
                  onToggle={() => handleToggleSubtask(sub)}
                  onDelete={() => handleDeleteSubtask(sub.id)}
                />
              ))}
            </>
          )}

          {/* Input inline para nova subtarefa */}
          {showNewSubtask ? (
            <View style={s.newSubtaskRow}>
              <Circle size={18} color={MUTED + '4d'} strokeWidth={2} />
              <TextInput
                ref={newSubtaskInputRef}
                style={s.newSubtaskInput}
                value={newSubtaskText}
                onChangeText={setNewSubtaskText}
                placeholder="Nome da subtarefa"
                placeholderTextColor={MUTED}
                onSubmitEditing={handleAddSubtask}
                returnKeyType="done"
                editable={!addingSubtask}
              />
              {addingSubtask ? (
                <ActivityIndicator size="small" color={PRIMARY} />
              ) : (
                <>
                  <TouchableOpacity
                    onPress={handleAddSubtask}
                    disabled={!newSubtaskText.trim()}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.newSubtaskOk, !newSubtaskText.trim() && { opacity: 0.4 }]}>OK</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setShowNewSubtask(false); setNewSubtaskText(''); }}
                    activeOpacity={0.7}
                  >
                    <X size={16} color={MUTED} strokeWidth={2} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : (
            <TouchableOpacity
              style={s.addSubtaskBtn}
              onPress={() => setShowNewSubtask(true)}
              activeOpacity={0.7}
            >
              <Plus size={16} color={MUTED} strokeWidth={2} />
              <Text style={s.addSubtaskText}>Adicionar subtarefa</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Excluir tarefa ── */}
        <View style={{ paddingTop: 16 }}>
          <TouchableOpacity style={s.deleteBtn} onPress={handleDeleteTask} activeOpacity={0.8}>
            <Trash2 size={16} color={DESTRUCT} strokeWidth={2} />
            <Text style={s.deleteBtnText}>Excluir tarefa</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* FOOTER */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          activeOpacity={0.85}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.saveBtnText}>Salvar</Text>
          }
        </TouchableOpacity>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={(() => { const d = dueDate ? new Date(dueDate) : new Date(); return isNaN(d.getTime()) ? new Date() : d; })()}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
    </SafeAreaView>
  );
};

// ── Styles ────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: BG },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: CARD, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, width: 64 },
  backText:    { fontSize: 14, color: PRIMARY, fontWeight: '600' },
  headerTitle: { fontSize: 14, fontWeight: '700', color: FG },

  // Scroll
  scroll:   { flex: 1 },
  content:  { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120, gap: 20 },

  // Título
  titleRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkBtn:  { marginTop: 4, flexShrink: 0 },
  titleInput: {
    flex: 1, fontSize: 18, fontWeight: '700', color: FG,
    lineHeight: 26, paddingTop: 0, paddingBottom: 0,
  },
  titleDone: { color: MUTED, textDecorationLine: 'line-through' },

  // Campos
  fieldBlock:  { gap: 8 },
  subtasksBlock: { gap: 12 },
  labelRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: {
    fontSize: 12, fontWeight: '700', color: MUTED,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },

  // Textarea
  textarea: {
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 14, color: FG, lineHeight: 21, minHeight: 100,
    textAlignVertical: 'top',
  },

  // Input cards
  inputCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
  },
  inputText:        { fontSize: 14, color: FG },
  inputPlaceholder: { fontSize: 14, color: MUTED },

  // Prioridade
  priorityLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priorityText: { fontSize: 14, color: FG, fontWeight: '500' },
  dot:          { width: 12, height: 12, borderRadius: 6 },

  // Dropdown
  dropdown: {
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
    borderRadius: 12, overflow: 'hidden', marginTop: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 6,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  dropdownItemActive: { backgroundColor: PRIMARY + '0d' },
  dropdownText:       { fontSize: 14, color: FG },
  dropdownTextActive: { color: PRIMARY, fontWeight: '600' },

  // Subtarefas header
  subtasksHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  badge: {
    backgroundColor: PRIMARY + '1a', borderRadius: 20,
    paddingHorizontal: 6, paddingVertical: 2,
    marginLeft: 4, minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontSize: 10, color: PRIMARY, fontWeight: '700' },

  // Botão IA
  aiBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: PRIMARY, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, shadowRadius: 3, elevation: 2,
  },
  aiBtnText: { fontSize: 12, color: '#fff', fontWeight: '700' },

  // Barra de progresso
  progressTrack: {
    height: 6, backgroundColor: SECONDARY, borderRadius: 99, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: PRIMARY, borderRadius: 99,
  },

  // Item de subtarefa
  subtaskItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  subtaskCheck:    { flexShrink: 0 },
  subtaskText:     { flex: 1, fontSize: 14, color: FG },
  subtaskTextDone: { color: MUTED, textDecorationLine: 'line-through' },
  subtaskDeleteBtn: { padding: 4 },

  // Input nova subtarefa
  newSubtaskRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: CARD, borderWidth: 1, borderColor: PRIMARY + '4d',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  newSubtaskInput: {
    flex: 1, fontSize: 14, color: FG, paddingVertical: 0,
  },
  newSubtaskOk: {
    fontSize: 13, color: PRIMARY, fontWeight: '700',
  },

  // Botão adicionar subtarefa (dashed)
  addSubtaskBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: BORDER, borderStyle: 'dashed',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  addSubtaskText: { fontSize: 14, color: MUTED },

  // Botão excluir tarefa
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1, borderColor: DESTRUCT + '33',
    backgroundColor: DESTRUCT + '0d', borderRadius: 12, paddingVertical: 14,
  },
  deleteBtnText: { fontSize: 14, color: DESTRUCT, fontWeight: '600' },

  // Footer
  footer: {
    backgroundColor: CARD, paddingHorizontal: 20, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: BORDER,
  },
  saveBtn: {
    backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  saveBtnText: { fontSize: 15, color: '#fff', fontWeight: '700' },
});

export default TaskDetailScreen;
