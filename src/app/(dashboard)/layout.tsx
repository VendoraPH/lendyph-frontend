"use client";

// TODO: Re-enable auth guard and SessionProvider when backend API is ready
// import { useEffect } from "react";
// import { useRouter } from "next/navigation";
// import { SessionProvider } from "@/components/providers/session-provider";
// import { useAuth } from "@/hooks";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TODO: Re-enable when backend API is ready
  // const { isAuthenticated } = useAuth();
  // const router = useRouter();
  //
  // useEffect(() => {
  //   if (!isAuthenticated) {
  //     router.replace("/login");
  //   }
  // }, [isAuthenticated, router]);
  //
  // if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
