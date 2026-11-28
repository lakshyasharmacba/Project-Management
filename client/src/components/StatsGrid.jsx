import { FolderOpen, CheckCircle, Users, AlertTriangle } from "lucide-react";
import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useUser } from "@clerk/react";
import { isOverdue } from "../utils/helpers";

export default function StatsGrid() {
    const { user } = useUser();
    const currentWorkspace = useSelector((state) => state?.workspace?.currentWorkspace || null);

    // useMemo: recalculates only when the workspace changes (no effect or extra state needed)
    const stats = useMemo(() => {
        const projects = currentWorkspace?.projects || [];
        const tasks = projects.flatMap((p) => p.tasks);

        return {
            totalProjects: projects.length,
            completedProjects: projects.filter((p) => p.status === "COMPLETED").length,
            myTasks: tasks.filter((t) => t.assigneeId === user?.id).length,
            overdueIssues: tasks.filter(isOverdue).length,
        };
    }, [currentWorkspace, user?.id]);

    const statCards = [
        {
            icon: FolderOpen,
            title: "Total Projects",
            value: stats.totalProjects,
            subtitle: `projects in ${currentWorkspace?.name}`,
            bgColor: "bg-blue-500/10",
            textColor: "text-blue-500",
        },
        {
            icon: CheckCircle,
            title: "Completed Projects",
            value: stats.completedProjects,
            subtitle: `of ${stats.totalProjects} total`,
            bgColor: "bg-emerald-500/10",
            textColor: "text-emerald-500",
        },
        {
            icon: Users,
            title: "My Tasks",
            value: stats.myTasks,
            subtitle: "assigned to me",
            bgColor: "bg-purple-500/10",
            textColor: "text-purple-500",
        },
        {
            icon: AlertTriangle,
            title: "Overdue",
            value: stats.overdueIssues,
            subtitle: "need attention",
            bgColor: "bg-amber-500/10",
            textColor: "text-amber-500",
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 my-9">
            {statCards.map(({ icon: Icon, title, value, subtitle, bgColor, textColor }) => (
                <div key={title} className="bg-white dark:bg-zinc-950 dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition duration-200 rounded-md">
                    <div className="p-6 py-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">{title}</p>
                                <p className="text-3xl font-bold text-zinc-800 dark:text-white">{value}</p>
                                {subtitle && <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">{subtitle}</p>}
                            </div>
                            <div className={`p-3 rounded-xl ${bgColor} bg-opacity-20`}>
                                <Icon size={20} className={textColor} />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
