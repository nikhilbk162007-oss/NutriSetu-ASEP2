const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name:          { type: String, required: true, trim: true },
    age:           { type: Number, required: true, min: 1, max: 130 },
    gender:        { type: String, required: true, enum: ['male', 'female'] },
    height:        { type: Number, required: true, min: 50, max: 300 },
    weight:        { type: Number, required: true, min: 10, max: 500 },
    targetWeight:  { type: Number, required: true, min: 10, max: 500 },
    activityLevel: { type: String, required: true, enum: ['sedentary','lightly','moderately','very','extra'] },
    goal:          { type: String, required: true, enum: ['loss','maintenance','gain'] },
    // veg = vegetarian (dairy+eggs OK), vegan = plant-only, nonveg = all foods
    dietType:      { type: String, required: true, enum: ['veg','vegan','nonveg'], default: 'veg' },
    tdee:          { type: Number, required: true },
    calorieTarget: { type: Number, required: true },
    createdAt:     { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
