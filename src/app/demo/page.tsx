import type { Metadata } from "next";
import { PublicHeader } from "@/components/public-header";
import { DemoExperience } from "@/features/demo/demo-experience";

export const metadata: Metadata = {
  title: "Explore demo",
  description: "A signed-out sample of a Tamreen training week. Sample data only. The camera stays off.",
};

export default function DemoPage() {
  return (
    <div className="overflow-x-clip bg-paper text-ink">
      <PublicHeader current="demo" />
      <main id="content">
        <DemoExperience />
      </main>
    </div>
  );
}
