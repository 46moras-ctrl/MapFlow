import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <div className="ml-64">
        <Topbar />
        <main className="fade-in-up mx-auto w-full max-w-container px-12 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
