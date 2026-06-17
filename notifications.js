/**
 * Notification Manager - Handles Web Notifications API
 */

class NotificationManager {
    constructor() {
        this.permission = ('Notification' in window) ? Notification.permission : 'denied';
        this.scheduledNotifications = new Map();
        this.checkInterval = null;

        // localStorage keys for persistence across tab close / restart.
        this.SCHEDULE_KEY = 'habit_calendar_scheduled_reminders';
        this.FIRED_KEY = 'habit_calendar_fired_reminders';
    }

    /**
     * Build a stable, unique key for a single reminder occurrence so it can be
     * deduped (never double-fires) across replays and the periodic check.
     */
    reminderKey(taskId, index, fireTime) {
        const t = (fireTime instanceof Date) ? fireTime.getTime() : new Date(fireTime).getTime();
        return `${taskId}_${index}_${t}`;
    }

    /**
     * Persisted schedule: array of { key, taskId, index, fireTime (ms) }.
     */
    loadSchedule() {
        try {
            return JSON.parse(localStorage.getItem(this.SCHEDULE_KEY)) || [];
        } catch (e) {
            return [];
        }
    }

    saveSchedule(schedule) {
        try {
            localStorage.setItem(this.SCHEDULE_KEY, JSON.stringify(schedule));
        } catch (e) {
            console.error('Failed to persist reminder schedule', e);
        }
    }

    /**
     * Set of reminder keys that have already fired (dedup).
     */
    loadFired() {
        try {
            return new Set(JSON.parse(localStorage.getItem(this.FIRED_KEY)) || []);
        } catch (e) {
            return new Set();
        }
    }

    saveFired(set) {
        try {
            // Cap the fired log so it can't grow unbounded.
            const arr = Array.from(set).slice(-500);
            localStorage.setItem(this.FIRED_KEY, JSON.stringify(arr));
        } catch (e) {
            console.error('Failed to persist fired reminders', e);
        }
    }

    markFired(key) {
        const fired = this.loadFired();
        fired.add(key);
        this.saveFired(fired);
    }

    hasFired(key) {
        return this.loadFired().has(key);
    }

    /**
     * Replay any reminders whose fire time passed while the app was closed.
     * Fires each at most once (deduped), then prunes stale schedule entries.
     * Safe to call when permission is denied (it just no-ops the display).
     */
    replayMissedReminders() {
        const schedule = this.loadSchedule();
        if (!schedule.length) return;

        const now = Date.now();
        const tasks = storage.getTasks();
        const stillPending = [];

        schedule.forEach(entry => {
            const task = tasks.find(t => t.id === entry.taskId);
            if (!task) return; // task deleted -> drop entry

            if (entry.fireTime <= now) {
                // Due/overdue: fire once if not already fired.
                if (!this.hasFired(entry.key)) {
                    this.markFired(entry.key);
                    if (this.permission === 'granted') {
                        const reminder = (task.reminders && task.reminders[entry.index]) || null;
                        this.showTaskReminder(task, reminder, { missed: true });
                    }
                }
                // Do not keep past entries.
            } else {
                stillPending.push(entry);
            }
        });

        this.saveSchedule(stillPending);
    }

    /**
     * Request notification permission
     */
    async requestPermission() {
        if (!('Notification' in window)) {
            console.error('This browser does not support notifications');
            return false;
        }

        if (this.permission === 'granted') {
            return true;
        }

        try {
            const permission = await Notification.requestPermission();
            this.permission = permission;
            return permission === 'granted';
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return false;
        }
    }

    /**
     * Show a notification
     */
    show(title, options = {}) {
        if (this.permission !== 'granted') {
            console.warn('Notification permission not granted');
            return null;
        }

        const defaultOptions = {
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📅</text></svg>',
            badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📅</text></svg>',
            vibrate: [200, 100, 200],
            requireInteraction: false
        };

        try {
            const notification = new Notification(title, {
                ...defaultOptions,
                ...options
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
                if (options.onClick) {
                    options.onClick();
                }
            };

            return notification;
        } catch (error) {
            console.error('Error showing notification:', error);
            return null;
        }
    }

    /**
     * Schedule notifications for a task
     */
    scheduleTaskNotifications(task) {
        // Clear existing notifications + persisted entries for this task.
        this.clearTaskNotifications(task.id);

        if (!task.reminders || task.reminders.length === 0) return;
        if (!task.dueDate) return;

        const dueDate = new Date(task.dueDate);
        const now = Date.now();

        const schedule = this.loadSchedule();

        task.reminders.forEach((reminder, index) => {
            const notificationTime = this.calculateReminderTime(dueDate, reminder);
            const fireTime = notificationTime.getTime();
            const key = this.reminderKey(task.id, index, fireTime);

            // Persist metadata so it can be replayed after a tab close/restart.
            if (fireTime > now && !this.hasFired(key)) {
                schedule.push({ key, taskId: task.id, index, fireTime });

                // Only arm an in-memory timer when permission is granted.
                if (this.permission === 'granted') {
                    const timeoutId = setTimeout(() => {
                        if (!this.hasFired(key)) {
                            this.markFired(key);
                            this.showTaskReminder(task, reminder);
                            // Remove this entry from the persisted schedule.
                            const remaining = this.loadSchedule().filter(e => e.key !== key);
                            this.saveSchedule(remaining);
                        }
                    }, fireTime - now);
                    this.scheduledNotifications.set(key, timeoutId);
                }
            }
        });

        this.saveSchedule(schedule);
    }

    /**
     * Calculate reminder time based on due date and reminder settings
     */
    calculateReminderTime(dueDate, reminder) {
        const time = new Date(dueDate);
        const amount = parseInt(reminder.amount);

        switch (reminder.unit) {
            case 'minutes':
                time.setMinutes(time.getMinutes() - amount);
                break;
            case 'hours':
                time.setHours(time.getHours() - amount);
                break;
            case 'days':
                time.setDate(time.getDate() - amount);
                break;
            case 'weeks':
                time.setDate(time.getDate() - (amount * 7));
                break;
            default:
                time.setMinutes(time.getMinutes() - amount);
        }

        return time;
    }

    /**
     * Show task reminder notification
     */
    showTaskReminder(task, reminder, opts = {}) {
        const dueDate = new Date(task.dueDate);
        const timeStr = this.formatTime(dueDate);

        let body = opts.missed ? `Missed reminder — Due: ${timeStr}` : `Due: ${timeStr}`;
        if (task.description) {
            body += `\n${task.description}`;
        }

        const colorGroup = storage.getColorGroups().find(c => c.id === task.colorGroupId);
        const category = colorGroup ? colorGroup.name : 'Task';

        this.show(`${category}: ${task.title}`, {
            body,
            tag: task.id,
            data: { taskId: task.id },
            onClick: () => {
                // Focus on the task in the UI
                if (window.app) {
                    window.app.showTaskDetails(task.id);
                }
            }
        });

        // For dynamic tasks, auto-postpone if reminder type is set
        if (task.type === 'dynamic' && task.reminderType) {
            const now = new Date();
            if (dueDate <= now) {
                storage.postponeDynamicTask(task.id);
                // Reschedule notifications for the new due date
                const updatedTask = storage.getTasks().find(t => t.id === task.id);
                if (updatedTask) {
                    this.scheduleTaskNotifications(updatedTask);
                }
            }
        }
    }

    /**
     * Clear notifications for a specific task
     */
    clearTaskNotifications(taskId) {
        const keysToDelete = [];

        this.scheduledNotifications.forEach((timeoutId, key) => {
            if (key.startsWith(`${taskId}_`)) {
                clearTimeout(timeoutId);
                keysToDelete.push(key);
            }
        });

        keysToDelete.forEach(key => this.scheduledNotifications.delete(key));

        // Drop persisted schedule entries for this task too.
        const remaining = this.loadSchedule().filter(e => e.taskId !== taskId);
        this.saveSchedule(remaining);
    }

    /**
     * Reschedule all notifications
     */
    rescheduleAll() {
        // Clear all in-memory timers and the persisted schedule (rebuilt below).
        this.scheduledNotifications.forEach(timeoutId => clearTimeout(timeoutId));
        this.scheduledNotifications.clear();
        this.saveSchedule([]);

        // Schedule for all active tasks
        const tasks = storage.getTasks().filter(t => !t.completed || t.type === 'continuous');
        tasks.forEach(task => this.scheduleTaskNotifications(task));
    }

    /**
     * Init-time entry point: replay anything missed while closed, then arm
     * future timers. Safe to call regardless of permission state.
     */
    initFromPersistence() {
        // Replay first (dedup-protected), then rebuild forward-looking timers.
        this.replayMissedReminders();
        this.rescheduleAll();
    }

    /**
     * Start periodic check for notifications (fallback)
     */
    startPeriodicCheck() {
        if (this.checkInterval) return;

        // Check every minute for due tasks
        this.checkInterval = setInterval(() => {
            this.checkDueTasks();
        }, 60000); // 60 seconds
    }

    /**
     * Stop periodic check
     */
    stopPeriodicCheck() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    /**
     * Check for tasks due within the next minute
     */
    checkDueTasks() {
        if (this.permission !== 'granted') return;

        const now = new Date();
        const nextMinute = new Date(now.getTime() + 60000);

        const tasks = storage.getTasks().filter(t => {
            if (t.completed && t.type !== 'continuous') return false;

            const dueDate = new Date(t.dueDate);
            return dueDate >= now && dueDate <= nextMinute;
        });

        tasks.forEach(task => {
            this.show(`Task Due Now: ${task.title}`, {
                body: task.description || 'This task is due now!',
                tag: `due_${task.id}`,
                requireInteraction: true,
                onClick: () => {
                    if (window.app) {
                        window.app.showTaskDetails(task.id);
                    }
                }
            });
        });
    }

    /**
     * Test notification
     */
    async test() {
        const granted = await this.requestPermission();
        if (granted) {
            this.show('Test Notification', {
                body: 'Notifications are working correctly! 🎉',
                requireInteraction: false
            });
            return true;
        }
        return false;
    }

    /**
     * Format time for display
     */
    formatTime(date) {
        const d = new Date(date);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (this.isSameDay(d, today)) {
            return `Today at ${timeStr}`;
        } else if (this.isSameDay(d, tomorrow)) {
            return `Tomorrow at ${timeStr}`;
        } else {
            return d.toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    /**
     * Check if two dates are the same day
     */
    isSameDay(date1, date2) {
        if (typeof storage !== 'undefined' && storage.isSameLocalDay) {
            return storage.isSameLocalDay(date1, date2);
        }
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }
}

// Create global instance
const notifications = new NotificationManager();
