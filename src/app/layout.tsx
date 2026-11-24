import type { Metadata, Viewport } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
// Global toast layer (module-store based, so any handler can push a toast —
// the old hook-based shadcn toaster required useToast() per component and
// was effectively never wired up). Mounted here to cover public, auth and
// workspace routes alike.
import { Toaster } from "@/components/platform/toaster";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: {
    default: "Luxury Trust Homes — Property with Legal Confidence",
    template: "%s | Luxury Trust Homes",
  },
  description:
    "Explore properties for sale and rent in Lagos and Enugu, with enquiries and transactions coordinated through our legal team.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Font variables live on <html> (not <body>) because Tailwind's
    // preflight sets font-family at the html level — otherwise the var()
    // chain resolves empty and everything falls back to ui-sans-serif.
    <html lang="en" className={`${dmSans.variable} ${dmSerif.variable}`}>
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
