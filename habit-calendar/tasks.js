/**
 * Task Manager - Handles task-related operations and UI
 */

class TaskManager {
    constructor() {
        this.currentEditingTask = null;
        this.initializeEventListeners();
    }

    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        // Add task button
        document.getElementById('add-task-btn').addEventListener('click', () => {
            this.showTaskModal();
        });

        // Task form
        document.getElementById('task-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTask();
        });

        // Cancel task
        document.getElementById('cancel-task-btn').addEventListener('click', () => {
            this.hideTaskModal();
        });

        // Task type change
        document.getElementById('task-type').addEventListener('change', (e) => {
            this.handleTaskTypeChange(e.target.value);
        });

        // Add color button
        document.getElementById('add-color-btn').addEventListener('click', () => {
            this.showColorModal();
        });

        // Color form
        document.getElementById('color-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveColorGroup();
        });

        // Add reminder button
        document.getElementById('add-reminder-btn').addEventListener('click', () => {
            this.addReminderField();
        });

        // Close modals
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    modal.classList.remove('active');
                }
            });
        });

        // Cancel color
        document.querySelectorAll('.cancel-color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.hideColorModal();
            });
        });

        // Close modals on background click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }

    /**
     * Show task modal for creating/editing
     */
    showTaskModal(task = null) {
        this.currentEditingTask = task;
        const modal = document.getElementById('task-modal');
        const title = document.getElementById('modal-title');

        if (task) {
            title.textContent = 'Edit Task';
            this.populateTaskForm(task);
        } else {
            title.textContent = 'New Task';
            this.resetTaskForm();
        }

        this.updateColorGroupSelect();
        modal.classList.add('active');
    }

    /**
     * Hide task modal
     */
    hideTaskModal() {
        document.getElementById('task-modal').classList.remove('active');
        this.currentEditingTask = null;
        this.resetTaskForm();
    }

    /**
     * Show color group modal
     */
    showColorModal() {
        document.getElementById('color-modal').classList.add('active');
    }

    /**
     * Hide color group modal
     */
    hideColorModal() {
        document.getElementById('color-modal').classList.remove('active');
        document.getElementById('color-form').reset();
    }

    /**
     * Reset task form
     */
    resetTaskForm() {
        document.getElementById('task-form').reset();
        document.getElementById('reminders-container').innerHTML = '';
        this.handleTaskTypeChange('fixed');
    }

    /**
     * Populate task form with existing task data
     */
    populateTaskForm(task) {
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-color').value = task.colorGroupId;
        document.getElementById('task-type').value = task.type;
        document.getElementById('task-description').value = task.description || '';

        if (task.startDate) {
            document.getElementById('task-start-date').value = this.formatDateTimeLocal(task.startDate);
        }

        if (task.dueDate) {
            document.getElementById('task-due-date').value = this.formatDateTimeLocal(task.dueDate);
        }

        if (task.reminderType) {
            document.querySelector(`input[name="reminder-type"][value="${task.reminderType}"]`).checked = true;
        }

        // Populate reminders
        document.getElementById('reminders-container').innerHTML = '';
        if (task.reminders && task.reminders.length > 0) {
            task.reminders.forEach(reminder => {
                this.addReminderField(reminder);
            });
        }

        this.handleTaskTypeChange(task.type);
    }

    /**
     * Handle task type change
     */
    handleTaskTypeChange(type) {
        const datetimeGroup = document.getElementById('datetime-group');
        const reminderTypeGroup = document.getElementById('reminder-type-group');
        const startDateInput = document.getElementById('task-start-date');
        const dueDateInput = document.getElementById('task-due-date');

        if (type === 'continuous') {
            datetimeGroup.style.display = 'none';
            reminderTypeGroup.style.display = 'none';
            startDateInput.removeAttribute('required');
            dueDateInput.removeAttribute('required');
        } else if (type === 'dynamic') {
            datetimeGroup.style.display = 'block';
            reminderTypeGroup.style.display = 'block';
            dueDateInput.setAttribute('required', '');
        } else {
            // fixed
            datetimeGroup.style.display = 'block';
            reminderTypeGroup.style.display = 'none';
            dueDateInput.setAttribute('required', '');
        }
    }

    /**
     * Add reminder field
     */
    addReminderField(reminder = null) {
        const container = document.getElementById('reminders-container');
        const reminderDiv = document.createElement('div');
        reminderDiv.className = 'reminder-item';

        const amountInput = document.createElement('input');
        amountInput.type = 'number';
        amountInput.min = '1';
        amountInput.placeholder = 'Amount';
        amountInput.value = reminder ? reminder.amount : '10';

        const unitSelect = document.createElement('select');
        ['minutes', 'hours', 'days', 'weeks'].forEach(unit => {
            const option = document.createElement('option');
            option.value = unit;
            option.textContent = unit.charAt(0).toUpperCase() + unit.slice(1);
            if (reminder && reminder.unit === unit) {
                option.selected = true;
            }
            unitSelect.appendChild(option);
        });

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => {
            reminderDiv.remove();
        });

        reminderDiv.appendChild(amountInput);
        reminderDiv.appendChild(unitSelect);
        reminderDiv.appendChild(removeBtn);
        container.appendChild(reminderDiv);
    }

    /**
     * Save task
     */
    saveTask() {
        const taskData = {
            title: document.getElementById('task-title').value.trim(),
            colorGroupId: document.getElementById('task-color').value,
            type: document.getElementById('task-type').value,
            description: document.getElementById('task-description').value.trim(),
            reminders: []
        };

        // Get dates
        const startDate = document.getElementById('task-start-date').value;
        const dueDate = document.getElementById('task-due-date').value;

        if (taskData.type !== 'continuous') {
            if (!dueDate) {
                alert('Please set a due date');
                return;
            }
            taskData.dueDate = new Date(dueDate).toISOString();
            if (startDate) {
                taskData.startDate = new Date(startDate).toISOString();
            }
        }

        // Get reminder type for dynamic tasks
        if (taskData.type === 'dynamic') {
            const reminderTypeRadio = document.querySelector('input[name="reminder-type"]:checked');
            taskData.reminderType = reminderTypeRadio ? reminderTypeRadio.value : 'M2M';
        }

        // Get reminders
        const reminderItems = document.querySelectorAll('.reminder-item');
        reminderItems.forEach(item => {
            const amount = item.querySelector('input[type="number"]').value;
            const unit = item.querySelector('select').value;
            if (amount) {
                taskData.reminders.push({ amount, unit });
            }
        });

        // Save or update
        if (this.currentEditingTask) {
            storage.updateTask(this.currentEditingTask.id, taskData);
        } else {
            const newTask = storage.addTask(taskData);

            // Schedule notifications
            if (newTask && newTask.reminders.length > 0) {
                notifications.scheduleTaskNotifications(newTask);
            }
        }

        this.hideTaskModal();

        // Refresh UI
        if (window.app) {
            window.app.refresh();
        }
    }

    /**
     * Update color group select
     */
    updateColorGroupSelect() {
        const select = document.getElementById('task-color');
        const colorGroups = storage.getColorGroups();

        // Sort by count (descending)
        colorGroups.sort((a, b) => (b.count || 0) - (a.count || 0));

        select.innerHTML = '';
        colorGroups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = `${group.name} (${group.count || 0})`;
            option.style.color = group.color;
            select.appendChild(option);
        });
    }

    /**
     * Save color group
     */
    saveColorGroup() {
        const name = document.getElementById('color-name').value.trim();
        const color = document.getElementById('color-picker').value;

        if (!name) {
            alert('Please enter a group name');
            return;
        }

        storage.addColorGroup(name, color);
        this.hideColorModal();
        this.updateColorGroupSelect();

        // Refresh filters
        if (window.app) {
            window.app.renderFilters();
        }
    }

    /**
     * Toggle task completion
     */
    toggleTaskCompletion(taskId) {
        const tasks = storage.getTasks();
        const task = tasks.find(t => t.id === taskId);

        if (!task) return;

        if (task.completed) {
            storage.uncompleteTask(taskId);
        } else {
            storage.completeTask(taskId);
            notifications.clearTaskNotifications(taskId);
        }

        if (window.app) {
            window.app.refresh();
        }
    }

    /**
     * Delete task
     */
    deleteTask(taskId) {
        if (confirm('Are you sure you want to delete this task?')) {
            storage.deleteTask(taskId);
            notifications.clearTaskNotifications(taskId);

            if (window.app) {
                window.app.refresh();
            }
        }
    }

    /**
     * Show task details
     */
    showTaskDetails(taskId) {
        const task = storage.getTasks().find(t => t.id === taskId);
        if (task) {
            this.showTaskModal(task);
        }
    }

    /**
     * Get sorted tasks for display
     * Sort by: 1) Frequency (color group count), 2) Closest due time
     */
    getSortedTasks(tasks = null) {
        const allTasks = tasks || storage.getTasks();
        const colorGroups = storage.getColorGroups();

        return allTasks.sort((a, b) => {
            // Skip completed tasks (except continuous)
            if (a.completed && a.type !== 'continuous') return 1;
            if (b.completed && b.type !== 'continuous') return -1;

            // First sort by color group frequency
            const aGroup = colorGroups.find(c => c.id === a.colorGroupId);
            const bGroup = colorGroups.find(c => c.id === b.colorGroupId);
            const aCount = aGroup ? aGroup.count : 0;
            const bCount = bGroup ? bGroup.count : 0;

            if (aCount !== bCount) {
                return bCount - aCount; // Higher count first
            }

            // Then sort by due date
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;

            return new Date(a.dueDate) - new Date(b.dueDate);
        });
    }

    /**
     * Utility: Format datetime for input
     */
    formatDateTimeLocal(dateString) {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
}

// Create global instance
const taskManager = new TaskManager();
