const mongoose = require('mongoose')
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const UserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Please add a name"],
        },
        email: {
            type: String,
            required: [true, "Please add an email"],
            unique: true,
            match: [
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
            "Please add a valid email",
            ],
        },
        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user",
        },
        password: {
            type: String,
            required: [true, "Please add a password"],
            minlength: 6,
            select: false,
        },
        telephoneNumber: {
            type: String,
            required: [true, "Please add phoneNumber"],
            match: [/^0[689]\d{8}$/, "Please enter a valid Thai phone number"],
        },
        resetPasswordToken: String,
        resetPasswordExpire: Date,
        createdAt: {
            type: Date,
            default: Date.now,
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        profilePicture: {
            type: String,
            default: "",
        },
        verificationToken: String,
        verificationExpires: Date,
    },
    {
      toJSON: { virtuals: true },
      toObject: { virtuals: true },
    }
)

//Encrypt password before saving
UserSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
  
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  });
  
//Generate JWT Token
UserSchema.methods.getSignedJwtToken = function () {
    return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE,
    });
};

//Match entered password to hashed password
UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

//Generate Email Verification Token
UserSchema.methods.generateVerificationToken = function () {
    const verificationToken = jwt.sign(
        { id: this._id, email: this.email },
        process.env.JWT_SECRET,
        { expiresIn: "1h" },
    );

    this.verificationToken = verificationToken;
    this.verificationExpires = Date.now() + 3600000; // 1 hour
    return verificationToken;
};

module.exports = mongoose.model('User', UserSchema)