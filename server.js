const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Set EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Data file paths
const DATA_DIR = path.join(__dirname, 'data');
const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json');
const SAFE_CONTACTS_FILE = path.join(DATA_DIR, 'safe-contacts.json');
const BLOCKED_CONTACTS_FILE = path.join(DATA_DIR, 'blocked-contacts.json');

// Initialize data files
function initializeDataFiles() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR);
    }

    const defaultData = {
        alerts: [],
        safeContacts: [
            { id: 1, name: "Dr. Smith", phone: "555-0101" },
            { id: 2, name: "Daughter Amy", phone: "555-0102" },
            { id: 3, name: "Pharmacy", phone: "555-0103" }
        ],
        blockedContacts: []
    };

    if (!fs.existsSync(ALERTS_FILE)) {
        fs.writeFileSync(ALERTS_FILE, JSON.stringify(defaultData.alerts, null, 2));
    }
    if (!fs.existsSync(SAFE_CONTACTS_FILE)) {
        fs.writeFileSync(SAFE_CONTACTS_FILE, JSON.stringify(defaultData.safeContacts, null, 2));
    }
    if (!fs.existsSync(BLOCKED_CONTACTS_FILE)) {
        fs.writeFileSync(BLOCKED_CONTACTS_FILE, JSON.stringify(defaultData.blockedContacts, null, 2));
    }
}

// Helper functions to read/write JSON files
function readJSONFile(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
        return [];
    }
}

function writeJSONFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error);
        return false;
    }
}

// Suspicious keywords for rule-based filter
const SUSPICIOUS_KEYWORDS = [
    'urgent', 'bank verification', 'lawsuit', 'wire money', 
    'prize winner', 'social security', 'account suspended',
    'verify your account', 'free gift', 'limited time'
];

function checkSuspiciousMessage(message) {
    const messageLower = message.toLowerCase();
    const foundKeywords = SUSPICIOUS_KEYWORDS.filter(keyword => 
        messageLower.includes(keyword)
    );
    return {
        isSuspicious: foundKeywords.length > 0,
        keywords: foundKeywords
    };
}

// PWA Routes - Serve Manifest and Icons
app.get('/manifest.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});

app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

app.get('/icons/:iconName', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'icons', req.params.iconName));
});

// Main Application Routes
app.get('/', (req, res) => {
    res.render('elderly-ui');
});

app.get('/dashboard', (req, res) => {
    res.render('family-dashboard');
});

app.get('/micro-lessons', (req, res) => {
    res.render('micro-lessons');
});

// API Routes
app.post('/api/flag-event', (req, res) => {
    const { message, source, type = 'message' } = req.body;
    
    const { isSuspicious, keywords } = checkSuspiciousMessage(message);
    
    if (isSuspicious || type === 'emergency') {
        const alerts = readJSONFile(ALERTS_FILE);
        const newAlert = {
            id: Date.now(), // Simple ID generation
            message,
            source,
            type,
            status: type === 'emergency' ? 'emergency' : 'pending',
            timestamp: new Date().toISOString(),
            keywords: isSuspicious ? keywords : []
        };
        
        alerts.unshift(newAlert); // Add to beginning
        writeJSONFile(ALERTS_FILE, alerts);
        
        res.json({
            status: 'alert_created',
            suspicious: isSuspicious,
            keywordsFound: keywords,
            alertType: type
        });
    } else {
        res.json({ status: 'ok', suspicious: false });
    }
});

app.get('/api/alerts', (req, res) => {
    const alerts = readJSONFile(ALERTS_FILE);
    res.json(alerts.slice(0, 20)); // Return latest 20 alerts
});

app.post('/api/action-alert', (req, res) => {
    const { alertId, action } = req.body; // action: 'approve' or 'block'
    
    const alerts = readJSONFile(ALERTS_FILE);
    const alertIndex = alerts.findIndex(alert => alert.id == alertId);
    
    if (alertIndex !== -1) {
        alerts[alertIndex].status = 'resolved';
        alerts[alertIndex].resolvedAction = action;
        alerts[alertIndex].resolvedAt = new Date().toISOString();
        
        // If blocking, add to blocked contacts
        if (action === 'block') {
            const blockedContacts = readJSONFile(BLOCKED_CONTACTS_FILE);
            const phoneMatch = (alerts[alertIndex].message || alerts[alertIndex].source || '').match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/);
            
            if (phoneMatch) {
                blockedContacts.push({
                    id: Date.now(),
                    phone: phoneMatch[0],
                    reason: 'Blocked by family member',
                    blockedAt: new Date().toISOString()
                });
                writeJSONFile(BLOCKED_CONTACTS_FILE, blockedContacts);
            }
        }
        
        writeJSONFile(ALERTS_FILE, alerts);
        res.json({ status: 'success', action });
    } else {
        res.status(404).json({ status: 'error', message: 'Alert not found' });
    }
});

app.get('/api/safe-contacts', (req, res) => {
    const safeContacts = readJSONFile(SAFE_CONTACTS_FILE);
    res.json(safeContacts);
});

app.get('/api/stats', (req, res) => {
    const alerts = readJSONFile(ALERTS_FILE);
    const pendingCount = alerts.filter(alert => alert.status === 'pending').length;
    const emergencyCount = alerts.filter(alert => alert.status === 'emergency').length;
    const safeContacts = readJSONFile(SAFE_CONTACTS_FILE);
    
    res.json({
        pendingAlerts: pendingCount,
        emergencyAlerts: emergencyCount,
        safeContactsCount: safeContacts.length
    });
});

// Initialize and start server
initializeDataFiles();

app.listen(PORT, () => {
    console.log(`🚀 Family Guardian server running at http://localhost:${PORT}`);
    console.log(`📱 Elderly Interface: http://localhost:${PORT}`);
    console.log(`👨‍👩‍👧‍👦 Family Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`📚 Micro Lessons: http://localhost:${PORT}/micro-lessons`);
    console.log(`📱 PWA Ready: App can be installed on mobile devices!`);
});