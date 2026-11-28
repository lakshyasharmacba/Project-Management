import { useDispatch, useSelector } from "react-redux";
import { Plus, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { fetchWorkspaces } from "../features/workspaceSlice";
import api from "../configs/api";
import toast from "react-hot-toast";
import AddProjectMember from "./AddProjectMember";
import useProjectAccess, { getWorkers } from "../hooks/useProjectAccess";
import { toInputDate } from "../utils/helpers";

export default function ProjectSettings({ project }) {
    
    const dispatch = useDispatch();
    const { getToken } = useAuth();

    const { canManage, isLead } = useProjectAccess(project);
    const currentWorkspace = useSelector((state) => state.workspace.currentWorkspace);
    const leadUser = currentWorkspace?.members?.find((m) => m.user?.id === project.team_lead)?.user;
    const workers = getWorkers(project, currentWorkspace?.members);

    // Form starts with the project's real values
    const [formData, setFormData] = useState(project);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        toast.loading("Saving...");
        try {
            const { data } = await api.put(`/api/projects`, formData, { headers: { Authorization: `Bearer ${await getToken()}` } });
            setIsDialogOpen(false);
            dispatch(fetchWorkspaces({ getToken }));
            toast.dismissAll();
            toast.success(data.message);
        } catch (error) {
            toast.dismissAll();
            toast.error(error?.response?.data?.message || error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Reset the form only when the project changes or is saved (so background refresh does not erase typing)
    useEffect(() => {
        setFormData(project);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project.id, project.updatedAt]);

    const inputClasses = "w-full px-3 py-2 rounded mt-2 border text-sm dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-300";

    const cardClasses = "rounded-lg border p-6 not-dark:bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border-zinc-300 dark:border-zinc-800";

    const labelClasses = "text-sm text-zinc-600 dark:text-zinc-400";

    return (
        <div className="grid lg:grid-cols-2 gap-8">
            {/* Project Details */}
            <div className={cardClasses}>
                <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-300 mb-4">Project Details</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name */}
                    <div className="space-y-2">
                        <label className={labelClasses}>Project Name</label>
                        <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputClasses} required />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className={labelClasses}>Description</label>
                        <textarea value={formData.description || ""} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className={inputClasses + " h-24"} />
                    </div>

                    {/* Status & Priority */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className={labelClasses}>Status</label>
                            <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className={inputClasses} >
                                <option value="PLANNING">Planning</option>
                                <option value="ACTIVE">Active</option>
                                <option value="ON_HOLD">On Hold</option>
                                <option value="COMPLETED">Completed</option>
                                <option value="CANCELLED">Cancelled</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className={labelClasses}>Priority</label>
                            <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} className={inputClasses} >
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                            </select>
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="space-y-4 grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className={labelClasses}>Start Date</label>
                            <input type="date" value={toInputDate(formData.start_date)} onChange={(e) => setFormData({ ...formData, start_date: e.target.value || null })} className={inputClasses} />
                        </div>
                        <div className="space-y-2">
                            <label className={labelClasses}>End Date</label>
                            <input type="date" value={toInputDate(formData.end_date)} onChange={(e) => setFormData({ ...formData, end_date: e.target.value || null })} className={inputClasses} />
                        </div>
                    </div>

                    {/* Progress */}
                    <div className="space-y-2">
                        <label className={labelClasses}>Progress: {formData.progress}%</label>
                        <input type="range" min="0" max="100" step="5" value={formData.progress} onChange={(e) => setFormData({ ...formData, progress: Number(e.target.value) })} className="w-full accent-blue-500 dark:accent-blue-400" />
                    </div>

                    {/* Save Button */}
                    <button type="submit" disabled={isSubmitting || !canManage} className="ml-auto disabled:opacity-50 flex items-center text-sm justify-center gap-2 bg-gradient-to-br from-blue-500 to-blue-600 text-white px-4 py-2 rounded" >
                        <Save className="size-4" /> {isSubmitting ? "Saving..." : "Save Changes"}
                    </button>
                </form>
            </div>

            {/* Team Members */}
            <div className="space-y-6">
                <div className={cardClasses}>
                    <div className="flex items-center justify-between gap-4">
                        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-300 mb-4">
                            Team Members <span className="text-sm text-zinc-600 dark:text-zinc-400">({workers.length})</span>
                        </h2>
                        {isLead && (
                            <>
                                <button type="button" onClick={() => setIsDialogOpen(true)} className="p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800" >
                                    <Plus className="size-4 text-zinc-900 dark:text-zinc-300" />
                                </button>
                                <AddProjectMember isDialogOpen={isDialogOpen} setIsDialogOpen={setIsDialogOpen} />
                            </>
                        )}
                    </div>

                    {/* The lead (admin) is shown separately; the lead only manages, the members do the work */}
                    {leadUser && (
                        <div className="flex items-center justify-between px-3 py-2 rounded bg-blue-50 dark:bg-blue-500/10 text-sm text-zinc-900 dark:text-zinc-300">
                            <span>{leadUser.email}</span>
                            <span className="px-2 py-0.5 rounded-xs ring ring-zinc-200 dark:ring-zinc-600">Team Lead</span>
                        </div>
                    )}

                    {/* Member List */}
                    {workers.length > 0 ? (
                        <div className="space-y-2 mt-2 max-h-48 overflow-y-auto">
                            {workers.map((member) => (
                                <div key={member.user.id} className="flex items-center justify-between px-3 py-2 rounded dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-300" >
                                    <span>{member.user.email}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">No team members yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
