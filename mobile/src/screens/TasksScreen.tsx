/**
 * DIVY - Tasks Screen
 * Tela de gerenciamento de tarefas
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import TaskItem from '../components/TaskItem';
import * as taskService from '../services/taskService';
import theme from '../styles/theme';
import { Task } from '../types/api';
import { NavigationProp } from '../types/navigation';

interface TasksScreenProps {
  navigation: NavigationProp<'Tasks'>;
}

type TaskPriority = 'low' | 'medium' | 'high';

interface FormData {
  title: string;
  description: string;
  priority: TaskPriority;
}

const TasksScreen: React.FC<TasksScreenProps> = ({ navigation }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    priority: 'medium',
  });

  // Carregar tarefas
  const loadTasks = useCallback(async () => {
    const result = await taskService.getTasks();
    if (result.success && result.tasks) {
      setTasks(result.tasks);
    } else {
      Alert.alert('Erro', result.error);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Refresh
  const onRefresh = (): void => {
    setRefreshing(true);
    loadTasks();
  };

  // Abrir modal para criar tarefa
  const handleCreateTask = (): void => {
    setEditingTask(null);
    setFormData({ title: '', description: '', priority: 'medium' });
    setModalVisible(true);
  };

  // Abrir modal para editar tarefa
  const handleEditTask = (task: Task): void => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      priority: task.priority || 'medium',
    });
    setModalVisible(true);
  };

  // Salvar tarefa (criar ou editar)
  const handleSaveTask = async (): Promise<void> => {
    if (!formData.title.trim()) {
      Alert.alert('Erro', 'Digite um título para a tarefa');
      return;
    }

    const result = editingTask
      ? await taskService.updateTask(editingTask.id, formData)
      : await taskService.createTask(
          formData.title,
          formData.description,
          formData.priority
        );

    if (result.success) {
      setModalVisible(false);
      loadTasks();
    } else {
      Alert.alert('Erro', result.error);
    }
  };

  // Toggle status da tarefa
  const handleToggleTask = async (task: Task): Promise<void> => {
    const result = await taskService.toggleTaskStatus(task.id, task.status);
    if (result.success) {
      loadTasks();
    } else {
      Alert.alert('Erro', result.error);
    }
  };

  // Deletar tarefa
  const handleDeleteTask = (task: Task): void => {
    Alert.alert(
      'Confirmar',
      `Deseja deletar a tarefa "${task.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Deletar',
          style: 'destructive',
          onPress: async () => {
            const result = await taskService.deleteTask(task.id);
            if (result.success) {
              loadTasks();
            } else {
              Alert.alert('Erro', result.error);
            }
          },
        },
      ]
    );
  };

  // Filtrar tarefas
  const pendingTasks = tasks.filter((t) => t.status !== 'completed');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Minhas Tarefas</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{pendingTasks.length}</Text>
          <Text style={styles.statLabel}>Pendentes</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{completedTasks.length}</Text>
          <Text style={styles.statLabel}>Concluídas</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{tasks.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {/* Lista de Tarefas */}
      {loading ? (
        <ActivityIndicator
          size="large"
          color={theme.colors.primary}
          style={styles.loading}
        />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TaskItem
              task={item}
              onToggle={handleToggleTask}
              onEdit={handleEditTask}
              onDelete={handleDeleteTask}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyText}>Nenhuma tarefa ainda</Text>
              <Text style={styles.emptySubtext}>
                Toque no + para criar sua primeira tarefa
              </Text>
            </View>
          }
        />
      )}

      {/* Botão Criar Tarefa */}
      <TouchableOpacity style={styles.fab} onPress={handleCreateTask}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Modal Criar/Editar Tarefa */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Título da tarefa"
              placeholderTextColor={theme.colors.textMuted}
              value={formData.title}
              onChangeText={(text) =>
                setFormData({ ...formData, title: text })
              }
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Descrição (opcional)"
              placeholderTextColor={theme.colors.textMuted}
              value={formData.description}
              onChangeText={(text) =>
                setFormData({ ...formData, description: text })
              }
              multiline
              numberOfLines={4}
            />

            <Text style={styles.label}>Prioridade:</Text>
            <View style={styles.priorityContainer}>
              {(['low', 'medium', 'high'] as TaskPriority[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityButton,
                    formData.priority === p && styles.priorityButtonActive,
                  ]}
                  onPress={() => setFormData({ ...formData, priority: p })}
                >
                  <Text
                    style={[
                      styles.priorityButtonText,
                      formData.priority === p &&
                        styles.priorityButtonTextActive,
                    ]}
                  >
                    {p === 'low' ? 'Baixa' : p === 'medium' ? 'Média' : 'Alta'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonSave}
                onPress={handleSaveTask}
              >
                <Text style={styles.modalButtonTextSave}>Salvar</Text>
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
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 32,
    color: theme.colors.text,
    fontWeight: '300',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    width: 40,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold as any,
    color: theme.colors.text,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statNumber: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold as any,
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
  },
  listContent: {
    padding: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 80,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: theme.spacing.md,
  },
  emptyText: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold as any,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  emptySubtext: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  fab: {
    position: 'absolute',
    right: theme.spacing.lg,
    bottom: theme.spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.lg,
  },
  fabIcon: {
    fontSize: 32,
    color: theme.colors.textWhite,
    fontWeight: theme.fontWeight.bold as any,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    minHeight: '50%',
  },
  modalTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold as any,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.md,
    color: theme.colors.text,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium as any,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  priorityContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  priorityButton: {
    flex: 1,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  priorityButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  priorityButtonText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  priorityButtonTextActive: {
    color: theme.colors.textWhite,
    fontWeight: theme.fontWeight.semibold as any,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  modalButtonCancel: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  modalButtonTextCancel: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold as any,
  },
  modalButtonSave: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  modalButtonTextSave: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textWhite,
    fontWeight: theme.fontWeight.semibold as any,
  },
});

export default TasksScreen;
