
import { Webhook } from "svix";
import { inngest } from "../inngest/index.js";

export const handleClerkWebhook = async (req, res) => {
    try {
        const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

        if (!webhookSecret) {
            return res.status(500).json({
                success: false,
                message: "Clerk webhook secret is missing",
            });
        }

        const payload = req.body;

        if (!Buffer.isBuffer(payload)) {
            return res.status(400).json({
                success: false,
                message: "Invalid webhook payload",
            });
        }

        const wh = new Webhook(webhookSecret);

        // Verify Clerk webhook signature
        wh.verify(payload, {
            "svix-id": req.headers["svix-id"],
            "svix-timestamp": req.headers["svix-timestamp"],
            "svix-signature": req.headers["svix-signature"],
        });

        // Parse verified payload separately
        const event = JSON.parse(payload.toString("utf8"));

        const eventMap = {
            "user.created": "clerk/user.created",
            "user.updated": "clerk/user.updated",
            "user.deleted": "clerk/user.deleted",
            "organization.created": "clerk/organization.created",
            "organization.updated": "clerk/organization.updated",
            "organization.deleted": "clerk/organization.deleted",
            "organizationInvitation.accepted": "clerk/organizationInvitation.accepted",
        };

        const inngestEvent = eventMap[event.type];

        if (!inngestEvent) {
            return res.status(200).json({
                success: true,
                message: `Event ${event.type} ignored`,
            });
        }

        await inngest.send({
            name: inngestEvent,
            data: event.data,
        });

        return res.status(200).json({
            success: true,
            message: "Clerk webhook processed successfully",
        });

    } catch (error) {
        console.error("Clerk Webhook Error:", error);

        return res.status(400).json({
            success: false,
            message: "Webhook verification or processing failed",
        });
    }
};
