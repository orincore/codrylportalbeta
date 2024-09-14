const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb+srv://asuradkar:prasenjeet1@codryl.oogie.mongodb.net/LoginFormPractice', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log('Mongoose connected');
})
.catch((e) => {
    console.log('Connection failed', e);
});

// Define the schema
const logInSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true
    },
    middleName: {
        type: String
    },
    lastName: {
        type: String,
        required: true
    },
    dob: {
        type: Date,
        required: true
    },
    doj: {
        type: Date,
        required: true
    },
    employeeId: {
        type: Number,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    aadhar: {
        type: String,
        required: true
    },
    pan: {
        type: String,
        required: true
    },
    nationality: {
        type: String,
        required: true
    },
    profilePic: {
        type: String // URL or file path to the profile picture
    }
});

// Create the model
const LogInCollection = mongoose.model('LogInCollection', logInSchema);

module.exports = LogInCollection;
