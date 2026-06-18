/**
 * Notification Manager - Handles Web Notifications API
 */

class NotificationManager {
    constructor() {
        this.permission = Notification.permission;
        this.scheduledNotifications = new Map();
        this.checkInterval = null;
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
        if (this.permission !== 'granted') return;

        // Clear existing notifications for this task
        this.clearTaskNotifications(task.id);

        if (!task.reminders || task.reminders.length === 0) return;

        const dueDate = new Date(task.dueDate);
        const now = new Date();

        task.reminders.forEach((reminder, index) => {
            const notificationTime = this.calculateReminderTime(dueDate, reminder);

            if (notificationTime > now) {
                const timeUntil = notificationTime - now;
                const timeoutId = setTimeout(() => {
                    this.showTaskReminder(task, reminder);
                }, timeUntil);

                const key = `${task.id}_${index}`;
                this.scheduledNotifications.set(key, timeoutId);
            }
        });
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
    showTaskReminder(task, reminder) {
        const dueDate = new Date(task.dueDate);
        const timeStr = this.formatTime(dueDate);

        let body = `Due: ${timeStr}`;
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
            if (key.startsWith(taskId)) {
                clearTimeout(timeoutId);
                keysToDelete.push(key);
            }
        });

        keysToDelete.forEach(key => this.scheduledNotifications.delete(key));
    }

    /**
     * Reschedule all notifications
     */
    rescheduleAll() {
        // Clear all existing
        this.scheduledNotifications.forEach(timeoutId => clearTimeout(timeoutId));
        this.scheduledNotifications.clear();

        // Schedule for all active tasks
        const tasks = storage.getTasks().filter(t => !t.completed || t.type === 'continuous');
        tasks.forEach(task => this.scheduleTaskNotifications(task));
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
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }
}

// Create global instance
const notifications = new NotificationManager();
