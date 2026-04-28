const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    foodId:   { type: String },
    foodName: { type: String, required: true },
    calories: { type: Number, required: true },
    portions: { type: Number, required: true, min: 0.5 },
    type:     { type: String },
    date:     { type: Date, default: Date.now }
});

// Index on date for efficient daily filtering
logSchema.index({ date: 1 });

module.exports = mongoose.model('Log', logSchema);
