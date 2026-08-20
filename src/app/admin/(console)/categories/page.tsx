import { AdminPageHeader } from "@/components/admin/page-header";
import { CategoryManager } from "@/components/admin/category-manager";
import { requirePermission } from "@/lib/auth/guards";
import { getCategories } from "@/lib/auction/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Departments" };

export default async function AdminCategoriesPage() {
  await requirePermission("category.manage");
  const categories = await getCategories(true);

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Departments"
        description="Departments group the catalogue and define the specification fields each lot carries. Changing a department's fields changes the create-auction form and the public specifications table — no deploy needed."
      />

      <div className="mt-8 max-w-5xl">
        <CategoryManager
          categories={categories.map((category) => ({
            id: category.id,
            name: category.name,
            slug: category.slug,
            description: category.description,
            image: category.image,
            status: category.status,
            sortOrder: category.sortOrder,
            fieldSchema: category.fieldSchema,
            auctionCount: category._count.auctions,
          }))}
        />
      </div>
    </>
  );
}
