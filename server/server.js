// server/server.js  (MongoDB version)
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
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ Mongo connect error:", err.message);
    process.exit(1);
  });

// ==== 2) Define Model ====
const teamSchema = new mongoose.Schema(
  {
    id: { type: String, index: true, unique: true, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    members: { type: [String], default: [] },
    createdBy: { type: String, required: true },
  },
  { collection: "teams", timestamps: true }
);
const Team = mongoose.model("Team", teamSchema);

// ==== 3) Load proto ====
const PROTO_PATH = path.join(__dirname, "..", "teams.proto");
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const teamProto = grpc.loadPackageDefinition(packageDefinition);

// Helper: generate UUID v4 (no extra package)
const crypto = require("crypto");
const uuidv4 = () =>
  ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ (crypto.randomBytes(1)[0] & (15 >> (c / 4)))).toString(16)
  );

// ==== 4) gRPC Server impl (CRUD via Mongo) ====
const server = new grpc.Server();

server.addService(teamProto.TeamService.service, {
  // Get All Teams
  async getAllTeams(_, callback) {
    try {
      const list = await Team.find().sort({ _id: -1 }).lean();
      callback(null, { teams: list });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: err.message });
    }
  },

  // Get Team Details
  async getTeamDetails(call, callback) {
    try {
      const doc = await Team.findOne({ id: call.request.id }).lean();
      if (!doc)
        return callback({ code: grpc.status.NOT_FOUND, details: "Team not found" });
      callback(null, doc);
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: err.message });
    }
  },

  // Create Team
  async createTeam(call, callback) {
    try {
      const payload = call.request;
      const doc = await Team.create({
        id: uuidv4(),
        name: payload.name,
        description: payload.description || "",
        members: payload.members || [],
        createdBy: payload.createdBy || "system",
      });
      callback(null, {
        id: doc.id,
        name: doc.name,
        description: doc.description,
        members: doc.members,
        createdBy: doc.createdBy,
        createdAt: doc.createdAt?.toISOString() || ""
      });
    } catch (err) {
      callback({ code: grpc.status.INVALID_ARGUMENT, details: err.message });
    }
  },

  // Delete Team
  async deleteTeam(call, callback) {
    try {
      const del = await Team.deleteOne({ id: call.request.id });
      if (!del.deletedCount)
        return callback({ code: grpc.status.NOT_FOUND, details: "Team not found" });
      callback(null, {});
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: err.message });
    }
  },

  // Join Team
  async joinTeam(call, callback) {
    try {
      const { teamId, userId, userName } = call.request;
      const team = await Team.findOne({ id: teamId });

      if (!team)
        return callback({ code: grpc.status.NOT_FOUND, details: "Team not found" });

      // Check if user already in team
      if (team.members.includes(userName || userId)) {
        return callback(null, {
          success: false,
          message: "User already in team",
          team: {
            id: team.id,
            name: team.name,
            description: team.description,
            members: team.members,
            createdBy: team.createdBy,
            createdAt: team.createdAt?.toISOString() || ""
          }
        });
      }

      // Add user to team
      team.members.push(userName || userId);
      await team.save();

      callback(null, {
        success: true,
        message: "Successfully joined team",
        team: {
          id: team.id,
          name: team.name,
          description: team.description,
          members: team.members,
          createdBy: team.createdBy,
          createdAt: team.createdAt?.toISOString() || ""
        }
      });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: err.message });
    }
  },

  // Leave Team
  async leaveTeam(call, callback) {
    try {
      const { teamId, userId } = call.request;
      const team = await Team.findOne({ id: teamId });

      if (!team)
        return callback({ code: grpc.status.NOT_FOUND, details: "Team not found" });

      // Check if user is in team
      const index = team.members.indexOf(userId);
      if (index === -1) {
        return callback(null, {
          success: false,
          message: "User not in team",
          team: {
            id: team.id,
            name: team.name,
            description: team.description,
            members: team.members,
            createdBy: team.createdBy,
            createdAt: team.createdAt?.toISOString() || ""
          }
        });
      }

      // Remove user from team
      team.members.splice(index, 1);
      await team.save();

      callback(null, {
        success: true,
        message: "Successfully left team",
        team: {
          id: team.id,
          name: team.name,
          description: team.description,
          members: team.members,
          createdBy: team.createdBy,
          createdAt: team.createdAt?.toISOString() || ""
        }
      });
    } catch (err) {
      callback({ code: grpc.status.INTERNAL, details: err.message });
    }
  },
});

const HOST = process.env.GRPC_HOST || "127.0.0.1";
const PORT = process.env.GRPC_PORT || "30043";
server.bindAsync(`${HOST}:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error("❌ Failed to bind gRPC server:", err.message);
    process.exit(1);
  }
  console.log(`👥 gRPC Team Server (Mongo) at ${HOST}:${port}`);
});