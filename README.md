# 🥗 Nutri Setu — Indian Student Nutrition Tracker

A personalized diet and calorie tracking web app tailored for Indian students, with 1000+ real Indian food items.

---

## 📁 Project Structure

```
nutri_setu/
├── server.js          # Express API server
├── seed.js            # Indian food database seeder (1000 items)
├── index.html         # Frontend single-page app
├── css/
│   └── style.css      # Styles
├── js/
│   └── app.js         # Frontend logic
├── models/
│   ├── Food.js        # Food schema
│   ├── Log.js         # Daily food log schema
│   ├── Plan.js        # Diet plan schema
│   └── User.js        # User profile schema
├── .env.example       # Environment variable template
└── package.json
```

---

## 🚀 How to Run

### 1. Prerequisites
- **Node.js** v18 or higher
- **MongoDB** running locally (or a MongoDB Atlas URI)

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment
```bash
cp .env.example .env
# Edit .env if you want to change MONGO_URI or PORT
```

### 4. Seed the food database (1000 Indian foods)
```bash
npm run seed
```
This inserts 1000 real Indian food items (Breakfast, Lunch, Dinner, Snacks) into MongoDB.

### 5. Start the server
```bash
# Production
npm start

# Development (auto-reload on changes)
npm run dev
```

### 6. Open in browser
```
http://localhost:5000
```

---

## ⚙️ Environment Variables (`.env`)

| Variable    | Default                                    | Description         |
|-------------|--------------------------------------------|---------------------|
| `MONGO_URI` | `mongodb://127.0.0.1:27017/nutrisetu`      | MongoDB connection  |
| `PORT`      | `5000`                                     | Server port         |

---

## 📊 Food Database

The seed file contains **1000 authentic Indian food items** including:
- **Breakfast**: Idli varieties, Dosa varieties, Paratha, Poha, Upma, eggs, beverages, fruits
- **Lunch**: Dal-rice combos, sabzis, biryanis, thalis, chaat, regional dishes
- **Dinner**: Curries, biryanis, kebabs, soups, raita, sweets
- **Snacks**: Pakoras, chaat items, namkeen, sweets, healthy drinks

Each item has: `name`, `type` (vegan/vegetarian/non-vegetarian), `protein`, `carbs`, `fats`, `calories`, `cost` (₹), `studentFriendly`

---

## 🔗 API Endpoints

| Method | Endpoint             | Description                        |
|--------|----------------------|------------------------------------|
| GET    | `/api/user`          | Get user profile                   |
| POST   | `/api/user`          | Create/replace user profile        |
| PATCH  | `/api/user/diet`     | Update diet type only              |
| DELETE | `/api/user`          | Delete user + all logs             |
| GET    | `/api/foods`         | Get all foods                      |
| GET    | `/api/logs`          | Get today's food logs              |
| POST   | `/api/logs`          | Add a food log entry               |
| DELETE | `/api/logs/:id`      | Delete a log entry                 |
| GET    | `/api/logs/history`  | Get calorie history (last N days)  |

---

## 🗑️ Files Removed (from original)

The following unnecessary files have been removed from this clean version:
- `seed_usda.js` — USDA CSV-based seeder (replaced by Indian food seed)
- `seed_usda_csv.js` — Duplicate USDA seeder
- `test.js` — Manual test file
- `test_usda.js` — USDA test file
- `usda_data/` — USDA CSV dataset folder (~40MB)
- `New WinRAR ZIP archive.zip` — Stray zip file
- `node_modules/` — Install via `npm install`

---

*Nutritional values based on IFCT 2017 / NIN India data.*
