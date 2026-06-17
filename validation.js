/**
 * Validation - lightweight schema-free validation for task data and imports.
 * Vanilla JS, no dependencies. Returns { valid, errors } where errors is a
 * map of field -> message so the form can render inline errors.
 */

const Validation = {
    TASK_TYPES: ['fixed', 'continuous', 'dynamic'],
    REMINDER_UNITS: ['minutes', 'hours', 'days', 'weeks'],
    REMINDER_TYPES: ['D2D', 'W2W', 'M2M'],

    /**
     * Validate a task object (as produced by the task form).
     * @returns {{valid: boolean, errors: Object<string,string>}}
     */
    validateTask(task) {
        const errors = {};

        if (!task || typeof task !== 'object') {
            return { valid: false, errors: { _form: 'Invalid task data' } };
        }

        // Title
        const title = (task.title || '').trim();
        if (!title) {
            errors.title = 'Title is required';
        } else if (title.length > 100) {
            errors.title = 'Title must be 100 characters or fewer';
        }

        // Color group
        if (!task.colorGroupId) {
            errors.colorGroupId = 'Please choose a calendar';
        }

        // Type
        if (!this.TASK_TYPES.includes(task.type)) {
            errors.type = 'Invalid task type';
        }

        // Description length
        if (task.description && task.description.length > 500) {
            errors.description = 'Description must be 500 characters or fewer';
        }

        // Dates (non-continuous tasks need a valid due date)
        if (task.type !== 'continuous') {
            if (!task.dueDate || isNaN(new Date(task.dueDate).getTime())) {
                errors.dueDate = 'Please set a valid due date';
            }
            if (task.startDate) {
                if (isNaN(new Date(task.startDate).getTime())) {
                    errors.startDate = 'Invalid start date';
                } else if (task.dueDate && new Date(task.startDate) > new Date(task.dueDate)) {
                    errors.startDate = 'Start must be before the due date';
                }
            }
        }

        // Dynamic tasks need a valid reminder type
        if (task.type === 'dynamic' && task.reminderType &&
            !this.REMINDER_TYPES.includes(task.reminderType)) {
            errors.reminderType = 'Invalid reminder type';
        }

        // Reminders
        if (Array.isArray(task.reminders)) {
            for (const r of task.reminders) {
                const amount = parseInt(r.amount, 10);
                if (isNaN(amount) || amount < 1) {
                    errors.reminders = 'Reminder amounts must be positive numbers';
                    break;
                }
                if (!this.REMINDER_UNITS.includes(r.unit)) {
                    errors.reminders = 'Invalid reminder unit';
                    break;
                }
            }
        }

        return { valid: Object.keys(errors).length === 0, errors };
    },

    /**
     * Validate a color group.
     */
    validateColorGroup(name, color) {
        const errors = {};
        const trimmed = (name || '').trim();
        if (!trimmed) {
            errors.name = 'Please enter a group name';
        } else if (trimmed.length > 30) {
            errors.name = 'Name must be 30 characters or fewer';
        }
        if (!/^#[0-9a-fA-F]{6}$/.test(color || '')) {
            errors.color = 'Please pick a valid color';
        }
        return { valid: Object.keys(errors).length === 0, errors };
    },

    /**
     * Validate imported backup data shape.
     */
    validateImport(data) {
        if (!data || typeof data !== 'object') {
            return { valid: false, errors: { _form: 'File is not valid JSON' } };
        }
        if (data.tasks && !Array.isArray(data.tasks)) {
            return { valid: false, errors: { _form: 'Invalid tasks data' } };
        }
        if (data.colorGroups && !Array.isArray(data.colorGroups)) {
            return { valid: false, errors: { _form: 'Invalid color groups data' } };
        }
        return { valid: true, errors: {} };
    }
};

if (typeof window !== 'undefined') {
    window.Validation = Validation;
}
