// server/court-server.js
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config.env") });

const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const mongoose = require("mongoose");

// ==== 1) Connect Mongo ====
const DB = process.env.DATABASE_URL || "mongodb://127.0.0.1:27017/grpcdemo";
mongoose.set("strictQuery", true);
mongoose
  .connect(DB, { dbName: new URL(DB).pathname.replace(/^\//, "") || "grpcdemo" })
  .then(() => console.log("✅ Connected to MongoDB (Court Service)"))
  .catch((err) => {
    console.error("❌ Mongo connect error:", err.message);
    process.exit(1);
  });

// ==== 2) Define Model ====
const courtSchema = new mongoose.Schema(
  {
    id: { type: String, index: true, unique: true, required: true },
    name: { type: String, required: true },
    location: { type: String, required: true },
    type: { type: String, required: true }, // Basketball, Football, Tennis, etc.
    capacity: { type: Number, required: true, min: 1 },
    pricePerHour: { type: Number, required: true, min: 0 },
    description: { type: String, default: "" },
    facilities: { type: [String], default: [] },
    available: { type: Boolean, default: true },
    createdBy: { type: String, required: true },
  },
  { collection: "courts", timestamps: true }
);
const Court = mongoose.model("Court", courtSchema);

// ==== 3) Load proto ====
const PROTO_PATH = path.join(__dirname, "..", "courts.proto");
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const courtProto = grpc.loadPackageDefinition(packageDefinition);

// Helper: generate UUID v4
const crypto = require("crypto");
const uuidv4 = () =>
  ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ (crypto.randomBytes(1)[0] & (15 >> (c / 4)))).toString(16)
  );

// ==== 4) gRPC Server impl ====
const server = new grpc.Server();

server.addService(courtProto.CourtService.service, {
  // Get All Courts
  async getAllCourts(_, callback) {
    try {
      const list = await Court.find().sort({ _id: -1 }).lean();
      callback(null, { courts: list });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: err.message });
    }
  },

  // Get Court Details
  async getCourtDetails(call, callback) {
    try {
      const doc = await Court.findOne({ id: call.request.id }).lean();
      if (!doc)
        return callback({ code: grpc.status.NOT_FOUND, details: "Court not found" });
      callback(null, doc);
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: err.message });
    }
  },

  // Create Court
  async createCourt(call, callback) {
    try {
      const payload = call.request;
      const doc = await Court.create({
        id: uuidv4(),
        name: payload.name,
        location: payload.location,
        type: payload.type,
        capacity: payload.capacity,
        pricePerHour: payload.pricePerHour,
        description: payload.description || "",
        facilities: payload.facilities || [],
        available: payload.available !== false,
        createdBy: payload.createdBy || "admin",
      });
      callback(null, {
        id: doc.id,
        name: doc.name,
        location: doc.location,
        type: doc.type,
        capacity: doc.capacity,
        pricePerHour: doc.pricePerHour,
        description: doc.description,
        facilities: doc.facilities,
        available: doc.available,
        createdBy: doc.createdBy,
        createdAt: doc.createdAt?.toISOString() || ""
      });
    } catch (err) {
      callback({ code: grpc.status.INVALID_ARGUMENT, details: err.message });
    }
  },

  // Delete Court
  async deleteCourt(call, callback) {
    try {
      const del = await Court.deleteOne({ id: call.request.id });
      if (!del.deletedCount)
        return callback({ code: grpc.status.NOT_FOUND, details: "Court not found" });
      callback(null, {});
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: err.message });
    }
  },

  // Search Courts By Name
  async searchCourtsByName(call, callback) {
    try {
      const query = call.request.query || "";
      const regex = new RegExp(query, "i");
      const courts = await Court.find({ name: regex }).lean();
      callback(null, { courts });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: err.message });
    }
  },

  // Search Courts By Location
  async searchCourtsByLocation(call, callback) {
    try {
      const query = call.request.query || "";
      const regex = new RegExp(query, "i");
      const courts = await Court.find({ location: regex }).lean();
      callback(null, { courts });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: err.message });
    }
  },

  // Filter Courts
  async filterCourts(call, callback) {
    try {
      const { type, minCapacity, maxCapacity, maxPrice, availableOnly } = call.request;
      let filter = {};

      if (type) filter.type = type;
      if (minCapacity) filter.capacity = { ...filter.capacity, $gte: minCapacity };
      if (maxCapacity) filter.capacity = { ...filter.capacity, $lte: maxCapacity };
      if (maxPrice) filter.pricePerHour = { $lte: maxPrice };
      if (availableOnly) filter.available = true;

      const courts = await Court.find(filter).lean();
      callback(null, { courts });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: err.message });
    }
  },
});

const HOST = process.env.COURT_GRPC_HOST || "127.0.0.1";
const PORT = process.env.COURT_GRPC_PORT || "30044";
server.bindAsync(`${HOST}:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error("❌ Failed to bind Court gRPC server:", err.message);
    process.exit(1);
  }
  console.log(`🏟️ gRPC Court Server (Mongo) at ${HOST}:${port}`);
});
