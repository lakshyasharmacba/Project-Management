import { Inngest } from "inngest";
import prisma from "../configs/prisma.js";
import sendEmail from "../configs/nodemailer.js";

export const inngest = new Inngest({
    id: "project-management",
});

// ---------- Helper Functions ----------

const getUserEmail = (data) => {
    const emails = data?.email_addresses || [];

    return (
        emails.find(
            (item) => item.id === data?.primary_email_address_id
        )?.email_address ||
        emails[0]?.email_address ||
        null
    );
};

const getUserName = (data) => {
    return (
        [data?.first_name, data?.last_name]
            .filter(Boolean)
            .join(" ") ||
        data?.username ||
        getUserEmail(data)?.split("@")[0] ||
        "User"
    );
};

// ---------- User Creation ----------

const syncUserCreation = inngest.createFunction(
    { id: "sync-user-from-clerk" },
    { event: "clerk/user.created" },
    async ({ event }) => {
        const { data } = event;

        const email = getUserEmail(data);

        if (!email) {
            console.error(
                `User ${data.id} has no email address. Database sync skipped.`
            );
            return;
        }

        await prisma.user.upsert({
            where: {
                id: data.id,
            },
            update: {
                email,
                name: getUserName(data),
                image: data?.image_url || "",
            },
            create: {
                id: data.id,
                email,
                name: getUserName(data),
                image: data?.image_url || "",
            },
        });

        console.log(`User ${data.id} synced successfully.`);
    }
);

// ---------- User Deletion ----------

const syncUserDeletion = inngest.createFunction(
    { id: "delete-user-with-clerk" },
    { event: "clerk/user.deleted" },
    async ({ event }) => {
        const { data } = event;

        await prisma.user.deleteMany({
            where: {
                id: data.id,
            },
        });

        console.log(`User ${data.id} deleted successfully.`);
    }
);

// ---------- User Updation ----------

const syncUserUpdation = inngest.createFunction(
    { id: "update-user-from-clerk" },
    { event: "clerk/user.updated" },
    async ({ event }) => {
        const { data } = event;

        const email = getUserEmail(data);

        if (!email) {
            console.error(
                `User ${data.id} has no email address. Update skipped.`
            );
            return;
        }

        await prisma.user.upsert({
            where: {
                id: data.id,
            },
            update: {
                email,
                name: getUserName(data),
                image: data?.image_url || "",
            },
            create: {
                id: data.id,
                email,
                name: getUserName(data),
                image: data?.image_url || "",
            },
        });

        console.log(`User ${data.id} updated successfully.`);
    }
);

// ---------- Workspace Creation ----------

const syncWorkspaceCreation = inngest.createFunction(
    { id: "sync-workspace-from-clerk" },
    { event: "clerk/organization.created" },
    async ({ event }) => {
        const { data } = event;

        if (!data.created_by) {
            console.error(`Workspace ${data.id} has no created_by user ID.`);
            return;
        }

        await prisma.user.upsert({
            where: {
                id: data.created_by,
            },
            update: {},
            create: {
                id: data.created_by,
                email: `${data.created_by}@placeholder.local`,
                name: "User",
                image: "",
            },
        });

        await prisma.workspace.upsert({
            where: {
                id: data.id,
            },
            update: {
                name: data.name,
                slug: data.slug,
                image_url: data.image_url || "",
            },
            create: {
                id: data.id,
                name: data.name,
                slug: data.slug,
                ownerId: data.created_by,
                image_url: data.image_url || "",
            },
        });

        await prisma.workspaceMember.upsert({
            where: {
                userId_workspaceId: {
                    userId: data.created_by,
                    workspaceId: data.id,
                },
            },
            update: {
                role: "ADMIN",
            },
            create: {
                userId: data.created_by,
                workspaceId: data.id,
                role: "ADMIN",
            },
        });

        console.log(`Workspace ${data.id} synced successfully.`);
    }
);

// ---------- Workspace Updation ----------

const syncWorkspaceUpdation = inngest.createFunction(
    { id: "update-workspace-from-clerk" },
    { event: "clerk/organization.updated" },
    async ({ event }) => {
        const { data } = event;

        await prisma.workspace.update({
            where: {
                id: data.id,
            },
            data: {
                name: data.name,
                slug: data.slug,
                image_url: data.image_url || "",
            },
        });

        console.log(`Workspace ${data.id} updated successfully.`);
    }
);

// ---------- Workspace Deletion ----------

const syncWorkspaceDeletion = inngest.createFunction(
    { id: "delete-workspace-with-clerk" },
    { event: "clerk/organization.deleted" },
    async ({ event }) => {
        const { data } = event;

        await prisma.workspace.deleteMany({
            where: {
                id: data.id,
            },
        });

        console.log(`Workspace ${data.id} deleted successfully.`);
    }
);

// ---------- Workspace Member Creation ----------

const syncWorkspaceMemberCreation = inngest.createFunction(
    { id: "sync-workspace-member-from-clerk" },
    { event: "clerk/organizationInvitation.accepted" },
    async ({ event }) => {
        const { data } = event;

        if (!data.user_id) {
            console.error(
                `Invitation for organization ${data.organization_id} has no user_id. Member sync skipped.`
            );
            return;
        }

        const role = String(data.role_name || data.role || "")
            .toLowerCase()
            .includes("admin")
            ? "ADMIN"
            : "MEMBER";

        await prisma.user.upsert({
            where: {
                id: data.user_id,
            },
            update: {},
            create: {
                id: data.user_id,
                email: `${data.user_id}@placeholder.local`,
                name: "User",
                image: "",
            },
        });

        await prisma.workspaceMember.upsert({
            where: {
                userId_workspaceId: {
                    userId: data.user_id,
                    workspaceId: data.organization_id,
                },
            },
            update: {
                role,
            },
            create: {
                userId: data.user_id,
                workspaceId: data.organization_id,
                role,
            },
        });

        console.log(`Workspace member ${data.user_id} synced successfully.`);
    }
);

// ---------- Task Assignment Email ----------

const sendTaskAssignmentEmail = inngest.createFunction(
    { id: "send-task-assignment-mail" },
    { event: "app/task.assigned" },
    async ({ event, step }) => {
        const { taskId, origin } = event.data;

        const task = await step.run("fetch-task", async () => {
            return prisma.task.findUnique({
                where: {
                    id: taskId,
                },
                include: {
                    assignee: true,
                    project: true,
                },
            });
        });

        // The task was deleted or is unassigned -> do not send an email
        if (!task || !task.assignee) {
            console.error(`Task ${taskId} not found or has no assignee.`);
            return;
        }

        // Wrapped in step.run so the email is not re-sent after the sleep below
        await step.run("send-assignment-email", async () => {
            await sendEmail({
                to: task.assignee.email,
                subject: `New Task Assignment in ${task.project.name}`,
                body: `
                <div style="max-width: 600px;">
                    <h2>Hi ${task.assignee.name}, 👋</h2>

                    <p style="font-size: 16px;">
                        You've been assigned a new task:
                    </p>

                    <p style="font-size: 18px; font-weight: bold; color: #007bff; margin: 8px 0;">
                        ${task.title}
                    </p>

                    <div style="border: 1px solid #ddd; padding: 12px 16px; border-radius: 6px; margin-bottom: 30px;">
                        <p style="margin: 6px 0;">
                            <strong>Description:</strong> ${task.description || ""}
                        </p>

                        <p style="margin: 6px 0;">
                            <strong>Due Date:</strong>
                            ${new Date(task.due_date).toLocaleDateString()}
                        </p>
                    </div>

                    <a href="${origin}" style="background-color: #007bff; padding: 12px 24px; border-radius: 5px; color: #fff; font-weight: 600; font-size: 16px; text-decoration: none;">
                        View Task
                    </a>

                    <p style="margin-top: 20px; font-size: 14px; color: #6c757d;">
                        Please make sure to review and complete it before the due date.
                    </p>
                </div>
            `,
            });
        });

        // Send reminder if task due date is not today

        if (
            new Date(task.due_date).toDateString() !==
            new Date().toDateString()
        ) {
            await step.sleepUntil(
                "wait-for-the-due-date",
                new Date(task.due_date)
            );

            await step.run("check-if-task-is-completed", async () => {
                const updatedTask = await prisma.task.findUnique({
                    where: {
                        id: taskId,
                    },
                    include: {
                        assignee: true,
                        project: true,
                    },
                });

                if (!updatedTask || !updatedTask.assignee) return;

                if (updatedTask.status !== "DONE") {
                    await sendEmail({
                        to: updatedTask.assignee.email,
                        subject: `Reminder for ${updatedTask.project.name}`,
                        body: `
                <div style="max-width: 600px;">
                    <h2>Hi ${updatedTask.assignee.name}, 👋</h2>

                    <p style="font-size: 16px;">
                        You have a task due in ${updatedTask.project.name}:
                    </p>

                    <p style="font-size: 18px; font-weight: bold; color: #007bff; margin: 8px 0;">
                        ${updatedTask.title}
                    </p>

                    <div style="border: 1px solid #ddd; padding: 12px 16px; border-radius: 6px; margin-bottom: 30px;">
                        <p style="margin: 6px 0;">
                            <strong>Description:</strong> ${updatedTask.description || ""}
                        </p>

                        <p style="margin: 6px 0;">
                            <strong>Due Date:</strong>
                            ${new Date(updatedTask.due_date).toLocaleDateString()}
                        </p>
                    </div>

                    <a href="${origin}" style="background-color: #007bff; padding: 12px 24px; border-radius: 5px; color: #fff; font-weight: 600; font-size: 16px; text-decoration: none;">
                        View Task
                    </a>

                    <p style="margin-top: 20px; font-size: 14px; color: #6c757d;">
                        Please make sure to review and complete it before the due date.
                    </p>
                </div>
            `,
                    });
                }
            });
        }
    }
);

// ---------- Task Completed Email (to the project lead) ----------

const sendTaskCompletedEmail = inngest.createFunction(
    { id: "send-task-completed-mail" },
    { event: "app/task.completed" },
    async ({ event, step }) => {
        const { taskId, origin } = event.data;

        await step.run("notify-project-lead", async () => {
            const task = await prisma.task.findUnique({
                where: { id: taskId },
                include: {
                    assignee: true,
                    project: { include: { owner: true } },
                },
            });

            const lead = task?.project?.owner;
            if (!task || !lead || lead.email.endsWith("@placeholder.local")) return;

            await sendEmail({
                to: lead.email,
                subject: `Task completed in ${task.project.name}`,
                body: `
                <div style="max-width: 600px;">
                    <h2>Hi ${lead.name}, ✅</h2>
                    <p style="font-size: 16px;">
                        <strong>${task.assignee?.name || "A team member"}</strong> has completed a task:
                    </p>
                    <p style="font-size: 18px; font-weight: bold; color: #16a34a; margin: 8px 0;">
                        ${task.title}
                    </p>
                    <p style="margin: 6px 0;"><strong>Project:</strong> ${task.project.name}</p>
                    <a href="${origin}" style="background-color: #16a34a; padding: 12px 24px; border-radius: 5px; color: #fff; font-weight: 600; text-decoration: none;">
                        View Project
                    </a>
                </div>
            `,
            });
        });
    }
);

// ---------- Project Completed Email (to the lead and all workspace admins) ----------

const sendProjectCompletedEmail = inngest.createFunction(
    { id: "send-project-completed-mail" },
    { event: "app/project.completed" },
    async ({ event, step }) => {
        const { projectId, origin } = event.data;

        await step.run("notify-admins", async () => {
            const project = await prisma.project.findUnique({
                where: { id: projectId },
                include: {
                    owner: true,
                    workspace: {
                        include: {
                            members: { where: { role: "ADMIN" }, include: { user: true } },
                        },
                    },
                },
            });

            if (!project) return;

            // Lead + every workspace admin, without duplicates and without placeholder emails
            const admins = new Map();
            [project.owner, ...project.workspace.members.map((m) => m.user)].forEach((u) => {
                if (u && !u.email.endsWith("@placeholder.local")) admins.set(u.email, u);
            });

            for (const admin of admins.values()) {
                await sendEmail({
                    to: admin.email,
                    subject: `All work is done in ${project.name}`,
                    body: `
                <div style="max-width: 600px;">
                    <h2>Hi ${admin.name}, 🎉</h2>
                    <p style="font-size: 16px;">
                        All members have completed their work in the project:
                    </p>
                    <p style="font-size: 18px; font-weight: bold; color: #16a34a; margin: 8px 0;">
                        ${project.name}
                    </p>
                    <a href="${origin}" style="background-color: #16a34a; padding: 12px 24px; border-radius: 5px; color: #fff; font-weight: 600; text-decoration: none;">
                        View Project
                    </a>
                </div>
            `,
                });
            }
        });
    }
);

// ---------- Export All Inngest Functions ----------

export const functions = [
    syncUserCreation,
    syncUserDeletion,
    syncUserUpdation,
    syncWorkspaceCreation,
    syncWorkspaceUpdation,
    syncWorkspaceDeletion,
    syncWorkspaceMemberCreation,
    sendTaskAssignmentEmail,
    sendTaskCompletedEmail,
    sendProjectCompletedEmail,
];