import { useAuth } from "@clerk/react";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";
import api from "../configs/api";
import { removeProject } from "../features/workspaceSlice";

// Returns a function that deletes a project (asks for confirmation first).
// The function returns true when the project was deleted.
export default function useDeleteProject() {
    const { getToken } = useAuth();
    const dispatch = useDispatch();

    return async (project) => {
        const confirmed = window.confirm(
            `Delete "${project.name}"? All its tasks and comments will be deleted permanently.`
        );
        if (!confirmed) return false;

        try {
            toast.loading("Deleting project...");
            await api.delete(`/api/projects/${project.id}`, {
                headers: { Authorization: `Bearer ${await getToken()}` },
            });
            dispatch(removeProject(project.id));
            toast.dismissAll();
            toast.success("Project deleted successfully");
            return true;
        } catch (error) {
            toast.dismissAll();
            toast.error(error?.response?.data?.message || error.message);
            return false;
        }
    };
}
