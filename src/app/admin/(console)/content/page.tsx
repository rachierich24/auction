import { AdminPageHeader } from "@/components/admin/page-header";
import { ContentEditor } from "@/components/admin/content-editor";
import { requirePermission } from "@/lib/auth/guards";
import { getAllContent } from "@/lib/content/site-content";

export const dynamic = "force-dynamic";
export const metadata = { title: "Site content" };

export default async function AdminContentPage() {
  await requirePermission("content.manage");
  const content = await getAllContent();

  return (
    <>
      <AdminPageHeader
        eyebrow="Marketing"
        title="Site content"
        description="Homepage copy, the announcement bar, the how-it-works steps and footer details. Changes go live immediately — no deploy required."
      />

      <div className="mt-8 max-w-4xl">
        <ContentEditor content={content} />
      </div>
    </>
  );
}
