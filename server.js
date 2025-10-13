const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");

dotenv.config({ path: "./config/config.env" });

connectDB();

const auth = require("./routes/auth");
const emails = require("./routes/emails");
const users = require("./routes/users");

const app = express();
const mongoSanitize = require("express-mongo-sanitize");

app.use(express.json());
app.use(cookieParser());
//app.use(mongoSanitize());

app.use((req, res, next) => {
    if (req.body) mongoSanitize.sanitize(req.body);
    if (req.params) mongoSanitize.sanitize(req.params);
  
    // Express 5: req.query is a getter, so we sanitize a copy
    if (req.query) {
      const sanitizedQuery = mongoSanitize.sanitize({ ...req.query });
      Object.assign(req.query, sanitizedQuery);
    }
  
    next();
});

app.use(
  cors({
    origin: "http://localhost:5173",

    credentials: true,
  }),
);

app.use("/api/v1/auth", auth);
app.use("/api/v1/emails", emails);
app.use("/api/v1/users", users);

const PORT = process.env.PORT || 5000;

const server = app.listen(
  PORT,
  console.log("Server running in ", process.env.NODE_ENV, "mode on port", PORT),
);

process.on("unhandledRejection", (err, promise) => {
  console.log(`Error: ${err.message}`);
  server.close(() => process.exit(1));
});
