// ══════════════════════════════════════════════════════
//  routes/api.js  —  Rutas API del backend
//
//  El frontend usa Firebase directamente, pero estas rutas
//  pueden usarse para operaciones admin, webhooks, etc.
// ══════════════════════════════════════════════════════

const express = require("express");
const router  = express.Router();

// Ejemplo: health check
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Aquí puedes agregar:
// - router.post("/send-notification", ...)
// - router.get("/admin/stats", ...)
// etc.

module.exports = router;
