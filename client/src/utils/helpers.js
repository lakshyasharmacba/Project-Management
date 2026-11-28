import { format } from "date-fns";

// Display name from the Clerk user: full name -> first name -> username -> email prefix
export const getDisplayName = (user) =>
    user?.fullName ||
    user?.firstName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "there";

// <input type="date"> needs "yyyy-MM-dd". Safe even when the date is null.
export const toInputDate = (date) => (date ? format(new Date(date), "yyyy-MM-dd") : "");

// Is the task overdue? (due date has passed and it is not Done)
export const isOverdue = (task) =>
    Boolean(task.due_date) && task.status !== "DONE" && new Date(task.due_date) < new Date();
