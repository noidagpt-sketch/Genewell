import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleRegister, handleLogin, handleGetProfile } from "./routes/auth";
import {
  handleDNAUpload,
  handleGetAnalysisResults,
  handleGenerateReport,
} from "./routes/dna";
import { handleSubmitQuiz, handleGetQuizResults } from "./routes/quiz";
import { handleGetDashboard, handleGetProgressStats } from "./routes/dashboard";
import {
  handleWellnessQuizSubmission,
  handleWellnessPayment,
  handleWellnessDownload,
  handleProductDownload,
  handleWellnessPurchase,
  handlePDFDownload,
  handlePDFDownloadBase64,
  handleListUserPDFs,
  handleUserDashboard,
  handleStorageStats,
  handleSamplePDF,
  handleDownloadEvent,
} from "./routes/wellness";
import {
  handleCreatePaymentRequest,
  handleCreateDirectPaymentLink,
  handleVerifyPayment,
  handlePaymentWebhook,
  handleGetUserPurchases,
  handleSendReportEmail,
} from "./routes/payments";
import {
  requireAdmin,
  handleAdminLogin,
  handleAdminChangePassword,
  handleGetAllUsers,
  handleGetUserDetails,
  handleAdminDashboard,
  handleGetAllPurchases,
  handleGetQuizResponses,
  handleGetDownloads,
  handleGetEmailLogs,
  handleExportUsersCSV,
  handleExportExcel,
  handleGetTrafficData,
  handleGetProducts,
  handleCreateProduct,
  handleUpdateProduct,
  handleToggleProductVisibility,
  handleDeleteProduct,
  handleResendDownloadEmail,
} from "./routes/admin";
import { handleQuizCapture } from "./routes/quiz-capture";
import { handleTrackVisitor } from "./routes/visitor-tracking";
import narrativeRouter from "./routes/narrative";
import { initializeDatabase } from "./lib/db";
import { initializeEmailService } from "./lib/email-service";
import { startCleanupJob } from "./lib/storage";

async function initializeServices() {
  try {
    if (process.env.DATABASE_URL) {
      await initializeDatabase();
      console.log("Database initialized");
    }
    await initializeEmailService();
  } catch (error) {
    console.error("Error initializing services:", error);
  }
}

export function createServer() {
  const app = express();

  initializeServices().catch(console.error);
  startCleanupJob();

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.get("/api/ping", (_req, res) => {
    res.json({ message: "Hello from Express server v2!" });
  });

  app.get("/api/demo", handleDemo);

  app.post("/api/auth/register", handleRegister);
  app.post("/api/auth/login", handleLogin);
  app.get("/api/auth/profile", handleGetProfile);

  app.post("/api/dna/upload", handleDNAUpload);
  app.get("/api/dna/results", handleGetAnalysisResults);
  app.get("/api/dna/report", handleGenerateReport);

  app.post("/api/quiz/submit", handleSubmitQuiz);
  app.get("/api/quiz/results", handleGetQuizResults);

  app.get("/api/dashboard", handleGetDashboard);
  app.get("/api/dashboard/progress", handleGetProgressStats);

  app.post("/api/wellness/quiz", handleWellnessQuizSubmission);
  app.post("/api/wellness/purchase", handleWellnessPurchase);
  app.get("/api/wellness/download-pdf/:pdfRecordId", handlePDFDownload);
  app.get("/api/wellness/download-pdf-base64/:pdfRecordId", handlePDFDownloadBase64);
  app.get("/api/wellness/pdfs", handleListUserPDFs);
  app.get("/api/wellness/dashboard/:userId", handleUserDashboard);
  app.get("/api/wellness/stats", handleStorageStats);
  app.get("/api/wellness/sample-pdf", handleSamplePDF);

  app.post("/api/wellness/payment", handleWellnessPayment);
  app.get("/api/wellness/download/:analysisId", handleWellnessDownload);

  app.get("/api/products/download/:productId", handleProductDownload);

  app.post("/api/payments/create-payment-request", handleCreatePaymentRequest);
  app.post("/api/payments/create-direct-payment-link", handleCreateDirectPaymentLink);
  app.get("/api/payments/verify/:purchaseId", handleVerifyPayment);
  app.post("/api/payments/webhook", handlePaymentWebhook);
  app.get("/api/payments/user/:email", handleGetUserPurchases);
  app.post("/api/payments/send-report-email", handleSendReportEmail);

  app.post("/api/wellness/download-event", handleDownloadEvent);
  app.post("/api/quiz/capture", handleQuizCapture);

  app.post("/api/admin/login", handleAdminLogin);
  app.post("/api/admin/change-password", requireAdmin, handleAdminChangePassword);
  app.get("/api/admin/users", requireAdmin, handleGetAllUsers);
  app.get("/api/admin/users/:userId", requireAdmin, handleGetUserDetails);
  app.get("/api/admin/dashboard", requireAdmin, handleAdminDashboard);
  app.get("/api/admin/purchases", requireAdmin, handleGetAllPurchases);
  app.get("/api/admin/quiz-responses", requireAdmin, handleGetQuizResponses);
  app.get("/api/admin/downloads", requireAdmin, handleGetDownloads);
  app.get("/api/admin/email-logs", requireAdmin, handleGetEmailLogs);
  app.get("/api/admin/export/users-csv", requireAdmin, handleExportUsersCSV);
  app.get("/api/admin/export/excel", requireAdmin, handleExportExcel);
  app.get("/api/admin/traffic", requireAdmin, handleGetTrafficData);
  app.get("/api/admin/products", requireAdmin, handleGetProducts);
  app.post("/api/admin/products", requireAdmin, handleCreateProduct);
  app.put("/api/admin/products/:id", requireAdmin, handleUpdateProduct);
  app.post("/api/admin/products/:id/toggle-visibility", requireAdmin, handleToggleProductVisibility);
  app.delete("/api/admin/products/:id", requireAdmin, handleDeleteProduct);
  app.post("/api/admin/resend-download-email", requireAdmin, handleResendDownloadEmail);

  app.post("/api/track-visit", handleTrackVisitor);

  app.get("/api/data/summary", async (_req, res) => {
    try {
      const { query } = require('./lib/db');

      const usersResult = await query('SELECT COUNT(*) as count FROM users');
      const quizResult = await query('SELECT COUNT(*) as count FROM quiz_submissions');
      const purchasesResult = await query('SELECT COUNT(*) as count FROM purchases WHERE payment_status = $1', ['completed']);
      const downloadsResult = await query('SELECT COUNT(*) as count FROM downloads');

      res.json({
        totalUsers: parseInt(usersResult.rows[0]?.count || 0),
        totalQuizSubmissions: parseInt(quizResult.rows[0]?.count || 0),
        completedPurchases: parseInt(purchasesResult.rows[0]?.count || 0),
        totalDownloads: parseInt(downloadsResult.rows[0]?.count || 0),
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch data summary' });
    }
  });

  app.get("/api/data/recent-submissions", async (_req, res) => {
    try {
      const { query } = require('./lib/db');

      const result = await query(`
        SELECT
          id,
          user_email,
          user_age,
          user_gender,
          created_at
        FROM quiz_submissions
        ORDER BY created_at DESC
        LIMIT 20
      `);

      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch recent submissions' });
    }
  });

  app.get("/api/data/users", async (_req, res) => {
    try {
      const { query } = require('./lib/db');

      const result = await query(`
        SELECT
          id,
          email,
          name,
          age,
          gender,
          location,
          created_at
        FROM users
        LIMIT 50
      `);

      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.use(narrativeRouter);

  return app;
}
