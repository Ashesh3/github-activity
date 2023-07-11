"use client"

import './globals.css'
import { useState } from "react";
import { createCache, extractStyle, StyleProvider } from "@ant-design/cssinjs";
import { useServerInsertedHTML } from "next/navigation";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>GitHub Activity Report</title>
        <meta name="description" content="Generate a report of your GitHub activity" />

      </head>
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
