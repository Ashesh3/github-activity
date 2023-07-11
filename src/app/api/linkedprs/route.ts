import { parse } from "node-html-parser";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: "No url provided" }, { status: 400 });
    const response = await fetch(url);
    const data = await response.text();

    const root = parse(data);
    const linked_prs = root.querySelectorAll('form[action*="closing_references"] > div > span > a');
    const pr_links = linked_prs.map((e) => "https://github.com" + e.getAttribute("href"));

    return NextResponse.json(pr_links, { status: 200 });
  } catch (error) {
    console.error("Error fetching data:", error);
    return NextResponse.json({ error: error }, { status: 500 });
  }
}
