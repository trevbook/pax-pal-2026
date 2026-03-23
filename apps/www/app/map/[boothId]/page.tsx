export default async function BoothDetailPage({
  params,
}: {
  params: Promise<{ boothId: string }>;
}) {
  const { boothId } = await params;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Booth {boothId}</h1>
      <p className="mt-2 text-muted-foreground">Booth detail coming soon.</p>
    </div>
  );
}
