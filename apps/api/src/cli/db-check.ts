import { createApiBootstrapContext } from "../bootstrap";

async function main(): Promise<void> {
  const context = await createApiBootstrapContext();
  await context.close();
  process.stdout.write(
    `${JSON.stringify(
      {
        status: "ok",
        database: "connected",
      },
      null,
      2,
    )}\n`,
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
