import React from 'react';
import { useSearchParams } from '@/utilities/use-search-params';
import { Inbox, CheckCircle, Target, Layout } from 'lucide-react';

export const RevampSidebar = () => {
    const [searchParams] = useSearchParams();
    const completed = searchParams.get('completed') === 'true';

    const navItems = [
        { icon: Inbox, label: 'Tasks', active: !completed, href: '/' },
        { icon: CheckCircle, label: 'Completed', active: completed, href: '/?completed=true' },
    ];

    const navigate = (e: React.MouseEvent, href: string) => {
        e.preventDefault();
        window.history.pushState({}, '', href);
        window.dispatchEvent(new Event('popstate'));
    };

    return (
        <aside className="revamp-sidebar">
            <div className="flex items-center gap-2 mr-auto">
                <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                    <Target className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-lg font-black tracking-tight text-slate-900 ml-2">ZenDo</h1>
            </div>

            <nav className="flex items-center gap-1">
                {navItems.map((item) => (
                    <a
                        key={item.label}
                        href={item.href}
                        onClick={(e) => navigate(e, item.href)}
                        className={`nav-item ${item.active ? 'active' : ''}`}
                    >
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                    </a>
                ))}
            </nav>

            <div className="ml-auto flex items-center gap-4">
                <div className="hidden md:flex flex-col items-end">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Status</span>
                    <span className="text-xs font-bold text-indigo-600">Stable v2.5</span>
                </div>
            </div>
        </aside>
    );
};
