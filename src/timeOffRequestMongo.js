const mongoose = require("mongoose");

const timeOffRequestSchema = new mongoose.Schema({
    employeeId: {
        type: String,
        required: true
    },
    startDate: {
        type: Date, // Ensure this is a Date object
        required: true
    },
    endDate: {
        type: Date, // Ensure this is a Date object
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true,
        enum: ['Pending', 'Approved', 'Denied'],
        default: 'Pending'
    }
});

const TimeOffRequestCollection = mongoose.model('TimeOffRequestCollection', timeOffRequestSchema);

module.exports = TimeOffRequestCollection;
