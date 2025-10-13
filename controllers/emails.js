const EmailToken = require("../models/EmailTokens");
const User = require("../models/User");

exports.confirmEmailChange = async (req, res) => {
  try {
    const { token } = req.query;

    const record = await EmailToken.findOne({ token });

    if (!record || record.expiresAt < new Date()) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired token." });
    }
    const updatedField = {
      email: record.email,
      ...(record.pendingUpdate || {}),
    };
    await User.findByIdAndUpdate(record.user, updatedField, {
      new: true,
      runValidators: true,
    });

    await EmailToken.deleteOne({ _id: record._id });

    res
      .status(200)
      .json({ success: true, message: "Email updated successfully." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};
