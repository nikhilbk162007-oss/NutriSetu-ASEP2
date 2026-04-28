const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema({
    name:           { type: String, required: true, trim: true },
    type:           { type: String, required: true, enum: ['vegetarian','vegan','non-vegetarian'] },
    protein:        { type: Number, required: true },
    carbs:          { type: Number, required: true },
    fats:           { type: Number, required: true },
    calories:       { type: Number, required: true },
    cost:           { type: Number, required: true },
    studentFriendly:{ type: Boolean, default: true },
    category:       { type: String, required: true, enum: ['Breakfast','Lunch','Dinner','Snacks'] }
});

module.exports = mongoose.model('Food', foodSchema);
