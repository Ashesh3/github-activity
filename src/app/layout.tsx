"use client";

import './globals.css'
import type { Metadata } from 'next'
import { useState } from "react";
import { createCache, extractStyle, StyleProvider } from "@ant-design/cssinjs";
import { useServerInsertedHTML } from "next/navigation";

export const metadata: Metadata = {
  title: 'GitHub Activity Report',
  description: 'Generate a report of your GitHub activity',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head />
      <body>
        <StyleProviderLayout>{children}</StyleProviderLayout>
      </body>
    </html>
  );
}

function StyleProviderLayout({ children }: { children: React.ReactNode }) {
  const [cache] = useState(() => createCache());

  const render = <>{children}</>;

  useServerInsertedHTML(() => {
    return <script
        dangerouslySetInnerHTML={{
          __html: `</script>${extractStyle(cache)}<script>`,
        }}
      />;
  });

  if (typeof window !== "undefined") {
    return render;
  }

  return <StyleProvider cache={cache}>{render}</StyleProvider>;
}
