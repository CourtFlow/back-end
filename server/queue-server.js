// server/queue-server.js
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
  .then(() => console.log("✅ Connected to MongoDB (Queue Service)"))
  .catch((err) => {
    console.error("❌ Mongo connect error:", err.message);
    process.exit(1);
  });

// ==== 2) Define Model ====
const queueSchema = new mongoose.Schema(
  {
    courtId: { type: String, required: true, index: true },
    courtName: { type: String, required: true },
    users: [
      {
        userId: { type: String, required: true },
        userName: { type: String, required: true },
        teamId: { type: String, default: "" },
        position: { type: Number, required: true },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { collection: "queues", timestamps: true }
);
const Queue = mongoose.model("Queue", queueSchema);

// ==== 3) Load proto ====
const QUEUE_PROTO_PATH = path.join(__dirname, "..", "queues.proto");
const queuePackageDef = protoLoader.loadSync(QUEUE_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const queueProto = grpc.loadPackageDefinition(queuePackageDef);

// Load Court proto to get court details
const COURT_PROTO_PATH = path.join(__dirname, "..", "courts.proto");
const courtPackageDef = protoLoader.loadSync(COURT_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const courtProto = grpc.loadPackageDefinition(courtPackageDef);

// gRPC client for Court Service
const COURT_GRPC_TARGET = `${process.env.COURT_GRPC_HOST || "127.0.0.1"}:${process.env.COURT_GRPC_PORT || "30044"}`;
const courtClient = new courtProto.CourtService(COURT_GRPC_TARGET, grpc.credentials.createInsecure());

// Mock Notification Service (will be implemented later)
function sendNotification(userId, message) {
  console.log(`📢 Notification to ${userId}: ${message}`);
  // In the future, this will call Notification Service
}

// ==== 4) gRPC Server impl ====
const server = new grpc.Server();

server.addService(queueProto.QueueService.service, {
  // Get All Queues
  async getAllQueues(_, callback) {
    try {
      const queues = await Queue.find().lean();
      const formattedQueues = queues.map(q => ({
        courtId: q.courtId,
        courtName: q.courtName,
        queueLength: q.users.length,
        users: q.users.map(u => ({
          userId: u.userId,
          userName: u.userName,
          teamId: u.teamId || "",
          position: u.position,
          joinedAt: u.joinedAt?.toISOString() || ""
        })),
        averageWaitTime: q.users.length * 30 // Estimate 30 min per person
      }));
      callback(null, { queues: formattedQueues });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: err.message });
    }
  },

  // Get Queue Status For Court
  async getQueueStatusForCourt(call, callback) {
    try {
      const courtId = call.request.id;
      let queue = await Queue.findOne({ courtId }).lean();

      if (!queue) {
        // Create empty queue if doesn't exist
        queue = { courtId, courtName: "Unknown Court", users: [] };
      }

      callback(null, {
        courtId: queue.courtId,
        courtName: queue.courtName,
        queueLength: queue.users?.length || 0,
        users: queue.users?.map(u => ({
          userId: u.userId,
          userName: u.userName,
          teamId: u.teamId || "",
          position: u.position,
          joinedAt: u.joinedAt?.toISOString() || ""
        })) || [],
        averageWaitTime: (queue.users?.length || 0) * 30
      });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: err.message });
    }
  },

  // Enter Court Queue
  async enterCourtQueue(call, callback) {
    try {
      const { courtId, userId, userName, teamId } = call.request;

      // Get court details from Court Service
      courtClient.getCourtDetails({ id: courtId }, async (err, court) => {
        if (err) {
          return callback({ code: grpc.status.NOT_FOUND, details: "Court not found" });
        }

        // Find or create queue for this court
        let queue = await Queue.findOne({ courtId });
        if (!queue) {
          queue = new Queue({
            courtId,
            courtName: court.name,
            users: [],
          });
        }

        // Check if user already in queue
        const existingUser = queue.users.find(u => u.userId === userId);
        if (existingUser) {
          return callback(null, {
            success: false,
            message: "You are already in the queue",
            position: existingUser.position,
            estimatedWaitTime: existingUser.position * 30
          });
        }

        // Add user to queue
        const position = queue.users.length + 1;
        queue.users.push({
          userId,
          userName,
          teamId: teamId || "",
          position,
          joinedAt: new Date()
        });

        await queue.save();

        // Send notification
        sendNotification(userId, `You joined the queue for ${court.name} at position ${position}`);

        callback(null, {
          success: true,
          message: "Successfully joined the queue",
          position,
          estimatedWaitTime: position * 30
        });
      });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: err.message });
    }
  },

  // Leave Court Queue
  async leaveCourtQueue(call, callback) {
    try {
      const { courtId, userId } = call.request;

      let queue = await Queue.findOne({ courtId });
      if (!queue) {
        return callback({ code: grpc.status.NOT_FOUND, details: "Queue not found" });
      }

      // Find user in queue
      const userIndex = queue.users.findIndex(u => u.userId === userId);
      if (userIndex === -1) {
        return callback(null, {
          success: false,
          message: "You are not in this queue",
          position: 0,
          estimatedWaitTime: 0
        });
      }

      // Remove user and update positions
      queue.users.splice(userIndex, 1);
      queue.users.forEach((u, idx) => {
        u.position = idx + 1;
      });

      await queue.save();

      // Send notification
      sendNotification(userId, `You left the queue for ${queue.courtName}`);

      callback(null, {
        success: true,
        message: "Successfully left the queue",
        position: 0,
        estimatedWaitTime: 0
      });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: err.message });
    }
  },
});

const HOST = process.env.QUEUE_GRPC_HOST || "127.0.0.1";
const PORT = process.env.QUEUE_GRPC_PORT || "30045";
server.bindAsync(`${HOST}:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error("❌ Failed to bind Queue gRPC server:", err.message);
    process.exit(1);
  }
  console.log(`⏱️  gRPC Queue Server (Mongo) at ${HOST}:${port}`);
});
