/**
 * Storage Manager - Handles all data persistence using LocalStorage
 */

class StorageManager {
    constructor() {
        this.STORAGE_KEYS = {
            TASKS: 'habit_calendar_tasks',
            COLOR_GROUPS: 'habit_calendar_colors',
            SETTINGS: 'habit_calendar_settings',
            FILTERS: 'habit_calendar_filters'
        };

        this.initializeDefaults();
    }

    /**
     * Initialize default data if not exists
     */
    initializeDefaults() {
        // Default color groups
        if (!this.getColorGroups().length) {
            const defaultColors = [
                { id: this.generateId(), name: 'Work', color: '#2196F3', count: 0 },
                { id: this.generateId(), name: 'Personal', color: '#4CAF50', count: 0 },
                { id: this.generateId(), name: 'Health', color: '#FF5722', count: 0 },
                { id: this.generateId(), name: 'Finance', color: '#FFC107', count: 0 }
            ];
            this.saveColorGroups(defaultColors);
        }

        // Default settings
        if (!this.getSettings()) {
            const defaultSettings = {
                notificationsEnabled: false,
                theme: 'light',
                weekStartsOn: 'monday' // monday or sunday
            };
            this.saveSettings(defaultSettings);
        }

        // Default filters
        if (!this.getFilters()) {
            this.saveFilters({
                visibleColorGroups: this.getColorGroups().map(c => c.id)
            });
        }
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Save to LocalStorage
     */
    save(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Storage error:', e);
            if (e.name === 'QuotaExceededError') {
                alert('Storage quota exceeded. Please delete some old tasks.');
            }
            return false;
        }
    }

    /**
     * Load from LocalStorage
     */
    load(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Load error:', e);
            return null;
        }
    }

    /**
     * Task Management
     */
    getTasks() {
        return this.load(this.STORAGE_KEYS.TASKS) || [];
    }

    saveTasks(tasks) {
        return this.save(this.STORAGE_KEYS.TASKS, tasks);
    }

    addTask(task) {
        const tasks = this.getTasks();
        task.id = this.generateId();
        task.createdAt = new Date().toISOString();
        task.updatedAt = new Date().toISOString();
        task.completed = false;
        task.completedAt = null;

        // For dynamic tasks, track postponement
        if (task.type === 'dynamic') {
            task.originalDueDate = task.dueDate;
            task.postponeCount = 0;
        }

        tasks.push(task);

        // Update color group count
        this.incrementColorGroupCount(task.colorGroupId);

        return this.saveTasks(tasks) ? task : null;
    }

    updateTask(taskId, updates) {
        const tasks = this.getTasks();
        const index = tasks.findIndex(t => t.id === taskId);

        if (index === -1) return false;

        // If color group changed, update counts
        if (updates.colorGroupId && updates.colorGroupId !== tasks[index].colorGroupId) {
            this.decrementColorGroupCount(tasks[index].colorGroupId);
            this.incrementColorGroupCount(updates.colorGroupId);
        }

        tasks[index] = {
            ...tasks[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        return this.saveTasks(tasks);
    }

    deleteTask(taskId) {
        const tasks = this.getTasks();
        const task = tasks.find(t => t.id === taskId);

        if (!task) return false;

        // Update color group count
        this.decrementColorGroupCount(task.colorGroupId);

        const filtered = tasks.filter(t => t.id !== taskId);
        return this.saveTasks(filtered);
    }

    completeTask(taskId) {
        return this.updateTask(taskId, {
            completed: true,
            completedAt: new Date().toISOString()
        });
    }

    uncompleteTask(taskId) {
        return this.updateTask(taskId, {
            completed: false,
            completedAt: null
        });
    }

    /**
     * Get tasks for a specific date
     */
    getTasksForDate(date) {
        const tasks = this.getTasks();
        // Normalize the target day to local midnight once.
        const dayStart = this.getDateAtMidnight(date);

        return tasks.filter(task => {
            if (task.completed && task.type !== 'continuous') return false;

            if (task.type === 'continuous') {
                // Show continuous tasks from their creation day onward (until
                // completed). Compare on local-day boundaries.
                const createdDay = this.getDateAtMidnight(task.createdAt);
                const completedDay = task.completedAt ? this.getDateAtMidnight(task.completedAt) : null;

                return createdDay.getTime() <= dayStart.getTime() &&
                       (!completedDay || completedDay.getTime() >= dayStart.getTime());
            }

            if (task.type === 'fixed' || task.type === 'dynamic') {
                const taskStartDay = this.getDateAtMidnight(task.startDate || task.dueDate);
                const taskDueDay = this.getDateAtMidnight(task.dueDate);

                // Inclusive range check on local-day boundaries.
                return dayStart.getTime() >= taskStartDay.getTime() &&
                       dayStart.getTime() <= taskDueDay.getTime();
            }

            return false;
        });
    }

    /**
     * Postpone dynamic task
     */
    postponeDynamicTask(taskId) {
        const task = this.getTasks().find(t => t.id === taskId);
        if (!task || task.type !== 'dynamic') return false;

        const reminderType = task.reminderType || 'D2D';
        const currentDueDate = new Date(task.dueDate);
        let newDueDate;

        switch (reminderType) {
            case 'D2D':
                newDueDate = new Date(currentDueDate);
                newDueDate.setDate(newDueDate.getDate() + 1);
                break;
            case 'W2W':
                newDueDate = new Date(currentDueDate);
                newDueDate.setDate(newDueDate.getDate() + 7);
                break;
            case 'M2M':
                newDueDate = new Date(currentDueDate);
                newDueDate.setMonth(newDueDate.getMonth() + 1);
                break;
            default:
                newDueDate = new Date(currentDueDate);
                newDueDate.setDate(newDueDate.getDate() + 1);
        }

        return this.updateTask(taskId, {
            dueDate: newDueDate.toISOString(),
            postponeCount: (task.postponeCount || 0) + 1
        });
    }

    /**
     * Color Group Management
     */
    getColorGroups() {
        return this.load(this.STORAGE_KEYS.COLOR_GROUPS) || [];
    }

    saveColorGroups(colorGroups) {
        return this.save(this.STORAGE_KEYS.COLOR_GROUPS, colorGroups);
    }

    addColorGroup(name, color) {
        const colorGroups = this.getColorGroups();
        const newGroup = {
            id: this.generateId(),
            name,
            color,
            count: 0
        };
        colorGroups.push(newGroup);

        // Add to visible filters
        const filters = this.getFilters();
        filters.visibleColorGroups.push(newGroup.id);
        this.saveFilters(filters);

        return this.saveColorGroups(colorGroups) ? newGroup : null;
    }

    incrementColorGroupCount(colorGroupId) {
        const colorGroups = this.getColorGroups();
        const group = colorGroups.find(c => c.id === colorGroupId);
        if (group) {
            group.count = (group.count || 0) + 1;
            this.saveColorGroups(colorGroups);
        }
    }

    decrementColorGroupCount(colorGroupId) {
        const colorGroups = this.getColorGroups();
        const group = colorGroups.find(c => c.id === colorGroupId);
        if (group && group.count > 0) {
            group.count--;
            this.saveColorGroups(colorGroups);
        }
    }

    /**
     * Settings Management
     */
    getSettings() {
        return this.load(this.STORAGE_KEYS.SETTINGS);
    }

    saveSettings(settings) {
        return this.save(this.STORAGE_KEYS.SETTINGS, settings);
    }

    updateSetting(key, value) {
        const settings = this.getSettings();
        settings[key] = value;
        return this.saveSettings(settings);
    }

    /**
     * Filter Management
     */
    getFilters() {
        return this.load(this.STORAGE_KEYS.FILTERS);
    }

    saveFilters(filters) {
        return this.save(this.STORAGE_KEYS.FILTERS, filters);
    }

    toggleColorFilter(colorGroupId) {
        const filters = this.getFilters();
        const index = filters.visibleColorGroups.indexOf(colorGroupId);

        if (index > -1) {
            filters.visibleColorGroups.splice(index, 1);
        } else {
            filters.visibleColorGroups.push(colorGroupId);
        }

        return this.saveFilters(filters);
    }

    /**
     * Export/Import
     */
    exportData() {
        return {
            tasks: this.getTasks(),
            colorGroups: this.getColorGroups(),
            settings: this.getSettings(),
            filters: this.getFilters(),
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
    }

    importData(data) {
        try {
            if (data.tasks) this.saveTasks(data.tasks);
            if (data.colorGroups) this.saveColorGroups(data.colorGroups);
            if (data.settings) this.saveSettings(data.settings);
            if (data.filters) this.saveFilters(data.filters);
            return true;
        } catch (e) {
            console.error('Import error:', e);
            return false;
        }
    }

    clearAllData() {
        Object.values(this.STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        this.initializeDefaults();
    }

    /**
     * Utility Functions
     */
    formatDate(date) {
        // Build the local-day key from local fields so a task at e.g. 23:30
        // is keyed to its local day, not shifted by UTC conversion.
        const d = this.getDateAtMidnight(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Return a new Date set to local midnight (00:00:00.000) of the given date.
     * Timezone-safe: uses local fields, so midnight-boundary tasks land on the
     * correct local day regardless of UTC offset / DST.
     */
    getDateAtMidnight(date) {
        const d = new Date(date);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    /**
     * True if a and b fall on the same local calendar day.
     */
    isSameLocalDay(a, b) {
        const da = new Date(a);
        const db = new Date(b);
        return da.getFullYear() === db.getFullYear() &&
               da.getMonth() === db.getMonth() &&
               da.getDate() === db.getDate();
    }

    formatDateTime(date) {
        const d = new Date(date);
        return d.toISOString();
    }
}

// Create global instance
const storage = new StorageManager();
