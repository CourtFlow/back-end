const mongoose = require("mongoose");

const EmailTokenSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true },
  email: { type: String, required: true },
  token: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  pendingUpdate: { type: Object, default: {} },
});

module.exports = mongoose.model("EmailToken", EmailTokenSchema);
