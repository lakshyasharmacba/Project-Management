
import express from "express";
import { handleClerkWebhook } from "../controllers/webhookController.js";

const webhookRouter = express.Router();

webhookRouter.post(
    "/clerk",
    express.raw({ type: "application/json" }),
    handleClerkWebhook
);

export default webhookRouter;
