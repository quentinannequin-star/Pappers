import { Header } from "@/components/layout/header";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <Header />
      <main>{children}</main>
    </div>
  );
}
