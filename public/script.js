// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js')
      .then(function(registration) {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch(function(error) {
        console.log('Service Worker registration failed:', error);
      });
  });
}

// PWA Install Prompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log('App can be installed!');
  showInstallPromotion();
});

function showInstallPromotion() {
  // You can add a custom "Install App" button to your interface
  console.log('App can be installed!');
  
  // Optional: Show an install button (uncomment if you want this)
  // const installButton = document.createElement('button');
  // installButton.textContent = 'Install App';
  // installButton.className = 'install-button';
  // installButton.onclick = installApp;
  // document.body.appendChild(installButton);
}

async function installApp() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    deferredPrompt = null;
  }
}

// API Base URL
const API_BASE = '';

// Elderly Interface Functions
async function checkMessage() {
    const messageInput = document.getElementById('messageInput');
    const resultDiv = document.getElementById('result');
    
    if (!messageInput.value.trim()) {
        showResult('Please enter a message to check', 'warning');
        return;
    }

    try {
        const response = await fetch('/api/flag-event', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: messageInput.value,
                source: 'manual_check',
                type: 'message'
            })
        });

        const data = await response.json();
        
        if (data.suspicious) {
            showResult(`⚠️ WARNING: This message appears suspicious! Keywords found: ${data.keywordsFound.join(', ')}. We've alerted your family.`, 'danger');
        } else {
            showResult('✅ This message appears safe. Always stay cautious!', 'safe');
        }
    } catch (error) {
        showResult('❌ Error checking message. Please try again.', 'danger');
        console.error('Error:', error);
    }
}

function showResult(message, type) {
    const resultDiv = document.getElementById('result');
    resultDiv.textContent = message;
    resultDiv.className = `result-message ${type}`;
}

// Emergency Button Functionality
document.addEventListener('DOMContentLoaded', function() {
    const emergencyBtn = document.getElementById('emergencyBtn');
    if (emergencyBtn) {
        emergencyBtn.addEventListener('click', async function() {
            if (confirm('Are you sure you need emergency help? This will immediately alert your family members.')) {
                try {
                    const response = await fetch('/api/flag-event', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            message: 'EMERGENCY BUTTON PRESSED - NEED IMMEDIATE HELP',
                            source: 'emergency_button',
                            type: 'emergency'
                        })
                    });
                    
                    if (response.ok) {
                        alert('Emergency alert sent! Your family has been notified and will contact you immediately.');
                    } else {
                        alert('Error sending emergency alert. Please call for help directly.');
                    }
                } catch (error) {
                    alert('Network error. Please call for help directly.');
                    console.error('Error:', error);
                }
            }
        });
    }
});

// Dashboard Functions
async function loadAlerts() {
    try {
        const response = await fetch('/api/alerts');
        const alerts = await response.json();
        
        displayAlerts(alerts);
        updateStats();
    } catch (error) {
        console.error('Error loading alerts:', error);
    }
}

async function loadSafeContacts() {
    try {
        const response = await fetch('/api/safe-contacts');
        const contacts = await response.json();
        displaySafeContacts(contacts);
    } catch (error) {
        console.error('Error loading contacts:', error);
    }
}

async function updateStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        
        document.getElementById('pendingCount').textContent = stats.pendingAlerts;
        document.getElementById('emergencyCount').textContent = stats.emergencyAlerts;
        document.getElementById('safeContactsCount').textContent = stats.safeContactsCount;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function displayAlerts(alerts) {
    const container = document.getElementById('alertsContainer');
    
    if (alerts.length === 0) {
        container.innerHTML = '<div class="alert-item">No alerts at this time. Everything looks good!</div>';
        return;
    }
    
    container.innerHTML = alerts.map(alert => `
        <div class="alert-item ${alert.status === 'emergency' ? 'emergency' : ''}">
            <strong>${formatAlertType(alert.type)}</strong>
            <p>${alert.message || 'No message content'}</p>
            ${alert.keywords && alert.keywords.length > 0 ? 
                `<small>Keywords detected: ${alert.keywords.join(', ')}</small><br>` : ''}
            <small>From: ${alert.source} | ${new Date(alert.timestamp).toLocaleString()}</small>
            <div class="alert-actions">
                ${alert.status === 'pending' || alert.status === 'emergency' ? `
                    <button class="approve-btn" onclick="handleAlertAction(${alert.id}, 'approve')">I Approve</button>
                    <button class="block-btn" onclick="handleAlertAction(${alert.id}, 'block')">Block</button>
                ` : `<em>Resolved (${alert.resolvedAction})</em>`}
            </div>
        </div>
    `).join('');
}

function displaySafeContacts(contacts) {
    const container = document.getElementById('safeContactsContainer');
    
    container.innerHTML = contacts.map(contact => `
        <div class="contact-item">
            <strong>${contact.name}</strong><br>
            ${contact.phone}
        </div>
    `).join('');
}

async function handleAlertAction(alertId, action) {
    try {
        const response = await fetch('/api/action-alert', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                alertId: alertId,
                action: action
            })
        });
        
        if (response.ok) {
            loadAlerts(); // Refresh the alerts list
            updateStats(); // Refresh stats
        } else {
            alert('Error processing action. Please try again.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Network error. Please try again.');
    }
}

function formatAlertType(type) {
    const types = {
        'message': '📨 Suspicious Message',
        'emergency': '🚨 EMERGENCY',
        'call': '📞 Suspicious Call'
    };
    return types[type] || type;
}

// Auto-load dashboard data if on dashboard page
if (window.location.pathname === '/dashboard') {
    document.addEventListener('DOMContentLoaded', function() {
        loadAlerts();
        loadSafeContacts();
        updateStats();
        // Refresh alerts every 30 seconds
        setInterval(loadAlerts, 30000);
    });
}