export default async function GameDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Game Detail</h1>
      <p className="mt-2 text-muted-foreground">Detail page for: {slug}</p>
    </div>
  );
}
