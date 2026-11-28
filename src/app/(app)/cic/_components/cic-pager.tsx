import { TablePagination } from "@/components/common/table-pagination";
import type { usePagedResource } from "../_hooks/use-paged-resource";

type Pager = ReturnType<typeof usePagedResource>["pager"];

/** Previous and next under a CIC list, on the server's own pages. */
export function CicPager({ pager, total }: { pager: Pager; total: number }) {
  return (
    <TablePagination
      page={pager.page}
      perPage={pager.perPage}
      total={total}
      perPageOptions={pager.perPageOptions}
      onPageChange={pager.setPage}
      onPerPageChange={pager.setPerPage}
    />
  );
}
