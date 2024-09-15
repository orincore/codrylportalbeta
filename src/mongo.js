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

// Define the schema for admin accounts
const adminSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    employeeId: {
        type: String,
        unique: true,
        required: true
    },
    role: {
        type: String,
        enum: ['admin'],
        default: 'admin',
        required: true
    },
    profilePic: {
        type: String,
        default: '/uploads/default-admin.jpg' // Default admin profile picture
    }
});

// Define the schema for manager accounts
const managerSchema = new mongoose.Schema({
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
        required: true,
        unique: true
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
        type: String,
        default: '/uploads/default-manager.jpg' // Default manager profile picture
    },
    employeeId: {
        type: String,
        unique: true,
        required: true
    },
    role: {
        type: String,
        enum: ['manager'],
        default: 'manager',
        required: true
    },
    designation: {
        type: String,
        required: true
    },
    assignedEmployees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeCollection' }] // Managers have assigned employees
});

// Define the schema for employee accounts
const employeeSchema = new mongoose.Schema({
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
        required: true,
        unique: true
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
        type: String,
        default: '/uploads/default-employee.jpg' // Default employee profile picture
    },
    employeeId: {
        type: String,
        unique: true,
        required: true
    },
    role: {
        type: String,
        enum: ['employee'],
        default: 'employee',
        required: true
    },
    designation: {
        type: String,
        required: true
    },
    manager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ManagerCollection'
    } // Reference to the employee's manager
});

// Define the counter schema for generating employee IDs
const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // The ID can be 'employeeId'
    seq: { type: Number, default: 20000000 } // Starting value
});

// Create models for admin, manager, employee, and counter
const AdminCollection = mongoose.model('AdminCollection', adminSchema);
const ManagerCollection = mongoose.model('ManagerCollection', managerSchema);
const EmployeeCollection = mongoose.model('EmployeeCollection', employeeSchema);
const Counter = mongoose.model('Counter', counterSchema);

// Export models
module.exports = {
    AdminCollection,
    ManagerCollection,
    EmployeeCollection,
    Counter
};
