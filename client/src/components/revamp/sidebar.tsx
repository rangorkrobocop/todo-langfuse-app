import React from 'react';
import { useSearchParams } from '@/utilities/use-search-params';
import { Inbox, CheckCircle, Settings, HelpCircle, Layout } from 'lucide-react';

/**
 * Application Sidebar Navigation.
 * Handles view switching between Incomplete and Completed tasks.
 */
export const RevampSidebar = () => {
    const [searchParams] = useSearchParams();
    const completed = searchParams.get('completed') === 'true';

    const navItems = [
        { icon: Inbox, label: 'Incomplete', active: !completed, href: '/' },
        { icon: CheckCircle, label: 'Completed', active: completed, href: '/?completed=true' },
    ];

    return (
        <aside className="revamp-sidebar">
            <div className="flex items-center gap-3 mb-10 px-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.4)]">
                    <Layout className="text-white w-5 h-5" />
                </div>
                <span className="font-black text-lg tracking-tight">BusyBee</span>
            </div>

            <nav className="flex-1 space-y-1">
                {navItems.map((item) => (
                    <a
                        key={item.label}
                        href={item.href}
                        onClick={(e) => {
                            e.preventDefault();
                            window.history.pushState({}, '', item.href);
                            window.dispatchEvent(new Event('popstate'));
                        }}
                        className={`nav-item ${item.active ? 'active' : ''}`}
                    >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                    </a>
                ))}
            </nav>

            <div className="mt-auto pt-6 border-t border-[var(--border-line)] space-y-1">
                <a href="#" className="nav-item"><HelpCircle className="w-4 h-4" /> Help Center</a>
                <a href="#" className="nav-item"><Settings className="w-4 h-4" /> Settings</a>
            </div>
        </aside>
    );
};
