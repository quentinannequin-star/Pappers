import { ShaderAnimation } from "@/components/ui/shader-lines";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left side — Shader + branding */}
      <div className="relative hidden w-1/2 items-center justify-center overflow-hidden lg:flex">
        <ShaderAnimation />
        <div className="pointer-events-none z-10 flex flex-col items-center gap-4">
          <span className="text-center text-7xl font-bold tracking-tighter text-white">
            Screening OS
          </span>
          <span className="text-lg font-medium tracking-wide text-white/60">
            by Alvora Partners
          </span>
        </div>
      </div>
      {/* Right side — Form */}
      <div className="flex w-full items-center justify-center bg-white lg:w-1/2">
        <div className="w-full max-w-md px-8">{children}</div>
      </div>
    </div>
  );
}
