/**
 * Calendar Manager - Handles calendar rendering and interactions
 */

class CalendarManager {
    constructor() {
        this.currentDate = new Date();
        this.currentMonth = this.currentDate.getMonth();
        this.currentYear = this.currentDate.getFullYear();
        this.weeksToShow = 6; // Standard month view (6 weeks)
        this.zoomLevel = 1.0;

        this.initializeEventListeners();
    }

    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        // Month navigation
        document.getElementById('prev-month').addEventListener('click', () => {
            this.changeMonth(-1);
        });

        document.getElementById('next-month').addEventListener('click', () => {
            this.changeMonth(1);
        });

        // Today button
        document.getElementById('today-btn').addEventListener('click', () => {
            this.goToToday();
        });

        // Menu toggle (mobile)
        document.getElementById('menu-toggle').addEventListener('click', () => {
            const sidebar = document.getElementById('filter-sidebar');
            sidebar.classList.toggle('open');
        });
    }

    /**
     * Go to today's date
     */
    goToToday() {
        const today = new Date();
        this.currentMonth = today.getMonth();
        this.currentYear = today.getFullYear();
        this.render();
    }

    /**
     * Change month
     */
    changeMonth(delta) {
        this.currentMonth += delta;

        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        } else if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }

        this.render();
    }

    /**
     * Render calendar
     */
    render() {
        this.renderHeader();
        this.renderWeeks();
    }

    /**
     * Render header with month/year
     */
    renderHeader() {
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        const header = document.getElementById('current-month-year');
        header.textContent = `${monthNames[this.currentMonth]} ${this.currentYear}`;
    }

    /**
     * Render calendar weeks
     */
    renderWeeks() {
        const container = document.getElementById('weeks-container');
        container.innerHTML = '';

        // Get first day of the month
        const firstDay = new Date(this.currentYear, this.currentMonth, 1);
        const dayOfWeek = firstDay.getDay();

        // Adjust to Monday as first day (0 = Sunday, 1 = Monday)
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

        // Start from Monday of the first week
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() + mondayOffset);

        // Get filters
        const filters = storage.getFilters();
        const visibleColorGroups = filters.visibleColorGroups;

        // Render weeks
        for (let week = 0; week < this.weeksToShow; week++) {
            const weekDiv = document.createElement('div');
            weekDiv.className = 'calendar-week';

            // Render 7 days (Mon to Sun)
            for (let day = 0; day < 7; day++) {
                const currentDate = new Date(startDate);
                currentDate.setDate(startDate.getDate() + (week * 7) + day);

                const dayDiv = this.createDayElement(currentDate, visibleColorGroups);
                weekDiv.appendChild(dayDiv);
            }

            container.appendChild(weekDiv);
        }
    }

    /**
     * Create day element
     */
    createDayElement(date, visibleColorGroups) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';

        // Check if other month
        if (date.getMonth() !== this.currentMonth) {
            dayDiv.classList.add('other-month');
        }

        // Check if today
        if (this.isToday(date)) {
            dayDiv.classList.add('today');
        }

        // Day number
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = date.getDate();
        dayDiv.appendChild(dayNumber);

        // Tasks container
        const tasksContainer = document.createElement('div');
        tasksContainer.className = 'day-tasks';

        // Get tasks for this day
        const tasks = storage.getTasksForDate(date);

        // Filter by visible color groups
        const visibleTasks = tasks.filter(t => visibleColorGroups.includes(t.colorGroupId));

        // Sort tasks by frequency and time
        const sortedTasks = taskManager.getSortedTasks(visibleTasks);

        // Limit to first 3 tasks, show "more" indicator
        const maxVisible = 3;
        const displayTasks = sortedTasks.slice(0, maxVisible);

        displayTasks.forEach(task => {
            const taskBar = this.createTaskBar(task, date);
            tasksContainer.appendChild(taskBar);
        });

        if (sortedTasks.length > maxVisible) {
            const moreDiv = document.createElement('div');
            moreDiv.className = 'task-more';
            moreDiv.textContent = `+${sortedTasks.length - maxVisible} more`;
            tasksContainer.appendChild(moreDiv);
        }

        dayDiv.appendChild(tasksContainer);

        // Click handler - show day details
        dayDiv.addEventListener('click', (e) => {
            // Don't open if clicked on task
            if (e.target.closest('.task-bar')) return;
            this.showDayDetails(date);
        });

        return dayDiv;
    }

    /**
     * Create task bar element
     */
    createTaskBar(task, date) {
        const taskBar = document.createElement('div');
        taskBar.className = 'task-bar';

        // Get color
        const colorGroup = storage.getColorGroups().find(c => c.id === task.colorGroupId);
        const color = colorGroup ? colorGroup.color : '#999';

        if (task.type === 'continuous') {
            taskBar.classList.add('continuous');
            taskBar.style.borderColor = color;
        } else {
            taskBar.style.backgroundColor = color;
        }

        // Handle multi-day tasks
        if (task.type === 'fixed' || task.type === 'dynamic') {
            const taskStartDate = task.startDate ? new Date(task.startDate) : new Date(task.dueDate);
            const taskDueDate = new Date(task.dueDate);

            const isStart = this.isSameDay(date, taskStartDate);
            const isEnd = this.isSameDay(date, taskDueDate);

            if (!isStart && !isEnd) {
                taskBar.classList.add('multi-day-middle');
            } else if (isStart && !isEnd) {
                taskBar.classList.add('multi-day-start');
            } else if (!isStart && isEnd) {
                taskBar.classList.add('multi-day-end');
            }
        }

        // Task title
        let title = task.title;

        // For dynamic tasks, show postponement
        if (task.type === 'dynamic' && task.postponeCount > 0) {
            const originalDate = new Date(task.originalDueDate);
            const currentDate = new Date(task.dueDate);
            const daysDiff = Math.floor((currentDate - originalDate) / (1000 * 60 * 60 * 24));
            title += ` (+${daysDiff}d)`;
        }

        taskBar.textContent = title;
        taskBar.title = task.title; // Tooltip

        // Click handler
        taskBar.addEventListener('click', (e) => {
            e.stopPropagation();
            taskManager.showTaskDetails(task.id);
        });

        return taskBar;
    }

    /**
     * Show day details modal
     */
    showDayDetails(date) {
        const modal = document.getElementById('day-modal');
        const title = document.getElementById('day-modal-title');
        const tasksList = document.getElementById('day-tasks-list');

        // Format date
        const dateStr = date.toLocaleDateString([], {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        title.textContent = dateStr;

        // Get tasks for this day
        const filters = storage.getFilters();
        const tasks = storage.getTasksForDate(date).filter(t =>
            filters.visibleColorGroups.includes(t.colorGroupId)
        );

        // Sort by due time
        tasks.sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
        });

        // Render tasks
        tasksList.innerHTML = '';

        if (tasks.length === 0) {
            tasksList.innerHTML = '<p class="text-center" style="color: var(--text-secondary);">No tasks for this day</p>';
        } else {
            tasks.forEach(task => {
                const taskItem = this.createDayTaskItem(task);
                tasksList.appendChild(taskItem);
            });
        }

        modal.classList.add('active');
    }

    /**
     * Create day task item
     */
    createDayTaskItem(task) {
        const item = document.createElement('div');
        item.className = 'day-task-item';

        const colorGroup = storage.getColorGroups().find(c => c.id === task.colorGroupId);
        const color = colorGroup ? colorGroup.color : '#999';
        item.style.borderLeftColor = color;

        // Time
        if (task.dueDate) {
            const timeDiv = document.createElement('div');
            timeDiv.className = 'day-task-time';

            if (task.startDate) {
                const start = new Date(task.startDate);
                const end = new Date(task.dueDate);
                timeDiv.textContent = `${this.formatTime(start)} - ${this.formatTime(end)}`;
            } else {
                const due = new Date(task.dueDate);
                timeDiv.textContent = `Due: ${this.formatTime(due)}`;
            }

            item.appendChild(timeDiv);
        }

        // Title
        const titleDiv = document.createElement('div');
        titleDiv.className = 'day-task-title';
        titleDiv.textContent = task.title;
        item.appendChild(titleDiv);

        // Type badge
        const badge = document.createElement('span');
        badge.className = `task-badge ${task.type}`;
        badge.textContent = task.type;
        titleDiv.appendChild(document.createTextNode(' '));
        titleDiv.appendChild(badge);

        // Description
        if (task.description) {
            const descDiv = document.createElement('div');
            descDiv.className = 'day-task-desc';
            descDiv.textContent = task.description;
            item.appendChild(descDiv);
        }

        // Postponement info
        if (task.type === 'dynamic' && task.postponeCount > 0) {
            const postponeDiv = document.createElement('div');
            postponeDiv.className = 'task-postponed';
            const originalDate = new Date(task.originalDueDate);
            postponeDiv.textContent = `Originally: ${originalDate.toLocaleDateString()}, Postponed ${task.postponeCount} time(s)`;
            item.appendChild(postponeDiv);
        }

        // Checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.className = 'task-checkbox';
        checkbox.addEventListener('change', () => {
            taskManager.toggleTaskCompletion(task.id);
            document.getElementById('day-modal').classList.remove('active');
        });

        item.insertBefore(checkbox, item.firstChild);

        // Click to edit
        item.style.cursor = 'pointer';
        item.addEventListener('click', (e) => {
            if (e.target !== checkbox) {
                taskManager.showTaskDetails(task.id);
            }
        });

        return item;
    }

    /**
     * Format time
     */
    formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    /**
     * Check if date is today
     */
    isToday(date) {
        return storage.isSameLocalDay(date, new Date());
    }

    /**
     * Check if two dates are the same local day (timezone-safe)
     */
    isSameDay(date1, date2) {
        return storage.isSameLocalDay(date1, date2);
    }

    /**
     * Apply zoom
     */
    applyZoom(delta) {
        this.zoomLevel = Math.max(0.5, Math.min(2.0, this.zoomLevel + delta));

        const calendarGrid = document.getElementById('calendar-grid');
        calendarGrid.style.transform = `scale(${this.zoomLevel})`;
        calendarGrid.style.transformOrigin = 'top left';
    }

    /**
     * Navigate to specific date
     */
    navigateToDate(date) {
        this.currentMonth = date.getMonth();
        this.currentYear = date.getFullYear();
        this.render();
    }
}

// Create global instance
const calendar = new CalendarManager();
