import { useState } from "react";
import { Link } from "react-router-dom";
import { EllipsisVertical, Trash2 } from "lucide-react";
import useProjectAccess from "../hooks/useProjectAccess";
import useDeleteProject from "../hooks/useDeleteProject";

const statusColors = {
    PLANNING: "bg-gray-200 dark:bg-zinc-600 text-gray-900 dark:text-zinc-200",
    ACTIVE: "bg-emerald-200 dark:bg-emerald-500 text-emerald-900 dark:text-emerald-900",
    ON_HOLD: "bg-amber-200 dark:bg-amber-500 text-amber-900 dark:text-amber-900",
    COMPLETED: "bg-blue-200 dark:bg-blue-500 text-blue-900 dark:text-blue-900",
    CANCELLED: "bg-red-200 dark:bg-red-500 text-red-900 dark:text-red-900",
};

const ProjectCard = ({ project }) => {
    const { canManage } = useProjectAccess(project);
    const deleteProject = useDeleteProject();
    const [menuOpen, setMenuOpen] = useState(false);

    // The card is a Link, so stop the click from opening the project
    const stop = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDelete = async (e) => {
        stop(e);
        setMenuOpen(false);
        await deleteProject(project);
    };

    return (
        <Link to={`/projects/${project.id}?tab=tasks`} className="bg-white dark:bg-zinc-950 dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 rounded-lg p-5 transition-all duration-200 group">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-zinc-200 mb-1 truncate group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                        {project.name}
                    </h3>
                    <p className="text-gray-500 dark:text-zinc-400 text-sm line-clamp-2 mb-3">
                        {project.description || "No description"}
                    </p>
                </div>

                {/* Three dots menu (lead / admin only) */}
                {canManage && (
                    <div className="relative">
                        <button
                            type="button"
                            aria-label="Project options"
                            onClick={(e) => { stop(e); setMenuOpen((open) => !open); }}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400"
                        >
                            <EllipsisVertical className="size-4" />
                        </button>

                        {menuOpen && (
                            <>
                                {/* Click outside to close */}
                                <div className="fixed inset-0 z-10" onClick={(e) => { stop(e); setMenuOpen(false); }} />
                                <div className="absolute right-0 top-8 z-20 w-40 rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1">
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
                                    >
                                        <Trash2 className="size-4" /> Delete project
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between mb-4">
                <span className={`px-2 py-0.5 rounded text-xs ${statusColors[project.status]}`} >
                    {project.status.replace("_", " ")}
                </span>
                <span className="text-xs text-gray-500 dark:text-zinc-500 capitalize">
                    {project.priority} priority
                </span>
            </div>

            {/* Progress */}
            <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-zinc-500">Progress</span>
                    <span className="text-gray-400 dark:text-zinc-400">{project.progress || 0}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-zinc-800 h-1.5 rounded">
                    <div className="h-1.5 rounded bg-blue-500" style={{ width: `${project.progress || 0}%` }} />
                </div>
            </div>

            </Link>
    );
};

export default ProjectCard;
