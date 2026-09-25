import { PageContainer } from "@/components/page/page";
import { PageSkeleton } from "@/components/feedback/states";

export default function Loading() {
  return (
    <PageContainer>
      <PageSkeleton />
    </PageContainer>
  );
}
