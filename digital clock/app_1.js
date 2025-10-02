class DigitalClockApp {
    constructor() {
        this.currentView = 'main';
        this.settings = this.loadSettings();
        this.worldClocks = this.loadWorldClocks();
        this.pomodoroTimer = null;
        this.pomodoroState = {
            isRunning: false,
            currentSession: 'work',
            timeLeft: 25 * 60, // 25 minutes in seconds
            sessionCount: 1,
            completedSessions: 0,
            totalFocusTime: 0
        };
        this.ambientSound = null;
        
        this.init();
    }

    init() {
        this.applySettings();
        this.setupEventListeners();
        this.setupWorldClocks();
        this.setSessionTime();
        this.updateTime();
        this.updateWeather();
        this.updatePomodoroDisplay();
        this.startTimeUpdates();
        
        // Apply initial theme
        document.documentElement.setAttribute('data-theme', this.settings.theme);
        document.documentElement.setAttribute('data-font', this.settings.fontFamily);
        
        console.log('Digital Clock App initialized');
    }

    setupEventListeners() {
        // Navigation - Fixed event listener setup
        const navTabs = document.querySelectorAll('.nav-tab');
        navTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const viewName = e.target.getAttribute('data-view');
                console.log('Switching to view:', viewName);
                this.switchView(viewName);
            });
        });

        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleTheme();
            });
        }

        // World clock functionality
        const addCityBtn = document.getElementById('addCityBtn');
        if (addCityBtn) {
            addCityBtn.addEventListener('click', () => {
                this.showCityModal();
            });
        }

        const citySearch = document.getElementById('citySearch');
        if (citySearch) {
            citySearch.addEventListener('input', (e) => {
                this.searchCities(e.target.value);
            });
        }

        const closeCityModal = document.getElementById('closeCityModal');
        if (closeCityModal) {
            closeCityModal.addEventListener('click', () => {
                this.hideCityModal();
            });
        }

        // Pomodoro controls
        const startPauseBtn = document.getElementById('startPauseBtn');
        if (startPauseBtn) {
            startPauseBtn.addEventListener('click', () => {
                this.togglePomodoro();
            });
        }

        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetPomodoro();
            });
        }

        const skipBtn = document.getElementById('skipBtn');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => {
                this.skipPomodoroSession();
            });
        }

        // Ambient sounds
        document.querySelectorAll('.sound-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.toggleAmbientSound(e.target.dataset.sound);
            });
        });

        // Settings
        const saveSettings = document.getElementById('saveSettings');
        if (saveSettings) {
            saveSettings.addEventListener('click', () => {
                this.saveCurrentSettings();
            });
        }

        const resetSettings = document.getElementById('resetSettings');
        if (resetSettings) {
            resetSettings.addEventListener('click', () => {
                this.resetToDefaults();
            });
        }

        // Theme selector - will be set up after DOM is ready
        setTimeout(() => {
            this.setupThemeSelector();
            this.setupSettingsInputs();
        }, 100);

        // Modal backdrop
        const modalBackdrop = document.querySelector('.modal-backdrop');
        if (modalBackdrop) {
            modalBackdrop.addEventListener('click', () => {
                this.hideCityModal();
            });
        }

        console.log('Event listeners setup complete');
    }

    switchView(viewName) {
        console.log('Switching to view:', viewName);
        
        if (!viewName) return;

        // Update nav tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const activeTab = document.querySelector(`[data-view="${viewName}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // Update views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add('active');
        }

        this.currentView = viewName;
        
        // Initialize view-specific functionality
        if (viewName === 'world') {
            this.renderWorldClocks();
        } else if (viewName === 'settings') {
            this.setupThemeSelector();
            this.setupSettingsInputs();
        }
        
        console.log('View switched to:', viewName);
    }

    toggleTheme() {
        const currentScheme = document.documentElement.getAttribute('data-color-scheme') || 'light';
        const newScheme = currentScheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-color-scheme', newScheme);
        
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.textContent = newScheme === 'dark' ? '☀️' : '🌙';
        }
        
        this.settings.colorScheme = newScheme;
        this.saveSettings();
        
        console.log('Theme toggled to:', newScheme);
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.settings.theme);
        this.saveSettings();
    }

    applyCustomColor() {
        document.documentElement.style.setProperty('--theme-primary', this.settings.primaryColor);
    }

    applySettings() {
        document.documentElement.setAttribute('data-color-scheme', this.settings.colorScheme);
        document.documentElement.setAttribute('data-theme', this.settings.theme);
        document.documentElement.setAttribute('data-font', this.settings.fontFamily);
        
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.textContent = this.settings.colorScheme === 'dark' ? '☀️' : '🌙';
        }
        
        if (this.settings.primaryColor !== '#3B82F6') {
            this.applyCustomColor();
        }
    }

    startTimeUpdates() {
        this.updateTime();
        setInterval(() => {
            this.updateTime();
            this.updateWorldClocks();
        }, 1000);
    }

    updateTime() {
        const now = new Date();
        const timeElement = document.getElementById('currentTime');
        const dateElement = document.getElementById('currentDate');
        const timezoneElement = document.getElementById('timezoneInfo');

        if (!timeElement || !dateElement || !timezoneElement) return;

        // Format time
        const timeOptions = {
            hour12: this.settings.timeFormat === '12',
            hour: '2-digit',
            minute: '2-digit'
        };

        if (this.settings.showSeconds) {
            timeOptions.second = '2-digit';
        }

        const timeString = now.toLocaleTimeString('en-US', timeOptions);
        timeElement.textContent = timeString;

        // Format date
        const dateOptions = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        const dateString = now.toLocaleDateString('en-US', dateOptions);
        dateElement.textContent = dateString;

        // Timezone info
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        timezoneElement.textContent = `${timezone.replace('_', ' ')} Time`;
    }

    updateWeather() {
        // Simulated weather data - in a real app, this would come from an API
        const weatherData = {
            temp: this.settings.tempUnit === 'celsius' ? '24°C' : '75°F',
            condition: 'Partly Cloudy',
            location: 'Your Location',
            humidity: '65%',
            wind: this.settings.tempUnit === 'celsius' ? '8 km/h' : '5 mph'
        };

        const weatherWidget = document.getElementById('weatherWidget');
        if (weatherWidget) {
            const tempEl = weatherWidget.querySelector('.weather-temp');
            const conditionEl = weatherWidget.querySelector('.weather-condition');
            const locationEl = weatherWidget.querySelector('.weather-location');
            const detailsEl = weatherWidget.querySelector('.weather-details');
            
            if (tempEl) tempEl.textContent = weatherData.temp;
            if (conditionEl) conditionEl.textContent = weatherData.condition;
            if (locationEl) locationEl.textContent = weatherData.location;
            if (detailsEl) {
                detailsEl.innerHTML = `
                    <span>Humidity: ${weatherData.humidity}</span>
                    <span>Wind: ${weatherData.wind}</span>
                `;
            }
        }
    }

    setupWorldClocks() {
        this.renderWorldClocks();
    }

    renderWorldClocks() {
        const grid = document.getElementById('worldClocksGrid');
        if (!grid) return;
        
        grid.innerHTML = this.worldClocks.map(clock => `
            <div class="world-clock-item" data-city="${clock.city}" draggable="true">
                <button class="remove-city" onclick="window.app.removeWorldClock('${clock.city}')">&times;</button>
                <div class="world-clock-city">${clock.city}, ${clock.country}</div>
                <div class="world-clock-time" data-timezone="${clock.timezone}">--:--</div>
                <div class="world-clock-date" data-timezone="${clock.timezone}">Loading...</div>
                <div class="time-difference" data-timezone="${clock.timezone}">+0h</div>
            </div>
        `).join('');

        this.updateWorldClocks();
        this.setupDragAndDrop();
    }

    updateWorldClocks() {
        const now = new Date();
        const localTime = now.getTime();
        
        this.worldClocks.forEach(clock => {
            try {
                const clockTime = new Date(now.toLocaleString("en-US", {timeZone: clock.timezone}));
                const timeElement = document.querySelector(`[data-timezone="${clock.timezone}"].world-clock-time`);
                const dateElement = document.querySelector(`[data-timezone="${clock.timezone}"].world-clock-date`);
                const diffElement = document.querySelector(`[data-timezone="${clock.timezone}"].time-difference`);

                if (timeElement) {
                    const timeOptions = {
                        hour12: this.settings.timeFormat === '12',
                        hour: '2-digit',
                        minute: '2-digit'
                    };
                    timeElement.textContent = clockTime.toLocaleTimeString('en-US', timeOptions);
                }

                if (dateElement) {
                    dateElement.textContent = clockTime.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                    });
                }

                if (diffElement) {
                    const diff = Math.round((clockTime.getTime() - localTime) / (1000 * 60 * 60));
                    const sign = diff >= 0 ? '+' : '';
                    diffElement.textContent = `${sign}${diff}h`;
                }
            } catch (error) {
                console.error(`Error updating clock for ${clock.city}:`, error);
            }
        });
    }

    showCityModal() {
        const modal = document.getElementById('cityModal');
        if (modal) {
            modal.classList.remove('hidden');
            this.renderCitySuggestions();
        }
    }

    hideCityModal() {
        const modal = document.getElementById('cityModal');
        if (modal) {
            modal.classList.add('hidden');
        }
        
        const citySearch = document.getElementById('citySearch');
        if (citySearch) {
            citySearch.value = '';
        }
    }

    renderCitySuggestions() {
        const availableCities = [
            {city: "Paris", timezone: "Europe/Paris", country: "France"},
            {city: "Moscow", timezone: "Europe/Moscow", country: "Russia"},
            {city: "Cairo", timezone: "Africa/Cairo", country: "Egypt"},
            {city: "Bangkok", timezone: "Asia/Bangkok", country: "Thailand"},
            {city: "Seoul", timezone: "Asia/Seoul", country: "South Korea"},
            {city: "Mexico City", timezone: "America/Mexico_City", country: "Mexico"},
            {city: "Buenos Aires", timezone: "America/Argentina/Buenos_Aires", country: "Argentina"},
            {city: "Vancouver", timezone: "America/Vancouver", country: "Canada"}
        ].filter(city => !this.worldClocks.find(wc => wc.city === city.city));

        const container = document.getElementById('citySuggestions');
        if (container) {
            container.innerHTML = availableCities.map(city => `
                <div class="city-suggestion" onclick="window.app.addWorldClock('${city.city}', '${city.timezone}', '${city.country}')">
                    <div><strong>${city.city}</strong></div>
                    <div>${city.country}</div>
                </div>
            `).join('');
        }
    }

    addWorldClock(city, timezone, country) {
        if (!this.worldClocks.find(wc => wc.city === city)) {
            this.worldClocks.push({city, timezone, country});
            this.saveWorldClocks();
            this.renderWorldClocks();
            this.hideCityModal();
            this.showToast(`${city} added to world clocks`, 'success');
        }
    }

    removeWorldClock(city) {
        this.worldClocks = this.worldClocks.filter(wc => wc.city !== city);
        this.saveWorldClocks();
        this.renderWorldClocks();
        this.showToast(`${city} removed from world clocks`, 'info');
    }

    setupDragAndDrop() {
        const items = document.querySelectorAll('.world-clock-item');
        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                item.classList.add('dragging');
                e.dataTransfer.setData('text/plain', item.dataset.city);
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                const draggedCity = e.dataTransfer.getData('text/plain');
                const targetCity = item.dataset.city;
                
                if (draggedCity !== targetCity) {
                    this.reorderWorldClocks(draggedCity, targetCity);
                }
            });
        });
    }

    reorderWorldClocks(draggedCity, targetCity) {
        const draggedIndex = this.worldClocks.findIndex(wc => wc.city === draggedCity);
        const targetIndex = this.worldClocks.findIndex(wc => wc.city === targetCity);
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
            const [draggedItem] = this.worldClocks.splice(draggedIndex, 1);
            this.worldClocks.splice(targetIndex, 0, draggedItem);
            this.saveWorldClocks();
            this.renderWorldClocks();
        }
    }

    // Pomodoro Timer Methods
    togglePomodoro() {
        if (this.pomodoroState.isRunning) {
            this.pausePomodoro();
        } else {
            this.startPomodoro();
        }
    }

    startPomodoro() {
        this.pomodoroState.isRunning = true;
        const startPauseBtn = document.getElementById('startPauseBtn');
        if (startPauseBtn) {
            startPauseBtn.textContent = 'Pause';
        }
        
        this.pomodoroTimer = setInterval(() => {
            this.pomodoroState.timeLeft--;
            this.updatePomodoroDisplay();
            
            if (this.pomodoroState.timeLeft <= 0) {
                this.completeSession();
            }
        }, 1000);
    }

    pausePomodoro() {
        this.pomodoroState.isRunning = false;
        const startPauseBtn = document.getElementById('startPauseBtn');
        if (startPauseBtn) {
            startPauseBtn.textContent = 'Start';
        }
        
        if (this.pomodoroTimer) {
            clearInterval(this.pomodoroTimer);
            this.pomodoroTimer = null;
        }
    }

    resetPomodoro() {
        this.pausePomodoro();
        this.setSessionTime();
        this.updatePomodoroDisplay();
    }

    skipPomodoroSession() {
        this.completeSession();
    }

    completeSession() {
        this.pausePomodoro();
        
        if (this.pomodoroState.currentSession === 'work') {
            this.pomodoroState.completedSessions++;
            this.pomodoroState.totalFocusTime += this.settings.workDuration * 60;
            
            if (this.pomodoroState.sessionCount >= 4) {
                this.pomodoroState.currentSession = 'longBreak';
                this.pomodoroState.sessionCount = 1;
            } else {
                this.pomodoroState.currentSession = 'shortBreak';
                this.pomodoroState.sessionCount++;
            }
        } else {
            this.pomodoroState.currentSession = 'work';
        }
        
        this.setSessionTime();
        this.updatePomodoroDisplay();
        this.playNotificationSound();
        this.showToast(`${this.getSessionName()} completed!`, 'success');
    }

    setSessionTime() {
        const durations = {
            work: this.settings.workDuration * 60,
            shortBreak: this.settings.shortBreak * 60,
            longBreak: this.settings.longBreak * 60
        };
        
        this.pomodoroState.timeLeft = durations[this.pomodoroState.currentSession];
    }

    updatePomodoroDisplay() {
        const minutes = Math.floor(this.pomodoroState.timeLeft / 60);
        const seconds = this.pomodoroState.timeLeft % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const timerTime = document.getElementById('timerTime');
        const sessionType = document.getElementById('sessionType');
        const sessionCounter = document.getElementById('sessionCounter');
        const completedSessions = document.getElementById('completedSessions');
        const totalFocusTime = document.getElementById('totalFocusTime');
        
        if (timerTime) timerTime.textContent = timeString;
        if (sessionType) sessionType.textContent = this.getSessionName();
        if (sessionCounter) sessionCounter.textContent = `${this.pomodoroState.sessionCount}/4`;
        if (completedSessions) completedSessions.textContent = this.pomodoroState.completedSessions;
        if (totalFocusTime) totalFocusTime.textContent = this.formatFocusTime(this.pomodoroState.totalFocusTime);
        
        // Update progress ring
        const totalTime = this.getSessionDuration() * 60;
        const progress = (totalTime - this.pomodoroState.timeLeft) / totalTime;
        const circumference = 2 * Math.PI * 45; // radius = 45
        const dashArray = `${circumference * progress} ${circumference}`;
        
        const timerProgress = document.getElementById('timerProgress');
        if (timerProgress) {
            timerProgress.style.strokeDasharray = dashArray;
        }
    }

    getSessionName() {
        const names = {
            work: 'Work Session',
            shortBreak: 'Short Break',
            longBreak: 'Long Break'
        };
        return names[this.pomodoroState.currentSession];
    }

    getSessionDuration() {
        const durations = {
            work: this.settings.workDuration,
            shortBreak: this.settings.shortBreak,
            longBreak: this.settings.longBreak
        };
        return durations[this.pomodoroState.currentSession];
    }

    formatFocusTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }

    toggleAmbientSound(soundType) {
        const soundBtns = document.querySelectorAll('.sound-btn');
        soundBtns.forEach(btn => btn.classList.remove('active'));
        
        if (this.ambientSound === soundType) {
            this.ambientSound = null;
        } else {
            this.ambientSound = soundType;
            const activeBtn = document.querySelector(`[data-sound="${soundType}"]`);
            if (activeBtn) {
                activeBtn.classList.add('active');
            }
        }
    }

    playNotificationSound() {
        if (this.settings.soundNotifications) {
            // In a real app, this would play an actual sound file
            console.log('Playing notification sound');
        }
    }

    setupThemeSelector() {
        const themes = [
            { name: 'Default', key: 'default', primary: '#3B82F6' },
            { name: 'Neon', key: 'neon', primary: '#10B981' },
            { name: 'Minimal', key: 'minimal', primary: '#6B7280' },
            { name: 'Retro', key: 'retro', primary: '#F59E0B' },
            { name: 'Nature', key: 'nature', primary: '#059669' }
        ];

        const themeSelector = document.getElementById('themeSelector');
        if (!themeSelector) return;
        
        themeSelector.innerHTML = themes.map(theme => `
            <div class="theme-option ${this.settings.theme === theme.key ? 'active' : ''}" 
                 data-theme="${theme.key}">
                <div class="theme-preview" style="background: ${theme.primary}"></div>
                <div class="theme-name">${theme.name}</div>
            </div>
        `).join('');

        themeSelector.addEventListener('click', (e) => {
            const themeOption = e.target.closest('.theme-option');
            if (themeOption) {
                document.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('active'));
                themeOption.classList.add('active');
                this.settings.theme = themeOption.dataset.theme;
                this.applyTheme();
            }
        });
    }

    setupSettingsInputs() {
        // Primary color
        const primaryColor = document.getElementById('primaryColor');
        if (primaryColor) {
            primaryColor.value = this.settings.primaryColor;
            primaryColor.addEventListener('change', (e) => {
                this.settings.primaryColor = e.target.value;
                this.applyCustomColor();
            });
        }

        // Font family
        const fontFamily = document.getElementById('fontFamily');
        if (fontFamily) {
            fontFamily.value = this.settings.fontFamily;
            fontFamily.addEventListener('change', (e) => {
                this.settings.fontFamily = e.target.value;
                document.documentElement.setAttribute('data-font', e.target.value);
            });
        }

        // Time format
        document.querySelectorAll('input[name="timeFormat"]').forEach(radio => {
            radio.checked = radio.value === this.settings.timeFormat;
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.settings.timeFormat = e.target.value;
                }
            });
        });

        // Show seconds
        const showSeconds = document.getElementById('showSeconds');
        if (showSeconds) {
            showSeconds.checked = this.settings.showSeconds;
            showSeconds.addEventListener('change', (e) => {
                this.settings.showSeconds = e.target.checked;
            });
        }

        // Temperature unit
        document.querySelectorAll('input[name="tempUnit"]').forEach(radio => {
            radio.checked = radio.value === this.settings.tempUnit;
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.settings.tempUnit = e.target.value;
                    this.updateWeather();
                }
            });
        });

        // Pomodoro settings
        const workDuration = document.getElementById('workDuration');
        const shortBreak = document.getElementById('shortBreak');
        const longBreak = document.getElementById('longBreak');
        
        if (workDuration) workDuration.value = this.settings.workDuration;
        if (shortBreak) shortBreak.value = this.settings.shortBreak;
        if (longBreak) longBreak.value = this.settings.longBreak;

        ['workDuration', 'shortBreak', 'longBreak'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', (e) => {
                    this.settings[id] = parseInt(e.target.value);
                });
            }
        });

        // Sound settings
        const soundNotifications = document.getElementById('soundNotifications');
        if (soundNotifications) {
            soundNotifications.checked = this.settings.soundNotifications;
            soundNotifications.addEventListener('change', (e) => {
                this.settings.soundNotifications = e.target.checked;
            });
        }

        const volume = document.getElementById('volume');
        if (volume) {
            volume.value = this.settings.volume;
            volume.addEventListener('input', (e) => {
                this.settings.volume = parseInt(e.target.value);
            });
        }
    }

    // Settings Management
    saveCurrentSettings() {
        // Collect current settings from form
        const primaryColor = document.getElementById('primaryColor');
        const fontFamily = document.getElementById('fontFamily');
        const timeFormatRadio = document.querySelector('input[name="timeFormat"]:checked');
        const showSeconds = document.getElementById('showSeconds');
        const tempUnitRadio = document.querySelector('input[name="tempUnit"]:checked');
        const workDuration = document.getElementById('workDuration');
        const shortBreak = document.getElementById('shortBreak');
        const longBreak = document.getElementById('longBreak');
        const soundNotifications = document.getElementById('soundNotifications');
        const volume = document.getElementById('volume');
        
        if (primaryColor) this.settings.primaryColor = primaryColor.value;
        if (fontFamily) this.settings.fontFamily = fontFamily.value;
        if (timeFormatRadio) this.settings.timeFormat = timeFormatRadio.value;
        if (showSeconds) this.settings.showSeconds = showSeconds.checked;
        if (tempUnitRadio) this.settings.tempUnit = tempUnitRadio.value;
        if (workDuration) this.settings.workDuration = parseInt(workDuration.value);
        if (shortBreak) this.settings.shortBreak = parseInt(shortBreak.value);
        if (longBreak) this.settings.longBreak = parseInt(longBreak.value);
        if (soundNotifications) this.settings.soundNotifications = soundNotifications.checked;
        if (volume) this.settings.volume = parseInt(volume.value);
        
        this.saveSettings();
        this.applySettings();
        this.updateWeather();
        this.showToast('Settings saved successfully!', 'success');
    }

    resetToDefaults() {
        this.settings = this.getDefaultSettings();
        this.saveSettings();
        this.applySettings();
        this.setupSettingsInputs();
        this.setupThemeSelector();
        this.updateWeather();
        this.showToast('Settings reset to defaults', 'info');
    }

    getDefaultSettings() {
        return {
            theme: 'default',
            colorScheme: 'light',
            primaryColor: '#3B82F6',
            fontFamily: 'digital',
            timeFormat: '12',
            showSeconds: true,
            tempUnit: 'celsius',
            workDuration: 25,
            shortBreak: 5,
            longBreak: 15,
            soundNotifications: true,
            volume: 50
        };
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('clockApp_settings');
            return saved ? {...this.getDefaultSettings(), ...JSON.parse(saved)} : this.getDefaultSettings();
        } catch {
            return this.getDefaultSettings();
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('clockApp_settings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    loadWorldClocks() {
        try {
            const saved = localStorage.getItem('clockApp_worldClocks');
            return saved ? JSON.parse(saved) : [
                {city: "New York", timezone: "America/New_York", country: "USA"},
                {city: "London", timezone: "Europe/London", country: "UK"},
                {city: "Tokyo", timezone: "Asia/Tokyo", country: "Japan"},
                {city: "Sydney", timezone: "Australia/Sydney", country: "Australia"}
            ];
        } catch {
            return [
                {city: "New York", timezone: "America/New_York", country: "USA"},
                {city: "London", timezone: "Europe/London", country: "UK"},
                {city: "Tokyo", timezone: "Asia/Tokyo", country: "Japan"},
                {city: "Sydney", timezone: "Australia/Sydney", country: "Australia"}
            ];
        }
    }

    saveWorldClocks() {
        try {
            localStorage.setItem('clockApp_worldClocks', JSON.stringify(this.worldClocks));
        } catch (error) {
            console.error('Failed to save world clocks:', error);
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        const toastContainer = document.getElementById('toastContainer');
        if (toastContainer) {
            toastContainer.appendChild(toast);
            
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 3000);
        }
    }

    searchCities(query) {
        // In a real app, this would search an actual city database
        console.log('Searching cities:', query);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    window.app = new DigitalClockApp();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (!window.app) return;
    
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case '1':
                e.preventDefault();
                window.app.switchView('main');
                break;
            case '2':
                e.preventDefault();
                window.app.switchView('world');
                break;
            case '3':
                e.preventDefault();
                window.app.switchView('pomodoro');
                break;
            case '4':
                e.preventDefault();
                window.app.switchView('settings');
                break;
        }
    }
    
    // Pomodoro shortcuts
    if (window.app.currentView === 'pomodoro') {
        switch (e.code) {
            case 'Space':
                e.preventDefault();
                window.app.togglePomodoro();
                break;
            case 'KeyR':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    window.app.resetPomodoro();
                }
                break;
        }
    }
});