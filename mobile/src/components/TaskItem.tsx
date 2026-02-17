/**
 * DIVY - Task Item Component
 * Componente de card de tarefa
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import theme from '../styles/theme';
import { Task } from '../types/api';

interface TaskItemProps {
  task: Task;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

type Priority = 'low' | 'medium' | 'high';

const TaskItem: React.FC<TaskItemProps> = ({ task, onToggle, onEdit, onDelete }) => {
  const isCompleted = task.status === 'completed';

  const getPriorityColor = (priority: Priority): string => {
    switch (priority) {
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      case 'low':
        return '#10b981';
      default:
        return theme.colors.textSecondary;
    }
  };

  const getPriorityLabel = (priority: Priority): string => {
    switch (priority) {
      case 'high':
        return 'Alta';
      case 'medium':
        return 'Média';
      case 'low':
        return 'Baixa';
      default:
        return 'Normal';
    }
  };

  return (
    <View style={styles.container}>
      {/* Checkbox e Título */}
      <TouchableOpacity
        style={styles.checkboxContainer}
        onPress={() => onToggle(task)}
      >
        <View style={[styles.checkbox, isCompleted && styles.checkboxCompleted]}>
          {isCompleted && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <View style={styles.taskInfo}>
          <Text style={[styles.title, isCompleted && styles.titleCompleted]}>
            {task.title}
          </Text>
          {task.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {task.description}
            </Text>
          ) : null}
          <View style={styles.metaContainer}>
            <View
              style={[
                styles.priorityBadge,
                { backgroundColor: getPriorityColor(task.priority) },
              ]}
            >
              <Text style={styles.priorityText}>
                {getPriorityLabel(task.priority)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Botões de Ação */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onEdit(task)}
        >
          <Text style={styles.actionIcon}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onDelete(task)}
        >
          <Text style={styles.actionIcon}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  checkboxContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    marginRight: theme.spacing.md,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCompleted: {
    backgroundColor: theme.colors.primary,
  },
  checkmark: {
    color: theme.colors.textWhite,
    fontSize: 14,
    fontWeight: theme.fontWeight.bold as any,
  },
  taskInfo: {
    flex: 1,
  },
  title: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold as any,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: theme.colors.textSecondary,
  },
  description: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  priorityText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textWhite,
    fontWeight: theme.fontWeight.semibold as any,
  },
  actions: {
    flexDirection: 'row',
    marginLeft: theme.spacing.sm,
  },
  actionButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.xs,
  },
  actionIcon: {
    fontSize: 20,
  },
});

export default TaskItem;
