import { app } from "./provisioner.ts";
import { StatsCollector } from "./stats-collector.ts";

const sc = new StatsCollector();

await sc.init();

//Deno.serve({ port: 8000 }, app.fetch);
Deno.serve({ port: 8000, hostname: '0.0.0.0' }, app.fetch)

Deno.cron("Provider Healthchecks Cron", "* * * * *", async () => {
  if (sc.getState().isValidated) {
    console.log("✅ Provider is validated. Running health check...");
    await sc.sendHealthCheck();
  } else {
    console.log("⚠️ Provider is NOT validated. Skipping health check.");
    await sc.checkProviderValidation();
  }
});
