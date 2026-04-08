import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  "http://localhost:3000";

export const metadata: Metadata = {
  title: "A&R Finder",
  description: "Find your perfect apartment or roommate",
  metadataBase: new URL(APP_URL),
  openGraph: {
    title: "A&R Finder",
    description: "Find your perfect apartment or roommate",
    url: APP_URL,
    siteName: "A&R Finder",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "A&R Finder",
    description: "Find your perfect apartment or roommate",
  },
  appleWebApp: {
    title: "A&R Finder",
    capable: true,
    statusBarStyle: "black-translucent",
  },
};

// Prevent iOS Safari from zooming in when the user taps a form field
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ConvexClientProvider>
          <ThemeProvider>
            <AuthProvider>
              {children}
              <Toaster richColors position="top-right" closeButton duration={5000} />
            </AuthProvider>
          </ThemeProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
