const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const Food = require('./models/Food');
const Plan = require('./models/Plan');
const User = require('./models/User');
const Log = require('./models/Log');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nutrisetu')
    .then(() => console.log('MongoDB connected successfully'))
    .catch((err) => console.log('MongoDB connection error:', err));

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Returns a Date set to midnight (00:00:00.000) of today in local time,
 * so that log queries are scoped to the current calendar day.
 */
function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Get profile to check onboarding status
app.get('/api/user', async (req, res) => {
    try {
        const user = await User.findOne();
        // BUG FIX #2: Explicitly return 404 when no user exists instead of
        // sending null, which caused frontend crashes on null.name access.
        if (!user) {
            return res.status(404).json({ error: 'No user profile found' });
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Server error fetching user' });
    }
});

// Save onboarding profile
app.post('/api/user', async (req, res) => {
    try {
        // BUG FIX #3: Validate required fields before hitting the database.
        const { name, age, gender, height, weight, targetWeight, activityLevel, goal, dietType } = req.body;
        if (!name || !age || !gender || !height || !weight || !targetWeight || !activityLevel || !goal || !dietType) {
            return res.status(400).json({ error: 'Missing required profile fields' });
        }
        if (!['veg', 'vegan', 'nonveg'].includes(dietType)) {
            return res.status(400).json({ error: 'dietType must be veg, vegan, or nonveg' });
        }
        if (typeof age !== 'number' || age < 1 || age > 130) {
            return res.status(400).json({ error: 'Invalid age value' });
        }
        if (typeof height !== 'number' || height < 50 || height > 300) {
            return res.status(400).json({ error: 'Invalid height value (cm)' });
        }
        if (typeof weight !== 'number' || weight < 10 || weight > 500) {
            return res.status(400).json({ error: 'Invalid weight value (kg)' });
        }

        await User.deleteMany({}); // clear prev for this single-user demo
        const newUser = new User(req.body);
        await newUser.save();
        res.status(201).json(newUser);
    } catch (err) {
        res.status(500).json({ error: 'Server error saving user profile' });
    }
});

// Update only diet type (no full re-onboarding required)
app.patch('/api/user/diet', async (req, res) => {
    try {
        const { dietType } = req.body;
        if (!['veg', 'vegan', 'nonveg'].includes(dietType)) {
            return res.status(400).json({ error: 'dietType must be veg, vegan, or nonveg' });
        }
        const user = await User.findOneAndUpdate({}, { dietType }, { new: true });
        if (!user) return res.status(404).json({ error: 'No user profile found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Server error updating diet type' });
    }
});

// Clear profile (reset onboarding)
app.delete('/api/user', async (req, res) => {
    try {
        await User.deleteMany({});
        await Log.deleteMany({});
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error wiping user data' });
    }
});

// Get food database for Food Log searching
app.get('/api/foods', async (req, res) => {
    try {
        const foods = await Food.find({});
        res.json(foods);
    } catch (err) {
        res.status(500).json({ error: 'Server error fetching foods' });
    }
});

// Food Logging
app.post('/api/logs', async (req, res) => {
    try {
        // BUG FIX #3: Validate log entry fields.
        const { foodId, foodName, calories, portions } = req.body;
        if (!foodName || calories === undefined || portions === undefined) {
            return res.status(400).json({ error: 'Missing required log fields: foodName, calories, portions' });
        }
        if (typeof portions !== 'number' || portions <= 0) {
            return res.status(400).json({ error: 'Portions must be a positive number' });
        }

        // Attach today's date so logs can be filtered by day
        const newLog = new Log({ ...req.body, date: new Date() });
        await newLog.save();
        res.status(201).json(newLog);
    } catch (err) {
        res.status(500).json({ error: 'Server error saving log' });
    }
});

// BUG FIX #1: Filter logs by today's date so the food log only shows
// today's entries and calorie totals are accurate per day.
app.get('/api/logs', async (req, res) => {
    try {
        const logs = await Log.find({ date: { $gte: startOfToday() } });
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: 'Server error fetching logs' });
    }
});

// Get daily calorie totals for last N days (for progress chart)
// Returns array: [{ date: "2026-04-20", total: 1820 }, ...]
app.get('/api/logs/history', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const since = new Date();
        since.setDate(since.getDate() - (days - 1));
        since.setHours(0, 0, 0, 0);

        const logs = await Log.find({ date: { $gte: since } });

        // Group by calendar date
        const grouped = {};
        logs.forEach(log => {
            const d = new Date(log.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            grouped[key] = (grouped[key] || 0) + log.calories;
        });

        res.json(grouped);
    } catch (err) {
        res.status(500).json({ error: 'Server error fetching log history' });
    }
});

app.delete('/api/logs/:id', async (req, res) => {
    try {
        const deleted = await Log.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Log entry not found' });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server error deleting log' });
    }
});

// BUG FIX #4: Handle listen errors (e.g. port already in use) instead of
// letting the process crash silently.
const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please free it or set a different PORT in .env`);
    } else {
        console.error('Server error:', err);
    }
    process.exit(1);
});
