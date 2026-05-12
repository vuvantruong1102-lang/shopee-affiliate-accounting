import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { GlobalSearchProvider } from "@/components/global-search/search-provider"
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Lấy profile để biết role
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={profile ?? { email: user.email, full_name: null, role: "viewer" }} />
        <main className="flex-1 overflow-auto scrollbar-thin">
          <div className="container mx-auto px-6 py-6 max-w-[1400px]">
            {children}
          </div>
        </main>
      </div>
      <GlobalSearchProvider />
    </div>
  );
}
