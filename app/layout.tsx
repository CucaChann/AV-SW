import "./globals.css";

export const metadata = {
  title: "AV-SW",
  description: "Design-first AV, lighting, networking and automation platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
