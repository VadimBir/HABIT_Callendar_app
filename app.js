/**
 * Main Application Controller
 */

class HabitCalendarApp {
    constructor() {
        this.initialized = false;
        this.init();
    }

    /**
     * Initialize application
     */
    async init() {
        if (this.initialized) return;

        console.log('Initializing HABIT Calendar...');

        // Initialize components
        this.initializeSettings();
        this.renderFilters();
        this.renderTaskList();
        calendar.render();

        // Request notification permission if enabled
        const settings = storage.getSettings();
        if (settings.notificationsEnabled) {
            await notifications.requestPermission();
            notifications.rescheduleAll();
            notifications.startPeriodicCheck();
        }

        // Register service worker
        this.registerServiceWorker();

        // Mark as initialized
        this.initialized = true;

        console.log('HABIT Calendar initialized successfully');
    }

    /**
     * Initialize settings
     */
    initializeSettings() {
        const settingsBtn = document.getElementById('settings-btn');
        settingsBtn.addEventListener('click', () => {
            this.showSettings();
        });

        // Enable notifications toggle
        const notifToggle = document.getElementById('enable-notifications');
        const settings = storage.getSettings();
        notifToggle.checked = settings.notificationsEnabled;

        notifToggle.addEventListener('change', async (e) => {
            const enabled = e.target.checked;
            storage.updateSetting('notificationsEnabled', enabled);

            if (enabled) {
                const granted = await notifications.requestPermission();
                if (granted) {
                    notifications.rescheduleAll();
                    notifications.startPeriodicCheck();
                } else {
                    e.target.checked = false;
                    storage.updateSetting('notificationsEnabled', false);
                    alert('Please enable notifications in your browser settings');
                }
            } else {
                notifications.stopPeriodicCheck();
            }
        });

        // Test notification
        document.getElementById('test-notification-btn').addEventListener('click', async () => {
            await notifications.test();
        });

        // Export data
        document.getElementById('export-data-btn').addEventListener('click', () => {
            this.exportData();
        });

        // Import data
        document.getElementById('import-data-btn').addEventListener('click', () => {
            document.getElementById('import-file-input').click();
        });

        document.getElementById('import-file-input').addEventListener('change', (e) => {
            this.importData(e.target.files[0]);
        });

        // Clear data
        document.getElementById('clear-data-btn').addEventListener('click', () => {
            if (confirm('Are you sure you want to clear ALL data? This cannot be undone!')) {
                storage.clearAllData();
                this.refresh();
                alert('All data has been cleared');
            }
        });
    }

    /**
     * Show settings modal
     */
    showSettings() {
        document.getElementById('settings-modal').classList.add('active');
    }

    /**
     * Render color filters
     */
    renderFilters() {
        const container = document.getElementById('color-filters');
        container.innerHTML = '';

        const colorGroups = storage.getColorGroups();
        const filters = storage.getFilters();

        // Sort by count
        colorGroups.sort((a, b) => (b.count || 0) - (a.count || 0));

        colorGroups.forEach(group => {
            const item = document.createElement('div');
            item.className = 'color-filter-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = filters.visibleColorGroups.includes(group.id);
            checkbox.addEventListener('change', () => {
                storage.toggleColorFilter(group.id);
                this.refresh();
            });

            const indicator = document.createElement('div');
            indicator.className = 'color-indicator';
            indicator.style.backgroundColor = group.color;

            const label = document.createElement('span');
            label.className = 'color-filter-label';
            label.textContent = group.name;

            const count = document.createElement('span');
            count.className = 'color-count';
            count.textContent = group.count || 0;

            item.appendChild(checkbox);
            item.appendChild(indicator);
            item.appendChild(label);
            item.appendChild(count);

            container.appendChild(item);
        });
    }

    /**
     * Render task list (bottom section)
     */
    renderTaskList() {
        const container = document.getElementById('task-list');
        container.innerHTML = '';

        // Get all tasks
        const allTasks = storage.getTasks();

        // Filter by visible color groups
        const filters = storage.getFilters();
        const visibleTasks = allTasks.filter(t => filters.visibleColorGroups.includes(t.colorGroupId));

        // Sort by frequency and due time
        const sortedTasks = taskManager.getSortedTasks(visibleTasks);

        // Filter out completed tasks (except continuous)
        const activeTasks = sortedTasks.filter(t => !t.completed || t.type === 'continuous');

        if (activeTasks.length === 0) {
            container.innerHTML = '<p class="text-center" style="color: var(--text-secondary);">No active tasks</p>';
            return;
        }

        activeTasks.forEach(task => {
            const taskItem = this.createTaskListItem(task);
            container.appendChild(taskItem);
        });
    }

    /**
     * Create task list item
     */
    createTaskListItem(task) {
        const item = document.createElement('div');
        item.className = 'task-item';

        const colorGroup = storage.getColorGroups().find(c => c.id === task.colorGroupId);
        const color = colorGroup ? colorGroup.color : '#999';
        item.style.borderLeftColor = color;

        // Checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'task-checkbox';
        checkbox.checked = task.completed;
        checkbox.addEventListener('change', () => {
            taskManager.toggleTaskCompletion(task.id);
        });

        // Task info
        const infoDiv = document.createElement('div');
        infoDiv.className = 'task-info';

        // Title
        const titleDiv = document.createElement('div');
        titleDiv.className = 'task-title';
        titleDiv.textContent = task.title;

        // Meta info
        const metaDiv = document.createElement('div');
        metaDiv.className = 'task-meta';

        // Type badge
        const typeBadge = document.createElement('span');
        typeBadge.className = `task-badge ${task.type}`;
        typeBadge.textContent = task.type;
        metaDiv.appendChild(typeBadge);

        // Category
        if (colorGroup) {
            const categorySpan = document.createElement('span');
            categorySpan.textContent = colorGroup.name;
            metaDiv.appendChild(categorySpan);
        }

        // Due date
        if (task.dueDate) {
            const dueSpan = document.createElement('span');
            const dueDate = new Date(task.dueDate);
            dueSpan.textContent = this.formatDueDate(dueDate);

            // Add urgency color
            const now = new Date();
            const hoursUntil = (dueDate - now) / (1000 * 60 * 60);

            if (hoursUntil < 0) {
                dueSpan.style.color = 'var(--error)';
                dueSpan.textContent = 'Overdue: ' + dueSpan.textContent;
            } else if (hoursUntil < 24) {
                dueSpan.style.color = 'var(--warning)';
            }

            metaDiv.appendChild(dueSpan);
        }

        // Postponement info
        if (task.type === 'dynamic' && task.postponeCount > 0) {
            const postponeSpan = document.createElement('span');
            postponeSpan.className = 'task-postponed';
            postponeSpan.textContent = `+${task.postponeCount} postponed`;
            metaDiv.appendChild(postponeSpan);
        }

        infoDiv.appendChild(titleDiv);
        infoDiv.appendChild(metaDiv);

        item.appendChild(checkbox);
        item.appendChild(infoDiv);

        // Click to edit
        infoDiv.style.cursor = 'pointer';
        infoDiv.addEventListener('click', () => {
            taskManager.showTaskDetails(task.id);
        });

        return item;
    }

    /**
     * Format due date
     */
    formatDueDate(date) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        if (taskDate.getTime() === today.getTime()) {
            return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else if (taskDate.getTime() === tomorrow.getTime()) {
            return `Tomorrow ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            return date.toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    /**
     * Refresh all UI components
     */
    refresh() {
        this.renderFilters();
        this.renderTaskList();
        calendar.render();
    }

    /**
     * Show task details
     */
    showTaskDetails(taskId) {
        taskManager.showTaskDetails(taskId);
    }

    /**
     * Export data
     */
    exportData() {
        const data = storage.exportData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `habit-calendar-backup-${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    /**
     * Import data
     */
    async importData(file) {
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (confirm('This will replace all existing data. Continue?')) {
                const success = storage.importData(data);

                if (success) {
                    this.refresh();

                    // Reschedule notifications
                    const settings = storage.getSettings();
                    if (settings.notificationsEnabled) {
                        notifications.rescheduleAll();
                    }

                    alert('Data imported successfully!');
                } else {
                    alert('Failed to import data. Please check the file format.');
                }
            }
        } catch (e) {
            console.error('Import error:', e);
            alert('Failed to import data. Invalid file format.');
        }

        // Reset file input
        document.getElementById('import-file-input').value = '';
    }

    /**
     * Register service worker
     */
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('service-worker.js');
                console.log('Service Worker registered:', registration);
            } catch (error) {
                console.log('Service Worker registration failed:', error);
            }
        }
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new HabitCalendarApp();
    });
} else {
    window.app = new HabitCalendarApp();
}
