
import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import ExcelJS from "exceljs";

dotenv.config();
const router = express.Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8001";
const normalizeBaseUrl = (value) => String(value || "").replace(/\/+$/, "");

const autosizeWorksheet = (worksheet) => {
  worksheet.columns?.forEach((column) => {
    let maxLength = 12;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell?.value;
      const length = value === null || value === undefined ? 0 : String(value).length;
      if (length > maxLength) maxLength = length;
    });
    column.width = Math.min(40, maxLength + 2);
  });
};

router.get("/gradio", async (req, res) => {
  try {
    res.redirect(`${normalizeBaseUrl(AI_SERVICE_URL)}/gradio`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/health", async (req, res) => {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/health`);
    res.json(response.data);
  } catch (error) {
    res.status(503).json({ status: "unavailable", error: error.message });
  }
});

router.post("/focus/analyze-frame", async (req, res) => {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/focus/analyze-frame`,
      req.body
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/focus/record/start", async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/focus/record/start`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/focus/record/stop", async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/focus/record/stop`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/focus/record/clear", async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/focus/record/clear`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/focus/record/status", async (req, res) => {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/focus/record/status`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/focus/record/export", async (req, res) => {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/focus/record/status`);
    const workbook = new ExcelJS.Workbook();
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const statusText = String(response.data?.status || "");
    const eventRows = Array.isArray(response.data?.events) ? response.data.events : [];
    const summaryRows = Array.isArray(response.data?.summary) ? response.data.summary : [];

    const sessionSheet = workbook.addWorksheet("session_info");
    sessionSheet.addRow(["field", "value"]);
    sessionSheet.addRow(["recording_status", statusText]);
    sessionSheet.addRow(["is_recording", Boolean(response.data?.is_recording)]);
    sessionSheet.addRow(["total_events", eventRows.length]);
    sessionSheet.getRow(1).font = { bold: true };
    autosizeWorksheet(sessionSheet);

    const eventsSheet = workbook.addWorksheet("events");
    eventsSheet.addRow(["timestamp", "id", "label", "status", "confidence"]);
    eventRows.forEach((row) => {
      eventsSheet.addRow(Array.isArray(row) ? row : [
        row?.timestamp || "",
        row?.id || "",
        row?.label || "",
        row?.status || "",
        Number(row?.confidence || 0),
      ]);
    });
    eventsSheet.getRow(1).font = { bold: true };
    autosizeWorksheet(eventsSheet);

    const summarySheet = workbook.addWorksheet("summary");
    summarySheet.addRow(["id", "label", "focused", "not_focused", "total", "first_seen", "last_seen"]);
    summaryRows.forEach((row) => {
      summarySheet.addRow(Array.isArray(row) ? row : [
        row?.id || "",
        row?.label || "",
        Number(row?.focused || 0),
        Number(row?.notFocused || row?.not_focused || 0),
        Number(row?.total || 0),
        row?.firstSeen || row?.first_seen || "",
        row?.lastSeen || row?.last_seen || "",
      ]);
    });
    summarySheet.getRow(1).font = { bold: true };
    autosizeWorksheet(summarySheet);

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="focus-record-${timestamp}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/focus/reset", async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/focus/reset`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
