/* ═══════════════════════════════════════════════════
   NutriSetu — app.js
   Diet type (veg / vegan / non-veg) filters every
   meal recommendation, food log dropdown, and recipe.
═══════════════════════════════════════════════════ */

const API = 'http://localhost:5000/api';

// ── State ─────────────────────────────────────────
let currentUser  = null;
let allFoods     = [];   // full DB from server
let todayLogs    = [];
let calorieChart = null;
let barChart     = null;
let lineChart    = null;

// ── Diet type config ──────────────────────────────
const DIET_CONFIG = {
    veg: {
        label:      'Vegetarian',
        icon:       '🥦',
        badgeClass: 'badge-veg',
        // which food `type` values are allowed
        allowed:    ['vegetarian', 'vegan'],
        color:      '#2D7A4A'
    },
    vegan: {
        label:      'Vegan',
        icon:       '🌱',
        badgeClass: 'badge-vegan',
        allowed:    ['vegan'],
        color:      '#388E3C'
    },
    nonveg: {
        label:      'Non-Vegetarian',
        icon:       '🍗',
        badgeClass: 'badge-non-veg',
        allowed:    ['vegetarian', 'vegan', 'non-vegetarian'],
        color:      '#B33A2A'
    }
};

/** Filter allFoods by the user's current diet type */
function getDietFoods() {
    const dt   = currentUser?.dietType || 'veg';
    const conf = DIET_CONFIG[dt];
    return allFoods.filter(f => conf.allowed.includes(f.type));
}

// ── Init ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    setupNav();
    setupChat();
    setTodayDate();

    try {
        const res = await fetch(`${API}/user`);
        if (res.ok) {
            currentUser = await res.json();
            showApp();
        } else {
            showOnboarding();
        }
    } catch {
        showOnboarding();
        showToast('Could not reach server — showing onboarding.', 'error');
    }
});

// ── Navigation ────────────────────────────────────
function setupNav() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            navigateTo(link.dataset.target);
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    document.getElementById('reset-onboarding').addEventListener('click', async () => {
        if (!confirm('Reset your profile? All data will be cleared.')) return;
        try {
            await fetch(`${API}/user`, { method: 'DELETE' });
            localStorage.removeItem('ns_daily_totals');
            localStorage.removeItem('ns_weight_history');
            location.reload();
        } catch {
            showToast('Error resetting profile.', 'error');
        }
    });

    document.getElementById('hamburger')?.addEventListener('click', () =>
        document.querySelector('.nav-links').classList.toggle('open'));
}

function navigateTo(sectionId) {
    document.querySelectorAll('.page-section').forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
    const target = document.getElementById(sectionId);
    if (target) { target.classList.remove('hidden'); target.classList.add('active'); }
    if (sectionId === 'dashboard-section') refreshDashboard();
    if (sectionId === 'food-log-section')  refreshFoodLog();
    if (sectionId === 'progress-section')  renderProgressCharts();
    if (sectionId === 'mealplan-section')  renderMealPlanSection();
}

function setTodayDate() {
    const el = document.getElementById('today-date');
    if (el) el.textContent = new Date().toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
}

// ── Show / Hide ───────────────────────────────────
function showOnboarding() {
    document.getElementById('main-nav').classList.add('hidden');
    document.getElementById('onboarding-section').classList.add('active');
    document.getElementById('onboarding-section').classList.remove('hidden');
}

function showApp() {
    document.getElementById('main-nav').classList.remove('hidden');
    document.getElementById('onboarding-section').classList.remove('active');
    document.getElementById('onboarding-section').classList.add('hidden');
    navigateTo('dashboard-section');
    loadFoods();
}

// ── Wizard ────────────────────────────────────────
function nextStep(stepNum) {
    // Validate step 1 before moving forward
    if (stepNum === 2) {
        const name   = document.getElementById('ob-name').value.trim();
        const age    = parseFloat(document.getElementById('ob-age').value);
        const height = parseFloat(document.getElementById('ob-height').value);
        const weight = parseFloat(document.getElementById('ob-weight').value);
        const target = parseFloat(document.getElementById('ob-target').value);
        if (!name)                                  return showToast('Please enter your name.');
        if (!age || age < 1 || age > 130)           return showToast('Please enter a valid age.');
        if (!height || height < 50 || height > 300) return showToast('Please enter a valid height (cm).');
        if (!weight || weight < 10 || weight > 500) return showToast('Please enter a valid weight (kg).');
        if (!target || target < 10 || target > 500) return showToast('Please enter a valid target weight.');
    }

    document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
    document.getElementById(`step-${stepNum}`)?.classList.add('active');

    // Update step dots (4 dots for 4 steps, step-5 is the results screen)
    const dotCount = document.querySelectorAll('.sdot').length;
    document.querySelectorAll('.sdot').forEach((dot, i) => {
        dot.classList.toggle('active', i < Math.min(stepNum, dotCount));
    });
}

function calculatePlan() {
    const age    = parseFloat(document.getElementById('ob-age').value);
    const gender = document.getElementById('ob-gender').value;
    const height = parseFloat(document.getElementById('ob-height').value);
    const weight = parseFloat(document.getElementById('ob-weight').value);

    const bmr = gender === 'male'
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161;

    const multipliers = { sedentary: 1.2, lightly: 1.375, moderately: 1.55, very: 1.725, extra: 1.9 };
    const activity  = document.querySelector('input[name="activity"]:checked').value;
    const goal      = document.querySelector('input[name="goal"]:checked').value;
    const dietType  = document.querySelector('input[name="dietType"]:checked').value;

    const tdee = Math.round(bmr * (multipliers[activity] || 1.2));
    let calorieTarget = tdee;
    if (goal === 'loss') calorieTarget -= 500;
    if (goal === 'gain') calorieTarget += 500;
    calorieTarget = Math.round(calorieTarget);

    document.getElementById('res-calories').textContent = calorieTarget;
    document.getElementById('split-bk').textContent = Math.round(calorieTarget * 0.25) + ' kcal';
    document.getElementById('split-lu').textContent = Math.round(calorieTarget * 0.35) + ' kcal';
    document.getElementById('split-di').textContent = Math.round(calorieTarget * 0.30) + ' kcal';
    document.getElementById('split-sn').textContent = Math.round(calorieTarget * 0.10) + ' kcal';

    // Show diet badge on results screen
    const conf = DIET_CONFIG[dietType];
    const badge = document.getElementById('result-diet-badge');
    if (badge) badge.innerHTML = `<span class="diet-badge-pill ${conf.badgeClass}">${conf.icon} ${conf.label} Plan</span>`;

    window._calculatedPlan = { tdee, calorieTarget, goal, activity, dietType };
    nextStep(5);
}

async function finishOnboarding() {
    const plan = window._calculatedPlan || {};
    const payload = {
        name:          document.getElementById('ob-name').value.trim(),
        age:           parseFloat(document.getElementById('ob-age').value),
        gender:        document.getElementById('ob-gender').value,
        height:        parseFloat(document.getElementById('ob-height').value),
        weight:        parseFloat(document.getElementById('ob-weight').value),
        targetWeight:  parseFloat(document.getElementById('ob-target').value),
        activityLevel: plan.activity  || 'sedentary',
        goal:          plan.goal      || 'maintenance',
        dietType:      plan.dietType  || 'veg',
        tdee:          plan.tdee      || 2000,
        calorieTarget: plan.calorieTarget || 2000,
        createdAt:     new Date().toISOString()
    };

    try {
        const res = await fetch(`${API}/user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const err = await res.json();
            return showToast(err.error || 'Error saving profile.', 'error');
        }
        currentUser = await res.json();

        // Seed starting weight
        const wh = JSON.parse(localStorage.getItem('ns_weight_history') || '{}');
        wh[todayDateKey()] = currentUser.weight;
        localStorage.setItem('ns_weight_history', JSON.stringify(wh));

        showToast(`Welcome, ${currentUser.name.split(' ')[0]}! 🌿`);
        showApp();
    } catch {
        showToast('Server error. Make sure the backend is running.', 'error');
    }
}

// ── Diet Badge Helpers ────────────────────────────
function getDietBadgeHTML(dietType, size = 'sm') {
    const conf = DIET_CONFIG[dietType] || DIET_CONFIG.veg;
    return `<span class="diet-badge-pill ${conf.badgeClass} size-${size}">${conf.icon} ${conf.label}</span>`;
}

// ── Dashboard ─────────────────────────────────────
async function refreshDashboard() {
    if (!currentUser) return;

    const name = currentUser.name || 'User';
    document.getElementById('dash-greeting').textContent = `Hello, ${name.split(' ')[0]} 👋`;
    document.getElementById('sum-name').textContent    = name;
    document.getElementById('sum-weight').textContent  = currentUser.weight;
    document.getElementById('sum-target').textContent  = currentUser.targetWeight;

    const goalMap = { loss: 'Weight Loss', gain: 'Weight Gain', maintenance: 'Maintenance' };
    document.getElementById('sum-goal').textContent = goalMap[currentUser.goal] || currentUser.goal;

    // Diet type in profile card
    const conf = DIET_CONFIG[currentUser.dietType] || DIET_CONFIG.veg;
    document.getElementById('sum-diet').innerHTML = getDietBadgeHTML(currentUser.dietType);

    // Diet badge in page header
    const wrap = document.getElementById('diet-badge-wrap');
    if (wrap) wrap.innerHTML = `
        ${getDietBadgeHTML(currentUser.dietType, 'md')}
        <button class="diet-change-btn" onclick="openDietModal()">Change</button>`;

    // Meal plan label
    const mlabel = document.getElementById('meal-diet-label');
    if (mlabel) mlabel.innerHTML = getDietBadgeHTML(currentUser.dietType);

    const bmi = (currentUser.weight / Math.pow(currentUser.height / 100, 2)).toFixed(1);
    document.getElementById('sum-bmi').textContent  = bmi;
    document.getElementById('stat-bmi').textContent = bmi;

    if (currentUser.createdAt) {
        const days = Math.max(1, Math.floor((Date.now() - new Date(currentUser.createdAt)) / 86400000) + 1);
        document.getElementById('stat-days-active').textContent = days;
    }

    try {
        const res = await fetch(`${API}/logs`);
        todayLogs = res.ok ? await res.json() : [];
    } catch { todayLogs = []; }

    const consumed  = todayLogs.reduce((s, l) => s + (l.calories || 0), 0);
    const target    = currentUser.calorieTarget || 2000;
    const remaining = Math.max(0, target - consumed);

    document.getElementById('dash-remaining').textContent  = remaining;
    document.getElementById('dash-consumed').textContent   = consumed;
    document.getElementById('dash-target-lbl').textContent = target;
    document.getElementById('stat-logs-today').textContent = todayLogs.length;

    persistTodayCalories(consumed);
    renderCalorieDonut(consumed, remaining, target);
}

function renderCalorieDonut(consumed, remaining, target) {
    const canvas = document.getElementById('calorieDonutChart');
    if (!canvas) return;
    if (calorieChart) { calorieChart.destroy(); calorieChart = null; }
    calorieChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [consumed, Math.max(0, target - consumed)],
                backgroundColor: [consumed > target ? '#C4694A' : '#6AAF8B', '#EDE5D4'],
                borderWidth: 0,
                borderRadius: 6
            }]
        },
        options: {
            cutout: '72%',
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            animation: { animateRotate: true, duration: 600 }
        }
    });
}

// (Meal tabs removed — meals now render as stacked slots with 3 choices each)

/**
 * Pick `count` diverse foods from `pool` that fit within `allowance` calories.
 * Diversity is enforced by grouping on the first meaningful word of the food name
 * (e.g. "Idli", "Dosa", "Paratha") and picking at most one item per group.
 * The pool is shuffled first so results vary on each page load.
 */
function pickDiverseFoods(pool, allowance, count) {
    const eligible = pool.filter(f => f.calories <= allowance);
    // Fisher-Yates shuffle so we don't always get the first DB entries
    for (let i = eligible.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
    }
    const usedGroups = new Set();
    const picks = [];
    for (const f of eligible) {
        if (picks.length >= count) break;
        // Group key: first word of food name, lower-cased
        const group = f.name.split(/[\s(]/)[0].toLowerCase();
        if (!usedGroups.has(group)) {
            usedGroups.add(group);
            picks.push(f);
        }
    }
    // If strict diversity left us short, fill remaining slots without the group rule
    if (picks.length < count) {
        for (const f of eligible) {
            if (picks.length >= count) break;
            if (!picks.includes(f)) picks.push(f);
        }
    }
    return picks;
}

/**
 * Render the Today's Meal Plan section.
 * Each meal slot (Breakfast, Lunch, Dinner, Snacks) shows exactly 3 diverse
 * food choices. The user picks one and taps "I Ate This" to log it instantly.
 * Already-logged meals show a ✓ Logged badge and their button is disabled.
 */
// ── Enhanced Meal Plan State ───────────────────────
// Frozen picks per slot so regeneration only clears unlogged slots
const _slotPicks = { bk: null, lu: null, di: null, sn: null };

const SLOT_CONFIG = [
    { key: 'bk', cat: 'Breakfast', pct: 0.25 },
    { key: 'lu', cat: 'Lunch',     pct: 0.35 },
    { key: 'di', cat: 'Dinner',    pct: 0.30 },
    { key: 'sn', cat: 'Snacks',    pct: 0.10 },
];

/**
 * Build a gap tag HTML snippet comparing logged vs target calories.
 */
function _gapTagHTML(cal, allowance) {
    const d = allowance - cal, a = Math.abs(d);
    if (a <= allowance * 0.10) return `<span class="slot-gap-tag gap-ok">✓ On target</span>`;
    if (d > 0)                 return `<span class="slot-gap-tag gap-short">${d} kcal under</span>`;
    return                            `<span class="slot-gap-tag gap-over">${a} kcal over</span>`;
}

/**
 * Enhanced renderMealRecommendations — integrates the richer UI from
 * today's meal plan: descriptions, fat macro, match badges, slot border
 * highlight on log, frozen picks to prevent reshuffling.
 */
async function renderMealRecommendations() {
    if (!allFoods.length) await loadFoods();
    if (!currentUser) return;

    const target     = currentUser.calorieTarget || 2000;
    const dietFoods  = getDietFoods();
    const loggedNames = new Set(todayLogs.map(l => l.foodName));

    // Update calorie chips
    updateMealChips();

    for (const slot of SLOT_CONFIG) {
        const { key, cat, pct } = slot;
        const allowance = Math.round(target * pct);

        const calEl = document.getElementById(`meal-cal-${key}`);
        if (calEl) calEl.textContent = allowance;

        const pool   = dietFoods.filter(f => f.category === cat);
        const recEl  = document.getElementById(`rec-${key}`);
        const statusEl = document.getElementById(`status-${key}`);
        const slotEl = document.getElementById(`slot-${key}`);
        if (!recEl) continue;

        if (!pool.length) {
            recEl.innerHTML = `<p style="padding:1rem;color:var(--text-muted);font-size:0.85rem;">No ${cat.toLowerCase()} items for your diet.</p>`;
            continue;
        }

        // Freeze picks per slot — only regenerate if nothing in slot is logged
        if (!_slotPicks[key]) {
            _slotPicks[key] = pickDiverseFoods(pool, allowance, 3);
        }
        const picks = _slotPicks[key];

        const slotLogged = picks.some(f => loggedNames.has(f.name));
        const loggedFood = picks.find(f => loggedNames.has(f.name));

        // Status pill
        if (statusEl) {
            statusEl.textContent = slotLogged ? '✓ Logged' : 'Not logged';
            statusEl.className   = 'meal-slot-status ' + (slotLogged ? 'logged' : 'not-logged');
        }
        // Slot border
        if (slotEl) slotEl.classList.toggle('slot-logged', slotLogged);

        // Gap tag next to slot title
        if (slotLogged && loggedFood) {
            const existingTag = document.querySelector(`#slot-${key} .slot-gap-tag`);
            if (!existingTag) {
                const infoEl = document.querySelector(`#slot-${key} .meal-slot-kcal`);
                if (infoEl) infoEl.insertAdjacentHTML('beforeend', _gapTagHTML(loggedFood.calories, allowance));
            }
        }

        recEl.innerHTML = picks.map((f, i) => {
            const isLogged   = loggedNames.has(f.name);
            const badgeClass = f.type === 'vegan' ? 'badge-vegan' : f.type === 'vegetarian' ? 'badge-veg' : 'badge-non-veg';
            const badgeLabel = f.type === 'vegan' ? 'Vegan' : f.type === 'vegetarian' ? 'Veg' : 'Non-Veg';
            const safeId     = f._id;
            const safeName   = f.name.replace(/'/g, "\\'");
            const fat        = f.fat || 0;

            // Match badge (only for unlogged items)
            let matchBadge = '';
            if (!isLogged) {
                const diff   = f.calories - allowance;
                const pctOff = Math.abs(diff) / allowance;
                if (pctOff <= 0.10)
                    matchBadge = `<span class="choice-match-badge match-best">⭐ Best match</span>`;
                else if (pctOff <= 0.25)
                    matchBadge = `<span class="choice-match-badge match-close">${diff > 0 ? '+' : ''}${diff} kcal</span>`;
                else
                    matchBadge = `<span class="choice-match-badge match-low">${diff > 0 ? '+' : ''}${diff} kcal vs target</span>`;
            }

            const isBest = (i === 0 && !isLogged);

            return `
            <div class="choice-card ${isLogged ? 'ate' : ''} ${isBest ? 'best-match' : ''}" id="choice-${safeId}">
                <div class="choice-num">${isLogged ? '✓' : i + 1}</div>
                <div class="choice-body">
                    <div class="choice-name">${f.name}</div>
                    ${f.description ? `<div class="choice-desc">${f.description}</div>` : ''}
                    <div class="choice-meta">
                        <span class="choice-kcal">${f.calories} kcal</span>
                        <span class="choice-macro">${f.protein}g protein · ${f.carbs}g carbs${fat ? ' · ' + fat + 'g fat' : ''}</span>
                        <span class="rec-item-badge ${badgeClass}">${badgeLabel}</span>
                        ${matchBadge}
                    </div>
                </div>
                <button
                    class="choice-ate-btn ${isLogged ? 'logged' : ''}"
                    ${isLogged ? 'disabled' : ''}
                    ${slotLogged && !isLogged ? 'disabled' : ''}
                    onclick="logMealChoice('${safeId}', '${safeName}', ${f.calories}, '${f.type}', '${key}', ${f.protein || 0}, ${f.carbs || 0}, ${fat})">
                    ${isLogged ? '✓ Logged' : 'I Ate This'}
                </button>
            </div>`;
        }).join('');
    }

    updateMealNudge();
}

/**
 * Update the calorie summary chips above the meal slots.
 */
function updateMealChips() {
    if (!currentUser) return;
    const target    = currentUser.calorieTarget || 2000;
    const consumed  = todayLogs.reduce((s, l) => s + (l.calories || 0), 0);
    const remaining = Math.max(0, target - consumed);
    const pct       = Math.min(100, Math.round(consumed / target * 100));

    const chipTarget = document.getElementById('chip-target');
    const chipCons   = document.getElementById('chip-consumed');
    const chipRem    = document.getElementById('chip-remaining');
    const chipMeals  = document.getElementById('chip-meals');
    const progFill   = document.getElementById('chip-prog-fill');

    if (chipTarget)  chipTarget.textContent = target;
    if (chipCons)    chipCons.textContent   = consumed;
    if (chipRem)     chipRem.textContent    = remaining;
    if (progFill) {
        progFill.style.width = pct + '%';
        progFill.classList.toggle('over', consumed > target);
    }

    // Count logged slots
    const loggedNames = new Set(todayLogs.map(l => l.foodName));
    let loggedSlots = 0;
    for (const s of SLOT_CONFIG) {
        if (_slotPicks[s.key]?.some(f => loggedNames.has(f.name))) loggedSlots++;
    }
    if (chipMeals) chipMeals.textContent = `${loggedSlots} / 4`;

    // Macro bars
    const tp = todayLogs.reduce((s, l) => s + (l.protein || 0), 0);
    const tc = todayLogs.reduce((s, l) => s + (l.carbs   || 0), 0);
    const tf = todayLogs.reduce((s, l) => s + (l.fat     || 0), 0);
    const gp = Math.round(target * 0.0375);
    const gc = Math.round(target * 0.0625);
    const gf = Math.round(target * 0.0167);

    const pv = document.getElementById('macro-prot-val');
    const cv = document.getElementById('macro-carb-val');
    const fv = document.getElementById('macro-fat-val');
    const pf = document.getElementById('macro-prot-fill');
    const cf = document.getElementById('macro-carb-fill');
    const ff = document.getElementById('macro-fat-fill');

    if (pv) pv.textContent = `${tp}g / ~${gp}g`;
    if (cv) cv.textContent = `${tc}g / ~${gc}g`;
    if (fv) fv.textContent = `${tf}g / ~${gf}g`;
    if (pf) pf.style.width = Math.min(100, Math.round(tp / gp * 100)) + '%';
    if (cf) cf.style.width = Math.min(100, Math.round(tc / gc * 100)) + '%';
    if (ff) ff.style.width = Math.min(100, Math.round(tf / gf * 100)) + '%';
}

/**
 * Smart nudge — tells the user how many kcal remain and which meals to log.
 */
function updateMealNudge() {
    const nudge    = document.getElementById('meal-nudge');
    const nudgeTxt = document.getElementById('meal-nudge-txt');
    if (!nudge || !nudgeTxt || !currentUser) return;

    const target    = currentUser.calorieTarget || 2000;
    const consumed  = todayLogs.reduce((s, l) => s + (l.calories || 0), 0);
    const short     = target - consumed;

    if (consumed >= target) {
        nudge.classList.add('hidden');
        return;
    }

    nudge.classList.remove('hidden');
    const loggedNames = new Set(todayLogs.map(l => l.foodName));
    const unlogged = SLOT_CONFIG.filter(s => !_slotPicks[s.key]?.some(f => loggedNames.has(f.name)));

    if (!unlogged.length) {
        nudgeTxt.innerHTML = `All meals logged! Still <strong>${short} kcal short</strong> of your target — consider an extra snack.`;
    } else {
        const slotNames = unlogged.map(s => s.cat).join(', ');
        nudgeTxt.innerHTML = `Need <strong>${short} more kcal</strong> today. Log your <strong>${slotNames}</strong> — each option is matched to cover that slot's target.`;
    }
}

/**
 * Regenerate suggestions for unlogged slots only.
 */
function regenerateMealSuggestions() {
    const loggedNames = new Set(todayLogs.map(l => l.foodName));
    for (const s of SLOT_CONFIG) {
        if (!_slotPicks[s.key]?.some(f => loggedNames.has(f.name))) {
            _slotPicks[s.key] = null; // clear so next render re-picks
        }
    }
    renderMealRecommendations();
    showToast('Fresh suggestions ready ✓');
}

/**
 * Log a meal plan choice — enhanced to track protein/carbs/fat in log entries.
 */
async function logMealChoice(foodId, foodName, calories, type, slotKey, protein = 0, carbs = 0, fat = 0) {
    try {
        const res = await fetch(`${API}/logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ foodId, foodName, calories, portions: 1, type })
        });
        if (!res.ok) {
            showToast((await res.json()).error || 'Error logging food.', 'error');
            return;
        }
        const newLog = await res.json();
        // Attach macros to in-memory log for chips/macro bars
        newLog.protein = protein;
        newLog.carbs   = carbs;
        newLog.fat     = fat;
        todayLogs.push(newLog);
        persistTodayCalories(todayLogs.reduce((s, l) => s + (l.calories || 0), 0));
        showToast(`Logged ${foodName} ✓`);

        // Update slot status pill
        const statusEl = document.getElementById(`status-${slotKey}`);
        if (statusEl) { statusEl.textContent = '✓ Logged'; statusEl.className = 'meal-slot-status logged'; }

        // Add slot-logged border
        const slotEl = document.getElementById(`slot-${slotKey}`);
        if (slotEl) slotEl.classList.add('slot-logged');

        // Add gap tag to slot header
        const infoEl = document.querySelector(`#slot-${slotKey} .meal-slot-kcal`);
        if (infoEl && !document.querySelector(`#slot-${slotKey} .slot-gap-tag`)) {
            const target    = currentUser?.calorieTarget || 2000;
            const slotConf  = SLOT_CONFIG.find(s => s.key === slotKey);
            const allowance = Math.round(target * (slotConf?.pct || 0.25));
            infoEl.insertAdjacentHTML('beforeend', _gapTagHTML(calories, allowance));
        }

        // Disable all buttons in this slot
        document.querySelectorAll(`#rec-${slotKey} .choice-ate-btn`).forEach(btn => {
            btn.disabled = true;
            btn.classList.add('logged');
        });

        // Highlight the tapped card
        const card = document.getElementById(`choice-${foodId}`);
        if (card) {
            card.classList.add('ate');
            card.classList.remove('best-match');
            const num = card.querySelector('.choice-num');
            if (num) num.textContent = '✓';
        }
        const ateBtn = card?.querySelector('.choice-ate-btn');
        if (ateBtn) ateBtn.textContent = '✓ Logged';

        // Update chips, macros, nudge without full re-render
        updateMealChips();
        updateMealNudge();

        // Refresh dashboard donut + food log list
        if (document.getElementById('dashboard-section').classList.contains('active')) refreshDashboard();
        refreshFoodLog();
    } catch {
        showToast('Server error. Please try again.', 'error');
    }
}

// ── Food Log ──────────────────────────────────────
async function loadFoods() {
    try {
        const res = await fetch(`${API}/foods`);
        if (res.ok) allFoods = await res.json();
    } catch {
        showToast('Could not load food database.', 'error');
    }
}

async function refreshFoodLog() {
    try {
        const res = await fetch(`${API}/logs`);
        todayLogs = res.ok ? await res.json() : [];
    } catch { todayLogs = []; }

    if (!allFoods.length) await loadFoods();

    renderLogList();
    document.getElementById('log-total-cal').textContent =
        todayLogs.reduce((s, l) => s + (l.calories || 0), 0);
}

function renderLogList() {
    const ul = document.getElementById('food-log-ul');
    if (!ul) return;
    if (!todayLogs.length) {
        ul.innerHTML = '<li class="log-empty">No food logged yet today.</li>';
        return;
    }
    ul.innerHTML = todayLogs.map(log => `
        <li class="log-entry">
            <div class="log-entry-info">
                <div class="log-entry-name">${log.foodName}</div>
                <div class="log-entry-meta">×${log.portions} portion${log.portions !== 1 ? 's' : ''}</div>
            </div>
            <span class="log-entry-cal">${log.calories} kcal</span>
            <button class="log-del-btn" onclick="deleteLog('${log._id}')" title="Remove">×</button>
        </li>`).join('');
}

async function deleteLog(id) {
    try {
        const res = await fetch(`${API}/logs/${id}`, { method: 'DELETE' });
        if (!res.ok) return showToast('Error removing entry.', 'error');
        todayLogs = todayLogs.filter(l => l._id !== id);
        renderLogList();
        const newTotal = todayLogs.reduce((s, l) => s + (l.calories || 0), 0);
        document.getElementById('log-total-cal').textContent = newTotal;
        persistTodayCalories(newTotal);
        showToast('Entry removed.');

        // Refresh meal plan UI state after removal
        const loggedNames = new Set(todayLogs.map(l => l.foodName));
        for (const s of SLOT_CONFIG) {
            const picks = _slotPicks[s.key] || [];
            const stillLogged = picks.some(f => loggedNames.has(f.name));
            if (!stillLogged) {
                // Un-log the slot
                const statusEl = document.getElementById(`status-${s.key}`);
                if (statusEl) { statusEl.textContent = 'Not logged'; statusEl.className = 'meal-slot-status not-logged'; }
                const slotEl = document.getElementById(`slot-${s.key}`);
                if (slotEl) {
                    slotEl.classList.remove('slot-logged');
                    slotEl.querySelectorAll('.slot-gap-tag').forEach(el => el.remove());
                }
                // Re-enable buttons for picks that are no longer logged
                picks.forEach((f, i) => {
                    if (!loggedNames.has(f.name)) {
                        const btn = document.getElementById(`choice-${f._id}`)?.querySelector('.choice-ate-btn');
                        if (btn) { btn.disabled = false; btn.textContent = 'I Ate This'; btn.classList.remove('logged'); }
                        const card = document.getElementById(`choice-${f._id}`);
                        if (card) {
                            card.classList.remove('ate');
                            const num = card.querySelector('.choice-num');
                            if (num) num.textContent = i + 1;
                        }
                    }
                });
            }
        }
        updateMealChips();
        updateMealNudge();
    } catch {
        showToast('Error removing entry.', 'error');
    }
}

// ── Diet Change Modal ─────────────────────────────
function openDietModal() {
    const modal = document.getElementById('diet-modal');
    modal.classList.remove('hidden');
    // Pre-select current diet in modal
    const current = currentUser?.dietType || 'veg';
    document.querySelectorAll('input[name="dietTypeModal"]').forEach(r => {
        r.checked = r.value === current;
        r.closest('.diet-card')?.querySelector('.diet-inner')
            ?.classList.toggle('selected-diet', r.checked);
    });
}

function closeDietModal() {
    document.getElementById('diet-modal').classList.add('hidden');
}

async function saveDietChange() {
    const selected = document.querySelector('input[name="dietTypeModal"]:checked');
    if (!selected) return showToast('Please select a diet type.');
    const newDiet = selected.value;

    if (newDiet === currentUser?.dietType) {
        closeDietModal();
        return;
    }

    try {
        const res = await fetch(`${API}/user/diet`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dietType: newDiet })
        });
        if (!res.ok) return showToast('Error updating diet preference.', 'error');

        currentUser = await res.json();
        closeDietModal();

        const conf = DIET_CONFIG[newDiet];
        showToast(`Diet updated to ${conf.icon} ${conf.label}!`);

        // Refresh everything that depends on diet type
        refreshDashboard();
        if (document.getElementById('food-log-section').classList.contains('active')) refreshFoodLog();
    } catch {
        showToast('Server error updating diet.', 'error');
    }
}

// Close modal on overlay click
document.addEventListener('click', e => {
    if (e.target.id === 'diet-modal') closeDietModal();
});

// ── Progress Charts (real data only) ─────────────
function todayDateKey() {
    const d = new Date();
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function daysAgoKey(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function shortLabel(key) {
    const p = key.split('/');
    return `${p[0]}/${p[1]}`;
}

function persistTodayCalories(total) {
    const stored = JSON.parse(localStorage.getItem('ns_daily_totals') || '{}');
    stored[todayDateKey()] = total;
    localStorage.setItem('ns_daily_totals', JSON.stringify(stored));
}

function showChartEmpty(canvas, msg) {
    canvas.style.display = 'none';
    const wrap = canvas.parentElement;
    let el = wrap.querySelector('.chart-empty');
    if (!el) {
        el = document.createElement('p');
        el.className = 'chart-empty';
        el.style.cssText = 'text-align:center;color:var(--text-muted);font-size:.875rem;padding:3rem 1rem;line-height:1.6;';
        wrap.appendChild(el);
    }
    el.textContent = msg;
}

function hideChartEmpty(canvas) {
    canvas.style.display = '';
    canvas.parentElement.querySelector('.chart-empty')?.remove();
}

async function renderProgressCharts() {
    if (!currentUser) return;

    const bmi = (currentUser.weight / Math.pow(currentUser.height / 100, 2)).toFixed(1);
    const bmiEl = document.getElementById('bstat-bmi');
    if (bmiEl) bmiEl.textContent = bmi;

    if (currentUser.createdAt) {
        const days = Math.max(1, Math.floor((Date.now() - new Date(currentUser.createdAt)) / 86400000) + 1);
        const d = document.getElementById('bstat-days');
        if (d) d.textContent = days;
    }

    // Goal ring
    const diff = Math.abs(currentUser.weight - currentUser.targetWeight);
    const pct  = diff === 0 ? 100 : Math.min(100, Math.round((1 - diff / Math.max(currentUser.weight, currentUser.targetWeight)) * 100));
    document.getElementById('goal-progress-path')?.setAttribute('stroke-dasharray', `${pct}, 100`);
    const gpEl = document.getElementById('goal-percent-text');
    if (gpEl) gpEl.textContent = pct + '%';
    const etaEl = document.getElementById('goal-eta-text');
    if (etaEl) etaEl.textContent = diff === 0 ? 'Goal reached! 🎉' : `~${Math.ceil(diff / 0.5)} weeks to reach goal`;

    // Calorie bar chart — real data only
    const barCtx = document.getElementById('calorieBarChart');
    if (barCtx) {
        if (barChart) { barChart.destroy(); barChart = null; }
        const stored  = JSON.parse(localStorage.getItem('ns_daily_totals') || '{}');
        const labels  = [];
        const calData = [];
        for (let i = 6; i >= 0; i--) {
            const key = daysAgoKey(i);
            labels.push(shortLabel(key));
            calData.push(stored[key] || 0);
        }
        if (!calData.some(v => v > 0)) {
            showChartEmpty(barCtx, '📊 No calorie history yet. Start logging food today and your 7-day chart will appear here automatically.');
        } else {
            hideChartEmpty(barCtx);
            const t = currentUser.calorieTarget || 2000;
            barChart = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        { label: 'Calories', data: calData, backgroundColor: calData.map(v => v === 0 ? '#EDE5D4' : v > t ? '#C4694A' : '#6AAF8B'), borderRadius: 6, borderSkipped: false },
                        { label: 'Target', data: labels.map(() => t), type: 'line', borderColor: '#E8A44A', borderWidth: 2, borderDash: [5,4], pointRadius: 0, tension: 0, fill: false }
                    ]
                },
                options: {
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 11 } } },
                        y: { grid: { color: '#EDE5D4' }, beginAtZero: true, ticks: { font: { family: 'DM Sans', size: 11 } } }
                    }
                }
            });
        }
    }

    // Weight line chart — real data only
    const lineCtx = document.getElementById('weightLineChart');
    if (lineCtx) {
        if (lineChart) { lineChart.destroy(); lineChart = null; }
        const wh = JSON.parse(localStorage.getItem('ns_weight_history') || '{}');
        if (currentUser.createdAt) {
            const cd = new Date(currentUser.createdAt);
            const ck = `${cd.getDate()}/${cd.getMonth() + 1}/${cd.getFullYear()}`;
            if (!wh[ck]) { wh[ck] = currentUser.weight; localStorage.setItem('ns_weight_history', JSON.stringify(wh)); }
        }
        const entries = Object.entries(wh).sort((a, b) => {
            const [ad, am, ay] = a[0].split('/').map(Number);
            const [bd, bm, by] = b[0].split('/').map(Number);
            return new Date(ay, am - 1, ad) - new Date(by, bm - 1, bd);
        });
        if (entries.length < 2) {
            showChartEmpty(lineCtx, `📉 Starting weight (${currentUser.weight} kg) recorded. Log your weight daily to see your trend.`);
            const wrap = lineCtx.parentElement;
            if (!wrap.querySelector('.weight-log-btn')) {
                const btn = document.createElement('button');
                btn.className = 'btn-primary weight-log-btn';
                btn.style.cssText = 'margin:.75rem auto 0;display:block;font-size:.8rem;padding:.5rem 1.25rem;';
                btn.textContent = '⚖️ Log Today\'s Weight';
                btn.onclick = logWeight;
                wrap.appendChild(btn);
            }
        } else {
            hideChartEmpty(lineCtx);
            lineCtx.parentElement.querySelector('.weight-log-btn')?.remove();
            lineChart = new Chart(lineCtx, {
                type: 'line',
                data: {
                    labels: entries.map(e => shortLabel(e[0])),
                    datasets: [
                        { label: 'Weight (kg)', data: entries.map(e => e[1]), borderColor: '#3D6B5A', backgroundColor: 'rgba(61,107,90,0.08)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#3D6B5A', pointHoverRadius: 6 },
                        { label: 'Target', data: entries.map(() => currentUser.targetWeight), borderColor: '#E8A44A', borderWidth: 2, borderDash: [5,4], pointRadius: 0, tension: 0, fill: false }
                    ]
                },
                options: {
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 11 } } },
                        y: { grid: { color: '#EDE5D4' }, ticks: { font: { family: 'DM Sans', size: 11 } } }
                    }
                }
            });
        }
    }
}

function logWeight() {
    const val = parseFloat(prompt('Enter your current weight (kg):'));
    if (!val || val < 10 || val > 500) return showToast('Invalid weight entered.', 'error');
    const wh = JSON.parse(localStorage.getItem('ns_weight_history') || '{}');
    wh[todayDateKey()] = val;
    localStorage.setItem('ns_weight_history', JSON.stringify(wh));
    showToast(`Weight ${val} kg logged ✓`);
    renderProgressCharts();
}

// ── Recipe Generator ──────────────────────────────
// Diet-aware recipe database
const RECIPE_DB = [
    // VEGAN
    { name: "Masoor Dal",              diet: "vegan",  category: "Dinner",    cal: 190, time: "20 min", ingredients: ["masoor","lentil","red lentil","garlic","tomato"],           steps: "Pressure cook masoor dal 2 whistles. Tadka: ghee, cumin, garlic, dry red chilli, chopped tomato. Mix into dal.", tags: ["Vegan","Budget-Friendly"] },
    { name: "Rajma Chawal",            diet: "vegan",  category: "Lunch",     cal: 430, time: "40 min", ingredients: ["rajma","kidney beans","rice","tomato","onion"],              steps: "Soak rajma overnight, pressure cook. Make tomato-onion masala. Combine, simmer 10 min. Serve with rice.", tags: ["Vegan","High Protein"] },
    { name: "Veggie Upma",             diet: "vegan",  category: "Breakfast", cal: 200, time: "15 min", ingredients: ["semolina","rava","onion","carrot","peas"],                  steps: "Dry roast semolina. Sauté mustard seeds, curry leaves, onions, veg. Add water, stir in semolina. Cook 5 min.", tags: ["Vegan","Budget-Friendly"] },
    { name: "Moong Dal Chilla",        diet: "vegan",  category: "Breakfast", cal: 195, time: "20 min", ingredients: ["moong","moong dal","onion","coriander","chilli"],            steps: "Soak moong 2h, grind to batter. Add onion, chilli, coriander. Spread thin crepes, cook each side 2-3 min.", tags: ["Vegan","High Protein"] },
    { name: "Oats Poha",               diet: "vegan",  category: "Breakfast", cal: 210, time: "15 min", ingredients: ["oats","onion","peanut","peas"],                             steps: "Dry roast oats 3 min. Sauté mustard, curry leaves, onions. Add oats, peas, peanuts. Season with lemon.", tags: ["Vegan","High Fibre"] },
    { name: "Roasted Chana",           diet: "vegan",  category: "Snacks",    cal: 120, time: "5 min",  ingredients: ["chana","chickpea","gram"],                                  steps: "Toss chickpeas with oil, chaat masala, salt. Roast at 200°C 25 min until crispy.", tags: ["Vegan","High Protein"] },
    { name: "Sprout Chaat",            diet: "vegan",  category: "Snacks",    cal: 110, time: "10 min", ingredients: ["sprout","moong sprout","tomato","onion","lemon"],            steps: "Mix sprouts with onion, tomato, coriander, chaat masala, lemon juice. Serve fresh.", tags: ["Vegan","High Protein"] },
    { name: "Baingan Bharta + Roti",   diet: "vegan",  category: "Dinner",    cal: 220, time: "30 min", ingredients: ["brinjal","baingan","eggplant","onion","tomato"],             steps: "Roast brinjal on flame, peel. Sauté onion, tomato, garlic with spices. Mix in brinjal, cook 5 min.", tags: ["Vegan","Low Calorie"] },
    { name: "Mixed Veg Khichdi",       diet: "vegan",  category: "Lunch",     cal: 285, time: "25 min", ingredients: ["rice","dal","moong","carrot","peas","potato"],               steps: "Pressure cook rice, moong dal, veg with turmeric. Add ghee-cumin tadka. Easy one-pot meal.", tags: ["Vegan","Easy Digest"] },
    { name: "Soya Chunks Curry",       diet: "vegan",  category: "Lunch",     cal: 168, time: "20 min", ingredients: ["soya","soya chunks","onion","tomato"],                       steps: "Soak soya chunks. Make onion-tomato masala with spices. Add chunks, simmer 10 min.", tags: ["Vegan","High Protein"] },
    { name: "Besan Cheela",            diet: "vegan",  category: "Breakfast", cal: 170, time: "15 min", ingredients: ["besan","gram flour","onion","tomato","spinach"],             steps: "Mix besan with water to batter. Add chopped veg, salt, cumin. Cook thin pancakes 2 min each side.", tags: ["Vegan","High Protein"] },
    { name: "Banana Smoothie",         diet: "vegan",  category: "Breakfast", cal: 180, time: "5 min",  ingredients: ["banana","oats","almond milk"],                              steps: "Blend banana, oats, almond milk until smooth. Add date syrup if desired.", tags: ["Vegan","Quick"] },
    { name: "Dal Rice",                diet: "vegan",  category: "Lunch",     cal: 380, time: "30 min", ingredients: ["dal","lentil","rice","onion","tomato","garlic"],             steps: "Pressure cook dal with turmeric. Tadka with ghee, cumin, onion, garlic, tomato. Serve with steamed rice.", tags: ["Vegan","Complete Protein"] },
    { name: "Mushroom Matar",          diet: "vegan",  category: "Dinner",    cal: 180, time: "20 min", ingredients: ["mushroom","peas","matar","onion","tomato"],                  steps: "Sauté mushrooms until golden. Cook onion-tomato masala, add peas, add mushrooms back.", tags: ["Vegan","Low Calorie"] },
    { name: "Peanut Ladoo",            diet: "vegan",  category: "Snacks",    cal: 148, time: "15 min", ingredients: ["peanut","groundnut","jaggery","gur","cardamom"],             steps: "Roast peanuts, crush. Melt jaggery, mix in peanuts and cardamom. Shape into balls while warm.", tags: ["Vegan","Energy Boost"] },

    // VEGETARIAN (includes vegan-tagged ones too, so filtering veg also shows vegan)
    { name: "Paneer Tikka",            diet: "veg",    category: "Snacks",    cal: 275, time: "30 min", ingredients: ["paneer","yogurt","curd","capsicum","onion"],                 steps: "Marinate paneer in spiced yogurt 30 min. Grill or tawa-cook until charred. Serve with mint chutney.", tags: ["Vegetarian","High Protein"] },
    { name: "Palak Paneer + Roti",     diet: "veg",    category: "Lunch",     cal: 380, time: "25 min", ingredients: ["spinach","palak","paneer","tomato","onion"],                 steps: "Blanch spinach, blend. Sauté masala, add purée, paneer. Simmer 5 min. Finish with cream.", tags: ["Vegetarian","High Protein"] },
    { name: "Aloo Paratha",            diet: "veg",    category: "Breakfast", cal: 260, time: "25 min", ingredients: ["potato","aloo","wheat","atta","butter","ghee"],              steps: "Mash spiced potato filling. Stuff into dough ball, roll flat. Cook on tawa with butter.", tags: ["Vegetarian","Student-Friendly"] },
    { name: "Dosa with Chutney",       diet: "veg",    category: "Breakfast", cal: 235, time: "20 min", ingredients: ["dosa","rice","urad dal","coconut","chutney"],                steps: "Pour fermented batter on hot tawa, spread thin. Cook until crisp. Serve with coconut chutney.", tags: ["Vegetarian","Fermented"] },
    { name: "Greek Yogurt Parfait",    diet: "veg",    category: "Breakfast", cal: 220, time: "5 min",  ingredients: ["yogurt","curd","oats","banana","honey"],                     steps: "Layer Greek yogurt, rolled oats, sliced banana. Drizzle honey. Add nuts.", tags: ["Vegetarian","Quick"] },
    { name: "Paneer Bhurji + Roti",    diet: "veg",    category: "Dinner",    cal: 360, time: "15 min", ingredients: ["paneer","onion","tomato","capsicum"],                        steps: "Crumble paneer. Sauté onion, capsicum, tomato with spices. Add paneer, stir 3 min.", tags: ["Vegetarian","Quick"] },
    { name: "Dal Makhani + Rice",      diet: "veg",    category: "Dinner",    cal: 400, time: "40 min", ingredients: ["urad dal","dal","rajma","butter","cream","tomato"],          steps: "Soak dal overnight, pressure cook. Slow simmer with butter, tomato, cream 20 min.", tags: ["Vegetarian","Rich"] },
    { name: "Methi Thepla",            diet: "veg",    category: "Lunch",     cal: 240, time: "30 min", ingredients: ["fenugreek","methi","wheat flour","yogurt","curd"],           steps: "Mix fresh methi into wheat flour with yogurt and spices. Roll thin, cook on tawa.", tags: ["Vegetarian","High Fibre"] },
    { name: "Idli with Sambar",        diet: "veg",    category: "Breakfast", cal: 225, time: "20 min", ingredients: ["idli","semolina","rava","sambar","dal"],                     steps: "Steam idli batter in moulds 10-12 min. Serve hot with sambar and coconut chutney.", tags: ["Vegetarian","Fermented"] },
    { name: "Curd with Honey",         diet: "veg",    category: "Snacks",    cal: 110, time: "2 min",  ingredients: ["curd","yogurt","dahi","honey","banana"],                     steps: "Whisk curd smooth. Top with honey and sliced banana. Add cardamom if desired.", tags: ["Vegetarian","Probiotic"] },
    { name: "Makhana (Fox Nuts)",      diet: "veg",    category: "Snacks",    cal: 100, time: "10 min", ingredients: ["makhana","fox nuts","lotus seeds","ghee"],                   steps: "Heat ghee in pan, add makhana. Roast low flame 8-10 min until crunchy. Season with salt.", tags: ["Vegetarian","Low Calorie"] },
    { name: "Masala Buttermilk",       diet: "veg",    category: "Snacks",    cal: 45,  time: "3 min",  ingredients: ["buttermilk","chaas","curd","yogurt","cumin","ginger"],       steps: "Blend curd with water, salt, cumin, ginger, coriander. Refreshing probiotic drink.", tags: ["Vegetarian","Probiotic"] },
    { name: "Cheese Omelette",         diet: "veg",    category: "Breakfast", cal: 210, time: "8 min",  ingredients: ["egg","eggs","cheese","onion","capsicum"],                    steps: "Beat eggs with salt. Cook omelette with onion and capsicum. Add cheese, fold and serve.", tags: ["Vegetarian","High Protein"] },

    // NON-VEG
    { name: "Masala Scrambled Eggs",   diet: "nonveg", category: "Breakfast", cal: 220, time: "10 min", ingredients: ["egg","eggs","onion","tomato","chilli"],                      steps: "Beat eggs with salt. Sauté onion, tomato, chilli. Pour in eggs, stir gently on low heat.", tags: ["Non-Veg","Quick","High Protein"] },
    { name: "Egg Curry + Rice",        diet: "nonveg", category: "Lunch",     cal: 410, time: "25 min", ingredients: ["egg","eggs","onion","tomato","coconut milk"],                steps: "Hard-boil eggs. Make tomato-coconut gravy with spices. Add halved eggs, simmer 10 min.", tags: ["Non-Veg","High Protein"] },
    { name: "Chicken Biryani",         diet: "nonveg", category: "Lunch",     cal: 550, time: "60 min", ingredients: ["chicken","rice","basmati","onion","yogurt","curd"],          steps: "Marinate chicken in spiced yogurt. Caramelise onion. Layer par-cooked rice and chicken. Dum cook 20 min.", tags: ["Non-Veg","High Protein"] },
    { name: "Grilled Chicken Breast",  diet: "nonveg", category: "Dinner",    cal: 165, time: "20 min", ingredients: ["chicken","lemon","garlic","herbs"],                          steps: "Marinate chicken with lemon, garlic, herbs. Grill on high heat 6 min per side. Rest before slicing.", tags: ["Non-Veg","Low Calorie","High Protein"] },
    { name: "Chicken Stir Fry",        diet: "nonveg", category: "Dinner",    cal: 270, time: "20 min", ingredients: ["chicken","capsicum","pepper","onion","garlic","soy sauce"],  steps: "Slice chicken thin, marinate in soy sauce. Stir fry on high heat with veg until cooked.", tags: ["Non-Veg","High Protein"] },
    { name: "Egg Omelette + Salad",    diet: "nonveg", category: "Dinner",    cal: 200, time: "10 min", ingredients: ["egg","eggs","tomato","onion","capsicum","lettuce"],           steps: "Cook folded omelette with onion and capsicum. Serve with fresh tomato-lettuce salad.", tags: ["Non-Veg","Quick","Low Carb"] },
    { name: "Fish Curry + Rice",       diet: "nonveg", category: "Dinner",    cal: 410, time: "30 min", ingredients: ["fish","pomfret","rawas","rohu","tomato","coconut"],           steps: "Marinate fish. Make coconut-tomato gravy with spices. Cook fish gently in gravy. Serve with rice.", tags: ["Non-Veg","High Protein","Omega-3"] },
    { name: "Chicken Curry",           diet: "nonveg", category: "Lunch",     cal: 490, time: "35 min", ingredients: ["chicken","onion","tomato","yogurt","curd","garam masala"],   steps: "Brown chicken. Make onion-tomato-yogurt masala. Combine, pressure cook 2 whistles. Garnish with coriander.", tags: ["Non-Veg","High Protein"] },
    { name: "Boiled Egg Chaat",        diet: "nonveg", category: "Snacks",    cal: 155, time: "8 min",  ingredients: ["egg","eggs","onion","tomato","chaat masala","lemon"],        steps: "Halve boiled eggs. Top with onion, tomato, chaat masala, lemon juice. Quick high-protein snack.", tags: ["Non-Veg","High Protein","Quick"] },
    { name: "Chicken Soup",            diet: "nonveg", category: "Dinner",    cal: 150, time: "30 min", ingredients: ["chicken","carrot","celery","onion","garlic","pepper"],       steps: "Simmer chicken with vegetables and spices 25 min. Shred chicken back into broth. Light and nourishing.", tags: ["Non-Veg","Low Calorie","Comforting"] },

    // NEW RECIPES ADDED
    // VEGAN
    { name: "Tofu Scramble",           diet: "vegan",  category: "Breakfast", cal: 200, time: "15 min", ingredients: ["tofu","onion","tomato","turmeric","chilli"],           steps: "Crumble tofu. Sauté onion and tomato with turmeric. Mix tofu and cook for 5 min.", tags: ["Vegan","High Protein","Quick"] },
    { name: "Chana Masala",            diet: "vegan",  category: "Lunch",     cal: 350, time: "40 min", ingredients: ["chana","chickpeas","onion","tomato","garam masala"],   steps: "Pressure cook chickpeas. Cook onion-tomato gravy with spices, simmer chickpeas in it for 15 min.", tags: ["Vegan","High Protein"] },
    { name: "Avocado Toast",           diet: "vegan",  category: "Breakfast", cal: 250, time: "10 min", ingredients: ["avocado","bread","lemon","salt","pepper"],             steps: "Mash avocado with lemon juice, salt, and pepper. Spread on toasted bread.", tags: ["Vegan","Healthy Fats","Quick"] },
    { name: "Lentil Soup",             diet: "vegan",  category: "Dinner",    cal: 220, time: "30 min", ingredients: ["lentils","dal","carrot","celery","garlic"],            steps: "Boil lentils with vegetables and garlic until soft. Blend partially for a thick soup.", tags: ["Vegan","Low Calorie","Comforting"] },
    { name: "Quinoa Salad",            diet: "vegan",  category: "Lunch",     cal: 300, time: "20 min", ingredients: ["quinoa","cucumber","tomato","lemon","olive oil"],      steps: "Boil quinoa. Toss with chopped cucumber, tomato, olive oil, and lemon juice.", tags: ["Vegan","Gluten-Free","High Fibre"] },
    { name: "Aloo Jeera",              diet: "vegan",  category: "Dinner",    cal: 200, time: "20 min", ingredients: ["potato","aloo","cumin","jeera","oil"],                 steps: "Boil and dice potatoes. Sauté in oil with cumin seeds, turmeric, and salt until crispy.", tags: ["Vegan","Budget-Friendly"] },
    { name: "Pesto Pasta",             diet: "vegan",  category: "Dinner",    cal: 400, time: "25 min", ingredients: ["pasta","basil","walnuts","olive oil","garlic"],        steps: "Boil pasta. Blend basil, walnuts, garlic, and oil to make vegan pesto. Toss pasta in sauce.", tags: ["Vegan","Quick"] },
    { name: "Soya Keema Matar",        diet: "vegan",  category: "Lunch",     cal: 260, time: "25 min", ingredients: ["soya granules","peas","onion","tomato","spices"],      steps: "Soak soya granules. Cook onion-tomato masala, add peas and soya, simmer for 10 min.", tags: ["Vegan","High Protein"] },

    // VEGETARIAN
    { name: "Paneer Butter Masala",    diet: "veg",    category: "Lunch",     cal: 450, time: "40 min", ingredients: ["paneer","tomato","butter","cream","cashew"],           steps: "Blend cashews and tomatoes. Cook paste in butter, add spices, paneer cubes, and cream. Simmer.", tags: ["Vegetarian","Rich","High Protein"] },
    { name: "Vegetable Pulao",         diet: "veg",    category: "Lunch",     cal: 350, time: "30 min", ingredients: ["rice","carrot","peas","beans","ghee"],                 steps: "Sauté veg in ghee with whole spices. Add soaked rice and water. Cook until fluffy.", tags: ["Vegetarian","One-Pot"] },
    { name: "Cucumber Raita",          diet: "veg",    category: "Snacks",    cal: 100, time: "5 min",  ingredients: ["curd","yogurt","cucumber","mint","cumin"],             steps: "Grate cucumber, squeeze water. Mix into whisked curd with roasted cumin powder and mint.", tags: ["Vegetarian","Probiotic","Cooling"] },
    { name: "Kadhi Pakora",            diet: "veg",    category: "Lunch",     cal: 320, time: "45 min", ingredients: ["besan","yogurt","curd","onion","oil"],                 steps: "Whisk besan and sour curd, simmer for 30 mins. Fry onion pakoras and add to simmering kadhi.", tags: ["Vegetarian","Comfort Food"] },
    { name: "Veg Cheese Sandwich",     diet: "veg",    category: "Breakfast", cal: 300, time: "10 min", ingredients: ["bread","cheese","cucumber","tomato","butter"],         steps: "Layer veggies and cheese between buttered bread slices. Grill until cheese melts.", tags: ["Vegetarian","Quick"] },
    { name: "Malai Kofta",             diet: "veg",    category: "Dinner",    cal: 500, time: "50 min", ingredients: ["potato","paneer","cream","cashew","tomato"],           steps: "Fry potato-paneer balls. Serve in a rich, creamy cashew-tomato gravy.", tags: ["Vegetarian","Rich","Special Occasion"] },

    // NON-VEG
    { name: "Mutton Curry",            diet: "nonveg", category: "Lunch",     cal: 520, time: "60 min", ingredients: ["mutton","onion","tomato","yogurt","spices"],           steps: "Marinate mutton. Slow cook in a rich onion-tomato and yogurt gravy until meat falls off the bone.", tags: ["Non-Veg","High Protein","Rich"] },
    { name: "Prawn Masala",            diet: "nonveg", category: "Dinner",    cal: 310, time: "25 min", ingredients: ["prawns","onion","tomato","coconut","chilli"],          steps: "Sauté prawns with spices. Cook in a thick onion-coconut base for 10 mins.", tags: ["Non-Veg","High Protein","Seafood"] },
    { name: "Egg Fried Rice",          diet: "nonveg", category: "Lunch",     cal: 380, time: "20 min", ingredients: ["rice","egg","eggs","carrot","soy sauce"],              steps: "Scramble eggs. Sauté diced veg. Toss leftover cold rice with eggs, veg, and soy sauce.", tags: ["Non-Veg","Quick"] },
    { name: "Chicken Korma",           diet: "nonveg", category: "Dinner",    cal: 480, time: "45 min", ingredients: ["chicken","yogurt","cashew","onion","spices"],          steps: "Marinate chicken. Cook in a mild, creamy cashew and yogurt gravy.", tags: ["Non-Veg","High Protein","Rich"] },
    { name: "Fish Fry",                diet: "nonveg", category: "Lunch",     cal: 290, time: "20 min", ingredients: ["fish","lemon","turmeric","chilli","oil"],              steps: "Marinate fish slices in lemon, turmeric, and chilli powder. Shallow fry until crisp.", tags: ["Non-Veg","High Protein","Omega-3"] },
    { name: "Mutton Biryani",          diet: "nonveg", category: "Dinner",    cal: 600, time: "90 min", ingredients: ["mutton","rice","basmati","onion","yogurt","spices"],   steps: "Layer marinated semi-cooked mutton and par-boiled rice. Dum cook for 45 mins.", tags: ["Non-Veg","High Protein","Special Occasion"] },
];

let activeRecipeFilter = 'all';

function setupRecipeDietFilter() {
    document.querySelectorAll('.rdiet-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.rdiet-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeRecipeFilter = btn.dataset.filter;
            // Re-run with last ingredients if available
            const input = document.getElementById('recipe-ingredients').value.trim();
            if (input) generateRecipe();
        });
    });
}

/** Returns recipes compatible with the user's diet type setting */
function getCompatibleRecipes() {
    const dt   = currentUser?.dietType || 'veg';
    const conf = DIET_CONFIG[dt];

    // Map food `type` values to recipe `diet` values
    const dietMap = { 'vegetarian': 'veg', 'vegan': 'vegan', 'non-vegetarian': 'nonveg' };
    const allowedDiets = conf.allowed.map(t => dietMap[t]);

    return RECIPE_DB.filter(r => allowedDiets.includes(r.diet));
}

async function generateRecipe() {
    const input = document.getElementById('recipe-ingredients').value.trim();
    if (!input) return showToast('Please enter some ingredients.');

    const container = document.getElementById('recipe-results');
    container.innerHTML = '<p style="color:var(--text-muted);margin-top:1rem;text-align:center">Searching recipes…</p>';

    const ingredients = input.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    await new Promise(r => setTimeout(r, 350));

    // Start with diet-compatible recipes
    let pool = getCompatibleRecipes();

    // Apply manual filter toggle (overrides user diet)
    if (activeRecipeFilter !== 'all') {
        pool = RECIPE_DB.filter(r => r.diet === activeRecipeFilter);
    }

    // Score by ingredient match
    const scored = pool.map(recipe => {
        const matches = ingredients.filter(ing =>
            recipe.ingredients.some(ri => ri.includes(ing) || ing.includes(ri))
        );
        return { recipe, score: matches.length };
    }).filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 9);

    const dietConf = DIET_CONFIG[currentUser?.dietType || 'veg'];

    if (!scored.length) {
        const hint = activeRecipeFilter === 'all'
            ? `No ${dietConf.label} recipes matched. Try: eggs, chicken, paneer, rice, dal, spinach, oats…`
            : 'No matches for that filter. Try different ingredients.';
        container.innerHTML = `<div class="recipe-card" style="grid-column:1/-1"><h3>No matching recipes</h3><p>${hint}</p></div>`;
        return;
    }

    const dietIcons = { veg: '🥦', vegan: '🌱', nonveg: '🍗' };
    const dietLabels = { veg: 'Vegetarian', vegan: 'Vegan', nonveg: 'Non-Veg' };
    const dietBadgeCls = { veg: 'badge-veg', vegan: 'badge-vegan', nonveg: 'badge-non-veg' };

    container.innerHTML = scored.map(({ recipe: r, score }) => `
        <div class="recipe-card">
            <div class="recipe-card-top">
                <h3>${r.name}</h3>
                <span class="recipe-match">${score} match${score > 1 ? 'es' : ''}</span>
            </div>
            <p>${r.steps}</p>
            <div class="recipe-tags">
                <span class="recipe-tag ${dietBadgeCls[r.diet]}">${dietIcons[r.diet]} ${dietLabels[r.diet]}</span>
                <span class="recipe-tag tag-amber">⏱ ${r.time}</span>
                <span class="recipe-tag tag-rust">🔥 ${r.cal} kcal</span>
                ${r.tags.map(t => `<span class="recipe-tag">${t}</span>`).join('')}
            </div>
        </div>`).join('');
}

// ── Chatbot ───────────────────────────────────────
function setupChat() {
    document.getElementById('chatbot-toggle').addEventListener('click', () =>
        document.getElementById('chat-panel').classList.toggle('hidden'));
    document.getElementById('chat-close').addEventListener('click', () =>
        document.getElementById('chat-panel').classList.add('hidden'));
    document.getElementById('chat-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') handleChatSubmit();
    });
}

async function handleChatSubmit() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    sendChat(msg);
}

async function sendChat(message) {
    appendMsg(message, 'user');
    document.getElementById('typing-indicator').classList.remove('hidden');
    document.querySelector('.quick-chips')?.remove();

    const dietContext = currentUser
        ? `The user follows a ${DIET_CONFIG[currentUser.dietType]?.label || 'vegetarian'} diet.`
        : '';

    try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 300,
                system: `You are NutriBot, a friendly AI nutrition assistant for NutriSetu, an Indian diet tracker. ${dietContext} Give short, practical advice about food, calories, exercise, and healthy habits. Keep responses under 80 words. Respect the user's diet type — never suggest foods outside it. Be warm and encouraging.`,
                messages: [{ role: 'user', content: message }]
            })
        });
        document.getElementById('typing-indicator').classList.add('hidden');
        if (res.ok) appendMsg((await res.json()).content?.[0]?.text || "Sorry, no response.", 'bot');
        else appendMsg(getFallbackReply(message), 'bot');
    } catch {
        document.getElementById('typing-indicator').classList.add('hidden');
        appendMsg(getFallbackReply(message), 'bot');
    }
}

function appendMsg(text, role) {
    const body = document.getElementById('chat-body');
    const div = document.createElement('div');
    div.className = `msg ${role === 'bot' ? 'bot-msg' : 'user-msg'}`;
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
}

function getFallbackReply(msg) {
    const l = msg.toLowerCase();
    const dt = currentUser?.dietType || 'veg';
    if (l.includes('protein'))   return dt === 'vegan' ? 'Top vegan proteins: dal, soya chunks, tofu, moong chilla, roasted chana. Combine grains + legumes for complete protein!' : dt === 'veg' ? 'Best veg proteins: paneer, eggs, Greek yogurt, dal, moong chilla.' : 'Great protein sources: chicken, eggs, fish, paneer, dal — aim for 0.8–1g per kg bodyweight.';
    if (l.includes('snack'))     return dt === 'nonveg' ? 'Healthy snacks: boiled eggs, egg chaat, chicken soup, fruit chaat, roasted chana.' : 'Great snacks: makhana, sprout chaat, fruit chaat, roasted chana, curd with honey.';
    if (l.includes('lunch'))     return dt === 'nonveg' ? 'Ideal lunch: dal rice + sabzi, chicken curry, egg curry, or biryani.' : dt === 'vegan' ? 'Great vegan lunch: rajma chawal, dal rice, soya curry, or khichdi.' : 'Solid vegetarian lunch: palak paneer + roti, dal rice, methi thepla, or chole.';
    if (l.includes('weight'))    return 'Sustainable progress is ~0.5 kg/week. Stay in your calorie target, log daily, and update your weight each morning.';
    if (l.includes('calorie'))   return 'Your daily target is on the Dashboard. Log every meal — even small ones — to stay accurate.';
    return 'Focus on whole foods, adequate protein, and staying hydrated. Small consistent habits beat intense short efforts every time. 🌿';
}

// ── Toast ─────────────────────────────────────────
function showToast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = `toast${type === 'error' ? ' error' : ''}`;
    t.textContent = msg;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

/* ═══════════════════════════════════════════════════════════════
   DEDICATED MEAL PLAN SECTION — Smart Pairing Engine
   
   ROOT CAUSE (fixed here):
   The DB has single items with max calories:
     Breakfast ≤ 346 kcal  (target ~500 for 2000 kcal user)
     Lunch     ≤ 580 kcal  (target ~700)
     Dinner    ≤ 476 kcal  (target ~600)
     Snacks    ≤ 292 kcal  (target ~200)
   
   FIX: Smart pairing algorithm that combines 2–3 DB items into
   a "meal combo" that together hits the slot's calorie target
   within ±15%. Each slot shows 2 combo options to choose from.
════════════════════════════════════════════════════════════════ */

const MP_SLOTS = [
    { key: 'mp-bk', cat: 'Breakfast', icon: '🌅', label: 'Breakfast', pct: 0.25, maxItems: 5 },
    { key: 'mp-lu', cat: 'Lunch',     icon: '🌞', label: 'Lunch',     pct: 0.35, maxItems: 5 },
    { key: 'mp-di', cat: 'Dinner',    icon: '🌙', label: 'Dinner',    pct: 0.30, maxItems: 5 },
    { key: 'mp-sn', cat: 'Snacks',    icon: '☕', label: 'Snacks',    pct: 0.10, maxItems: 4 },
];

// Store generated combos so re-renders don't re-pick
let _mpCombos = {}; // { 'mp-bk': [ combo, combo ], ... }
let _mpLoggedComboIds = new Set(); // IDs of combos the user logged

/**
 * SMART PAIRING ALGORITHM
 * 
 * Given a pool of foods and a calorie target, build N meal combos
 * that together reach the target (±15%).
 *
 * Strategy:
 *   1. For each combo attempt:
 *      a. Pick the highest-calorie item as the "anchor" (main dish)
 *      b. Greedily add items from the pool that bring total closer to target
 *      c. Stop when within ±15% of target or maxItems reached
 *   2. Shuffle pool lightly between combo attempts for variety
 *   3. Sort combos by proximity to target (best match first)
 */
function buildMealCombos(pool, target, numCombos, maxItems) {
    if (!pool.length) return [];

    const TOLERANCE = 0.05; // tight: ±5%
    const MIN_PCT   = 1 - TOLERANCE;
    const MAX_PCT   = 1 + TOLERANCE;
    const combos    = [];
    const usedAnchorIds = new Set();

    for (let attempt = 0; attempt < numCombos * 10 && combos.length < numCombos; attempt++) {
        // Shuffle pool for variety between combos
        const shuffled = [...pool].sort(() => Math.random() - 0.48);

        // Pick anchor: prefer items ~30-60% of target (main dish range)
        const idealAnchorMax = target * 0.65;
        const idealAnchorMin = target * 0.25;
        const anchorCandidates = shuffled.filter(f =>
            !usedAnchorIds.has(f._id) &&
            f.calories >= idealAnchorMin &&
            f.calories <= idealAnchorMax
        );
        // Fall back to any unused item
        const anchor = anchorCandidates[0] || shuffled.find(f => !usedAnchorIds.has(f._id));
        if (!anchor) break;
        usedAnchorIds.add(anchor._id);

        const chosen = [anchor];
        let total    = anchor.calories;

        // Precision fill: repeatedly find the item that brings us closest to target
        const remaining = shuffled.filter(f => f._id !== anchor._id);

        while (chosen.length < maxItems && total < target * MIN_PCT) {
            const gap = target - total;
            // Find best fit: item whose calories ≤ gap * 1.1, closest to gap
            const candidates = remaining.filter(f =>
                !chosen.find(c => c._id === f._id) &&
                f.calories <= gap * 1.1 // allow slightly over gap
            );
            if (!candidates.length) break;
            // Sort by closest to gap
            candidates.sort((a, b) => Math.abs(a.calories - gap) - Math.abs(b.calories - gap));
            const best = candidates[0];
            chosen.push(best);
            total += best.calories;
            if (total >= target * MIN_PCT && total <= target * MAX_PCT) break;
        }

        // If still under MIN after maxItems, try one more pass allowing slightly larger items
        if (total < target * MIN_PCT && chosen.length < maxItems + 1) {
            const gap = target - total;
            const extras = remaining.filter(f =>
                !chosen.find(c => c._id === f._id) &&
                f.calories <= gap * 1.3
            );
            extras.sort((a, b) => Math.abs(a.calories - gap) - Math.abs(b.calories - gap));
            if (extras.length) {
                chosen.push(extras[0]);
                total += extras[0].calories;
            }
        }

        // Build combo object
        const combo = {
            id:      `combo-${attempt}-${Date.now()}`,
            items:   chosen,
            total:   chosen.reduce((s, f) => s + f.calories, 0),
            protein: chosen.reduce((s, f) => s + (f.protein || 0), 0),
            carbs:   chosen.reduce((s, f) => s + (f.carbs   || 0), 0),
            fat:     chosen.reduce((s, f) => s + (f.fats || f.fat || 0), 0),
            pctOff:  0,
        };
        combo.pctOff = Math.abs(combo.total - target) / target;

        // Reject combos that are more than 15% off
        if (combo.pctOff > 0.15) continue;

        // Avoid combos with identical anchor + second item
        const sigKey = chosen.slice(0, 2).map(f => f._id).sort().join('|');
        if (combos.some(c => c.items.slice(0, 2).map(f => f._id).sort().join('|') === sigKey)) continue;

        combos.push(combo);
    }

    // Sort: closest to target first
    combos.sort((a, b) => a.pctOff - b.pctOff);
    return combos.slice(0, numCombos);
}


/**
 * Render the full dedicated Meal Plan section.
 */
async function renderMealPlanSection() {
    if (!currentUser) return;
    if (!allFoods.length) await loadFoods();

    // Update date
    const dateEl = document.getElementById('mp-date');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long'
    });

    // Update diet badge
    const badgeEl = document.getElementById('mp-diet-badge');
    if (badgeEl) badgeEl.innerHTML = getDietBadgeHTML(currentUser.dietType, 'md');

    // Fetch today's logs fresh
    try {
        const r = await fetch(`${API}/logs`);
        todayLogs = r.ok ? await r.json() : [];
    } catch { /* keep stale */ }

    // Generate combos if not yet done
    const target    = currentUser.calorieTarget || 2000;
    const dietFoods = getDietFoods();

    for (const slot of MP_SLOTS) {
        if (_mpCombos[slot.key]) continue; // already generated, keep stable
        const pool = dietFoods.filter(f => f.category === slot.cat);
        const allowance = Math.round(target * slot.pct);
        _mpCombos[slot.key] = buildMealCombos(pool, allowance, 2, slot.maxItems);
    }

    _renderMPSummaryStrip();
    _renderMPSlots();
    _renderMPMacros();
    _renderMPNudge();
}

/**
 * Re-generate combos for all unlogged slots, re-render.
 */
async function regenerateMealPlan() {
    const btn = document.querySelector('.mp-regen-btn');
    if (btn) btn.classList.add('spinning');

    const loggedComboIds = _mpLoggedComboIds;
    for (const slot of MP_SLOTS) {
        // Only clear unlogged slots
        const hasLoggedCombo = _mpCombos[slot.key]?.some(c => loggedComboIds.has(c.id));
        if (!hasLoggedCombo) delete _mpCombos[slot.key];
    }

    await renderMealPlanSection();
    if (btn) btn.classList.remove('spinning');
    showToast('Fresh meal combos ready ✓');
}

/**
 * Render the summary strip (target / plan total / logged / remaining).
 */
function _renderMPSummaryStrip() {
    const target   = currentUser?.calorieTarget || 2000;
    const consumed = todayLogs.reduce((s, l) => s + (l.calories || 0), 0);

    // Plan total = sum of best combo per slot
    let planTotal = 0;
    for (const slot of MP_SLOTS) {
        const combos = _mpCombos[slot.key] || [];
        if (combos.length) planTotal += combos[0].total;
    }

    const remaining = Math.max(0, target - consumed);
    const pct       = Math.min(100, Math.round(consumed / target * 100));

    _setText('mps-target',  target);
    _setText('mps-planned', planTotal);
    _setText('mps-logged',  consumed);
    _setText('mps-remain',  remaining);

    const bar = document.getElementById('mps-bar');
    const pctEl = document.getElementById('mps-pct');
    if (bar) { bar.style.width = pct + '%'; bar.classList.toggle('over', consumed > target); }
    if (pctEl) pctEl.textContent = pct + '%';
}

/**
 * Render all 4 meal slot cards.
 */
function _renderMPSlots() {
    const slotsEl = document.getElementById('mp-slots');
    if (!slotsEl) return;

    const target      = currentUser?.calorieTarget || 2000;
    const loggedNames = new Set(todayLogs.map(l => l.foodName));

    slotsEl.innerHTML = '';
    for (const slot of MP_SLOTS) {
        const allowance = Math.round(target * slot.pct);
        const combos    = _mpCombos[slot.key] || [];
        const loggedCombo = combos.find(c => _mpLoggedComboIds.has(c.id));
        const isSlotLogged = !!loggedCombo;

        const card = document.createElement('div');
        card.className = `mp-slot-card${isSlotLogged ? ' mp-slot-logged' : ''}`;
        card.id = `mpcard-${slot.key}`;

        // Gap tag
        let gapTag = '';
        if (isSlotLogged) {
            const diff = loggedCombo.total - allowance;
            const pctOff = Math.abs(diff) / allowance;
            if (pctOff <= 0.10) gapTag = `<span class="mp-tag mp-tag-match-close">✓ On target</span>`;
            else if (diff < 0)  gapTag = `<span class="mp-tag mp-tag-match-close">${Math.abs(diff)} kcal under</span>`;
            else                gapTag = `<span class="mp-tag mp-tag-match-low">+${diff} kcal over</span>`;
        }

        card.innerHTML = `
            <div class="mp-slot-hdr">
                <div class="mp-slot-icon">${slot.icon}</div>
                <div class="mp-slot-hdr-info">
                    <div class="mp-slot-name">${slot.label}</div>
                    <div class="mp-slot-meta">Target: <strong>${allowance} kcal</strong> · ${Math.round(slot.pct * 100)}% of goal ${isSlotLogged ? gapTag : ''}</div>
                </div>
                <div class="mp-slot-pill ${isSlotLogged ? 'logged' : 'pending'}">${isSlotLogged ? '✓ Logged' : 'Pending'}</div>
            </div>
            <div class="mp-combos" id="mpcombos-${slot.key}">
                ${combos.length
                    ? combos.map((combo, i) => _comboHTML(combo, i, slot, allowance, isSlotLogged)).join('')
                    : `<div class="mp-loading"><div class="mp-loading-spinner"></div>No ${slot.cat.toLowerCase()} options found for your diet.</div>`
                }
            </div>`;
        slotsEl.appendChild(card);
    }
}

/**
 * Build HTML for one meal combo option.
 */
function _comboHTML(combo, idx, slot, allowance, slotLogged) {
    const isLogged = _mpLoggedComboIds.has(combo.id);
    const isBest   = idx === 0;

    // Match badge
    const diff    = combo.total - allowance;
    const pctOff  = Math.abs(diff) / allowance;
    let matchTag  = '';
    if (!isLogged) {
        if (pctOff <= 0.05)      matchTag = `<span class="mp-tag mp-tag-match-best">✅ Exact (${Math.round(pctOff*100)}% off)</span>`;
        else if (pctOff <= 0.10) matchTag = `<span class="mp-tag mp-tag-match-best">⭐ Best match (${Math.round(pctOff*100)}% off)</span>`;
        else if (pctOff <= 0.15) matchTag = `<span class="mp-tag mp-tag-match-close">${diff > 0 ? '+' : ''}${diff} kcal (${Math.round(pctOff*100)}% off)</span>`;
        else                     matchTag = `<span class="mp-tag mp-tag-match-low">${diff > 0 ? '+' : ''}${diff} kcal vs target</span>`;
    }

    // Diet type of combo (use most restrictive item's label)
    const hasNonVeg = combo.items.some(f => f.type === 'non-vegetarian');
    const hasVegan  = combo.items.every(f => f.type === 'vegan');
    const dietClass = hasNonVeg ? 'mp-tag-nonveg' : hasVegan ? 'mp-tag-vegan' : 'mp-tag-veg';
    const dietLabel = hasNonVeg ? 'Non-Veg' : hasVegan ? 'Vegan' : 'Vegetarian';

    // Items list
    const itemsHTML = combo.items.map(f =>
        `<div class="mp-item-row">
            <div class="mp-item-dot"></div>
            <div class="mp-item-name">${f.name}</div>
            <div class="mp-item-cal">${f.calories} kcal</div>
        </div>`
    ).join('');

    const btnDisabled = (slotLogged && !isLogged) || isLogged;
    const safeSlotKey = slot.key;
    const safeComboId = combo.id.replace(/['"]/g, '');

    return `
    <div class="mp-combo ${isLogged ? 'mp-combo-logged' : ''} ${isBest && !isLogged ? 'mp-combo-best' : ''}" id="mpcombo-${safeComboId}">
        <div class="mp-combo-hdr">
            <div class="mp-combo-left">
                <span class="mp-combo-num">${isLogged ? '✓' : idx + 1}</span>
                <span class="mp-combo-title">Option ${idx + 1}${isBest && !slotLogged ? ' — Recommended' : ''}</span>
            </div>
        </div>
        <div class="mp-combo-tags">
            <span class="mp-tag mp-tag-kcal">${combo.total} kcal total</span>
            <span class="mp-tag ${dietClass}">${dietLabel}</span>
            ${matchTag}
        </div>
        <div class="mp-combo-items">${itemsHTML}</div>
        <div class="mp-combo-macro">
            <span>🥩 ${Math.round(combo.protein)}g protein</span>
            <span>🌾 ${Math.round(combo.carbs)}g carbs</span>
            <span>🧈 ${Math.round(combo.fat)}g fat</span>
        </div>
        <button
            class="mp-log-btn ${isLogged ? 'logged' : ''}"
            ${btnDisabled ? 'disabled' : ''}
            onclick="logMealCombo('${safeComboId}', '${safeSlotKey}')">
            ${isLogged ? '✓ Logged' : 'Log This Meal'}
        </button>
    </div>`;
}

/**
 * Log an entire meal combo — posts each item to /api/logs, then refreshes UI.
 */
async function logMealCombo(comboId, slotKey) {
    const combos = _mpCombos[slotKey] || [];
    const combo  = combos.find(c => c.id === comboId);
    if (!combo) return;

    try {
        for (const food of combo.items) {
            const res = await fetch(`${API}/logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    foodId:   food._id,
                    foodName: food.name,
                    calories: food.calories,
                    portions: 1,
                    type:     food.type
                })
            });
            if (res.ok) {
                const log   = await res.json();
                log.protein = food.protein || 0;
                log.carbs   = food.carbs   || 0;
                log.fat     = food.fats || food.fat || 0;
                todayLogs.push(log);
            }
        }

        _mpLoggedComboIds.add(comboId);
        persistTodayCalories(todayLogs.reduce((s, l) => s + (l.calories || 0), 0));
        showToast(`Logged ${combo.items.length} items (${combo.total} kcal) ✓`);

        // Surgical update — no full re-render
        const slot = MP_SLOTS.find(s => s.key === slotKey);
        const allowance = Math.round((currentUser?.calorieTarget || 2000) * (slot?.pct || 0.25));

        // Update card border
        const card = document.getElementById(`mpcard-${slotKey}`);
        if (card) card.classList.add('mp-slot-logged');

        // Update slot pill
        const pill = card?.querySelector('.mp-slot-pill');
        if (pill) { pill.textContent = '✓ Logged'; pill.className = 'mp-slot-pill logged'; }

        // Add gap tag in slot meta
        const metaEl = card?.querySelector('.mp-slot-meta');
        if (metaEl && !metaEl.querySelector('.mp-tag')) {
            const diff    = combo.total - allowance;
            const pctOff  = Math.abs(diff) / allowance;
            let gapTag = '';
            if (pctOff <= 0.10) gapTag = `<span class="mp-tag mp-tag-match-close">✓ On target</span>`;
            else if (diff < 0)  gapTag = `<span class="mp-tag mp-tag-match-close">${Math.abs(diff)} kcal under</span>`;
            else                gapTag = `<span class="mp-tag mp-tag-match-low">+${diff} kcal over</span>`;
            metaEl.insertAdjacentHTML('beforeend', ' ' + gapTag);
        }

        // Update logged combo card
        const comboEl = document.getElementById(`mpcombo-${comboId}`);
        if (comboEl) {
            comboEl.classList.add('mp-combo-logged');
            comboEl.classList.remove('mp-combo-best');
            const numEl = comboEl.querySelector('.mp-combo-num');
            if (numEl) numEl.textContent = '✓';
            const titleEl = comboEl.querySelector('.mp-combo-title');
            if (titleEl) titleEl.textContent = 'Logged ✓';
            const tags = comboEl.querySelector('.mp-combo-tags');
            if (tags) tags.querySelectorAll('.mp-tag-match-best, .mp-tag-match-close, .mp-tag-match-low').forEach(t => t.remove());
            const btn = comboEl.querySelector('.mp-log-btn');
            if (btn) { btn.textContent = '✓ Logged'; btn.classList.add('logged'); btn.disabled = true; }
        }

        // Disable other combo buttons in this slot
        document.querySelectorAll(`#mpcombos-${slotKey} .mp-log-btn:not(.logged)`).forEach(b => b.disabled = true);

        // Refresh summary strip, macros, nudge
        _renderMPSummaryStrip();
        _renderMPMacros();
        _renderMPNudge();

        // Also refresh food log and dashboard donut
        refreshFoodLog();
        if (document.getElementById('dashboard-section')?.classList.contains('active')) refreshDashboard();

    } catch (e) {
        console.error(e);
        showToast('Server error logging meal.', 'error');
    }
}

/**
 * Render the macro breakdown grid (plan totals across all best combos).
 */
function _renderMPMacros() {
    const grid = document.getElementById('mp-macro-grid');
    if (!grid) return;

    const target  = currentUser?.calorieTarget || 2000;
    let planCal = 0, planProt = 0, planCarb = 0, planFat = 0;

    for (const slot of MP_SLOTS) {
        const combos = _mpCombos[slot.key] || [];
        const best   = combos[0];
        if (best) {
            planCal  += best.total;
            planProt += Math.round(best.protein);
            planCarb += Math.round(best.carbs);
            planFat  += Math.round(best.fat);
        }
    }

    const goalProt = Math.round(target * 0.0375); // ~30% of kcal / 4 = 7.5% * 5 approx
    const goalCarb = Math.round(target * 0.0625);
    const goalFat  = Math.round(target * 0.0167);

    const macros = [
        { label: 'Total Calories', val: `${planCal} kcal`, sub: `goal: ${target}`, pct: planCal / target, cls: 'mc-cal' },
        { label: 'Protein',  val: `${planProt}g`, sub: `goal: ~${goalProt}g`, pct: planProt / goalProt, cls: 'mc-protein' },
        { label: 'Carbs',    val: `${planCarb}g`, sub: `goal: ~${goalCarb}g`, pct: planCarb / goalCarb, cls: 'mc-carbs' },
        { label: 'Fat',      val: `${planFat}g`,  sub: `goal: ~${goalFat}g`,  pct: planFat  / goalFat,  cls: 'mc-fat' },
    ];

    grid.innerHTML = macros.map(m => `
        <div class="mp-macro-card">
            <div class="mp-macro-card-label">${m.label}</div>
            <div class="mp-macro-card-val">${m.val}</div>
            <div class="mp-macro-card-sub">${m.sub}</div>
            <div class="mp-macro-bar">
                <div class="mp-macro-bar-fill ${m.cls}" style="width:${Math.min(100, Math.round(m.pct * 100))}%"></div>
            </div>
        </div>`).join('');
}

/**
 * Smart nudge for the meal plan section.
 */
function _renderMPNudge() {
    const el  = document.getElementById('mp-nudge');
    const txt = document.getElementById('mp-nudge-txt');
    if (!el || !txt) return;

    const target   = currentUser?.calorieTarget || 2000;
    const consumed = todayLogs.reduce((s, l) => s + (l.calories || 0), 0);
    const short    = target - consumed;

    if (consumed >= target) { el.classList.add('hidden'); return; }

    el.classList.remove('hidden');
    const unloggedSlots = MP_SLOTS.filter(s => !_mpCombos[s.key]?.some(c => _mpLoggedComboIds.has(c.id)));

    if (!unloggedSlots.length) {
        txt.innerHTML = `All meals logged — still <strong>${short} kcal short</strong> of your target. Consider an extra snack.`;
    } else {
        const planCal = MP_SLOTS.reduce((s, slot) => {
            const best = (_mpCombos[slot.key] || [])[0];
            return s + (best?.total || 0);
        }, 0);
        txt.innerHTML = `Your plan covers <strong>${planCal} kcal</strong> (goal: ${target}). Log your <strong>${unloggedSlots.map(s => s.label).join(', ')}</strong> to hit it.`;
    }
}

// Utility: safe textContent setter
function _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}
