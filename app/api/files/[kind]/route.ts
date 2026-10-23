export async function GET() {
  return Response.json({ error: "File uploads are not used. Open the resume from its Google Drive link." }, { status: 410 });
}
