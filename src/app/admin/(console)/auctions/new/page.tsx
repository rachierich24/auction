import { AdminPageHeader } from "@/components/admin/page-header";
import { AuctionForm } from "@/components/admin/auction-form";
import { emptyAuctionValues } from "@/lib/admin/auction-form-values";
import { requirePermission } from "@/lib/auth/guards";
import { listCategoriesForForm, suggestLotNumber } from "@/app/actions/admin/auctions";

export const dynamic = "force-dynamic";
export const metadata = { title: "New auction" };

export default async function NewAuctionPage() {
  await requirePermission("auction.create");

  const [categories, lotNumber] = await Promise.all([
    listCategoriesForForm(),
    suggestLotNumber(),
  ]);

  return (
    <>
      <AdminPageHeader
        crumbs={[
          { label: "Auctions", href: "/admin/auctions" },
          { label: "New auction" },
        ]}
        eyebrow="Catalogue"
        title="Create an auction"
        description="The lot is created as a draft. Nothing is visible on the public site until you publish it."
      />

      <div className="mt-8 max-w-4xl">
        <AuctionForm
          mode="create"
          categories={categories}
          initial={emptyAuctionValues(lotNumber)}
        />
      </div>
    </>
  );
}
