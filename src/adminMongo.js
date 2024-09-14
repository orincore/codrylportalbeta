const mongoose = require("mongoose");

mongoose.connect("mongodb+srv://asuradkar:prasenjeet1@codryl.oogie.mongodb.net/LoginFormPractice", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log('Mongoose connected');
})
.catch((e) => {
    console.log('Connection failed', e);
});

const adminSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    }
});

const AdminCollection = mongoose.model('AdminCollection', adminSchema);

module.exports = AdminCollection;
