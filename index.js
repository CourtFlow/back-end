// client/index.js
const path = require("path");
// Load env from back-end/config.env (this file sits in back-end/)
require("dotenv").config({ path: path.join(__dirname, "config.env") });

const express = require("express");
const bodyParser = require("body-parser");

const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

// Load Team proto
const TEAM_PROTO_PATH = path.join(__dirname, "teams.proto");
const teamPackageDef = protoLoader.loadSync(TEAM_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const teamProto = grpc.loadPackageDefinition(teamPackageDef);

// Load Court proto
const COURT_PROTO_PATH = path.join(__dirname, "courts.proto");
const courtPackageDef = protoLoader.loadSync(COURT_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const courtProto = grpc.loadPackageDefinition(courtPackageDef);

// Load Queue proto
const QUEUE_PROTO_PATH = path.join(__dirname, "queues.proto");
const queuePackageDef = protoLoader.loadSync(QUEUE_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const queueProto = grpc.loadPackageDefinition(queuePackageDef);

// gRPC clients
const TEAM_GRPC_TARGET = `${process.env.GRPC_HOST || "127.0.0.1"}:${process.env.GRPC_PORT || "30043"}`;
const COURT_GRPC_TARGET = `${process.env.COURT_GRPC_HOST || "127.0.0.1"}:${process.env.COURT_GRPC_PORT || "30044"}`;
const QUEUE_GRPC_TARGET = `${process.env.QUEUE_GRPC_HOST || "127.0.0.1"}:${process.env.QUEUE_GRPC_PORT || "30045"}`;

const teamClient = new teamProto.TeamService(TEAM_GRPC_TARGET, grpc.credentials.createInsecure());
const courtClient = new courtProto.CourtService(COURT_GRPC_TARGET, grpc.credentials.createInsecure());
const queueClient = new queueProto.QueueService(QUEUE_GRPC_TARGET, grpc.credentials.createInsecure());

// Express setup
const app = express();
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Home page - Landing page with all services
app.get("/", (req, res) => {
  res.render("index");
});

// Teams page - list all teams
app.get("/teams", (req, res) => {
  teamClient.getAllTeams({}, (err, resp) => {
    if (err) {
      console.error("getAllTeams error:", err);
      return res.status(500).send("gRPC error: " + err.details);
    }
    res.render("teams", { results: resp.teams || [] });
  });
});

// Courts page - list all courts with search
app.get("/courts", (req, res) => {
  const searchQuery = req.query.search || "";
  const searchType = req.query.searchType || "all";

  if (!searchQuery || searchType === "all") {
    // Get all courts
    courtClient.getAllCourts({}, (err, resp) => {
      if (err) {
        console.error("getAllCourts error:", err);
        return res.status(500).send("gRPC error: " + err.details);
      }
      res.render("courts", { results: resp.courts || [], searchQuery, searchType });
    });
  } else if (searchType === "name") {
    // Search by name
    courtClient.searchCourtsByName({ query: searchQuery }, (err, resp) => {
      if (err) return res.status(500).send("Search error: " + err.details);
      res.render("courts", { results: resp.courts || [], searchQuery, searchType });
    });
  } else if (searchType === "location") {
    // Search by location
    courtClient.searchCourtsByLocation({ query: searchQuery }, (err, resp) => {
      if (err) return res.status(500).send("Search error: " + err.details);
      res.render("courts", { results: resp.courts || [], searchQuery, searchType });
    });
  }
});

// JSON API: list all courts
app.get("/api/courts", (req, res) => {
  courtClient.getAllCourts({}, (err, resp) => {
    if (err) {
      console.error("getAllCourts error:", err);
      return res.status(500).json({ success: false, error: err.details || String(err) });
    }
    return res.json({ success: true, data: resp.courts || [] });
  });
});

// JSON API: court details
app.get("/api/courts/:id", (req, res) => {
  courtClient.getCourtDetails({ id: req.params.id }, (err, court) => {
    if (err) {
      const code = err.code === 5 ? 404 : 500; // NOT_FOUND => 5 in grpc-js
      return res.status(code).json({ success: false, error: err.details || String(err) });
    }
    return res.json({ success: true, data: court });
  });
});

// Queues page - list all queues
app.get("/queues", (req, res) => {
  queueClient.getAllQueues({}, (err, resp) => {
    if (err) {
      console.error("getAllQueues error:", err);
      return res.status(500).send("gRPC error: " + err.details);
    }
    // Also get all courts for the dropdown
    courtClient.getAllCourts({}, (courtErr, courtResp) => {
      if (courtErr) {
        return res.render("queues", { queues: resp.queues || [], courts: [] });
      }
      res.render("queues", { queues: resp.queues || [], courts: courtResp.courts || [] });
    });
  });
});

// ===== Team Service Routes =====

// Create Team
app.post("/teams/create", (req, res) => {
  const { name, description, createdBy } = req.body;

  teamClient.createTeam({ name, description: description || "", createdBy: createdBy || "system" }, (err) => {
    if (err) return res.status(500).send("Create error: " + err.details);
    res.redirect("/teams");
  });
});

// Delete Team
app.post("/teams/delete", (req, res) => {
  const id = req.body.team_id || req.body.id;
  teamClient.deleteTeam({ id }, (err) => {
    if (err) return res.status(500).send("Delete error: " + err.details);
    res.redirect("/teams");
  });
});

// Join Team
app.post("/teams/join", (req, res) => {
  const { teamId, userId, userName } = req.body;
  teamClient.joinTeam({ teamId, userId, userName }, (err, resp) => {
    if (err) return res.status(500).send("Join error: " + err.details);
    if (!resp.success) {
      return res.status(400).send(resp.message);
    }
    res.redirect("/teams");
  });
});

// Leave Team
app.post("/teams/leave", (req, res) => {
  const { teamId, userId } = req.body;
  teamClient.leaveTeam({ teamId, userId }, (err, resp) => {
    if (err) return res.status(500).send("Leave error: " + err.details);
    if (!resp.success) {
      return res.status(400).send(resp.message);
    }
    res.redirect("/teams");
  });
});

// ===== Court Service Routes =====

// Create Court
app.post("/courts/create", (req, res) => {
  const { name, location, type, capacity, pricePerHour, description, facilities, createdBy } = req.body;

  courtClient.createCourt({
    name,
    location,
    type,
    capacity: parseInt(capacity, 10) || 0,
    pricePerHour: parseFloat(pricePerHour) || 0,
    description: description || "",
    facilities: facilities ? facilities.split(",").map(f => f.trim()) : [],
    available: true,
    createdBy: createdBy || "admin"
  }, (err) => {
    if (err) return res.status(500).send("Create error: " + err.details);
    res.redirect("/courts");
  });
});

// Delete Court
app.post("/courts/delete", (req, res) => {
  const id = req.body.court_id || req.body.id;
  courtClient.deleteCourt({ id }, (err) => {
    if (err) return res.status(500).send("Delete error: " + err.details);
    res.redirect("/courts");
  });
});

// Filter Courts
app.post("/courts/filter", (req, res) => {
  const { type, minCapacity, maxCapacity, maxPrice, availableOnly } = req.body;

  courtClient.filterCourts({
    type: type || "",
    minCapacity: parseInt(minCapacity, 10) || 0,
    maxCapacity: parseInt(maxCapacity, 10) || 0,
    maxPrice: parseFloat(maxPrice) || 0,
    availableOnly: availableOnly === "on"
  }, (err, resp) => {
    if (err) return res.status(500).send("Filter error: " + err.details);
    res.render("courts", { results: resp.courts || [], filtered: true });
  });
});

// ===== Queue Service Routes =====

// Enter Queue
app.post("/queues/enter", (req, res) => {
  const { courtId, userId, userName, teamId } = req.body;

  queueClient.enterCourtQueue({
    courtId,
    userId,
    userName,
    teamId: teamId || ""
  }, (err, resp) => {
    if (err) return res.status(500).send("Enter queue error: " + err.details);
    if (!resp.success) {
      return res.status(400).send(resp.message);
    }
    res.redirect("/queues");
  });
});

// Leave Queue
app.post("/queues/leave", (req, res) => {
  const { courtId, userId } = req.body;

  queueClient.leaveCourtQueue({ courtId, userId }, (err, resp) => {
    if (err) return res.status(500).send("Leave queue error: " + err.details);
    if (!resp.success) {
      return res.status(400).send(resp.message);
    }
    res.redirect("/queues");
  });
});


