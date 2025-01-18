import {
  cryptoWaitReady,
} from "https://deno.land/x/polkadot@0.2.45/util-crypto/mod.ts";
import { Keyring } from "https://deno.land/x/polkadot@0.2.45/keyring/mod.ts";
import { stringToU8a, u8aToHex } from "https://deno.land/x/polkadot@0.2.45/util/mod.ts";
import "jsr:@std/dotenv/load";
import { KeyringPair } from "https://deno.land/x/polkadot@0.2.45/keyring/types.ts";


// Store locally validation state
const state = {
  isValidated: false,
  isRegistered: false
};

let pair: KeyringPair  | null = null;
let providers_url: string  | null = null;
let healthstats_url: string  | null = null;

export async function signMessage(message: string) {

  if (!pair) {
    await setupWallet();
  }
  const signature = u8aToHex(pair.sign(stringToU8a(message)));
  return { signature, address: pair.address };
}

async function getSystemStats() {
  const stats = {
    cpu_usage: 0,
    memory_free: "0",
    disk_free: "0",
    docker_status: "unknown",
    running_containers: "0",
    unhealthy_containers: "0",
  };

  try {
    // CPU Usage
    const cmd = new Deno.Command("top", {
      args: ["-bn1"],
    });
    const { stdout } = await cmd.output();
    const output = new TextDecoder().decode(stdout);
    const cpuLine = output.split("\n").find((line) => line.includes("Cpu(s)"));
    if (cpuLine) {
      const matches = cpuLine.match(/(\d+\.\d+)/g);
      if (matches && matches.length >= 2) {
        stats.cpu_usage = parseFloat(matches[0]) + parseFloat(matches[1]);
      }
    }

    // Memory Free
    const memCmd = new Deno.Command("free", {
      args: ["-m"],
    });
    const { stdout: memStdout } = await memCmd.output();
    const memOutput = new TextDecoder().decode(memStdout);
    const memLine = memOutput.split("\n").find((line) =>
      line.startsWith("Mem:")
    );
    if (memLine) {
      const parts = memLine.split(/\s+/);
      stats.memory_free = parts[7] || "0";
    }

    // Disk Free
    const dfCmd = new Deno.Command("df", {
      args: ["-h", "/"],
    });
    const { stdout: dfStdout } = await dfCmd.output();
    const dfOutput = new TextDecoder().decode(dfStdout);
    const dfLine = dfOutput.split("\n")[1];
    if (dfLine) {
      const parts = dfLine.split(/\s+/);
      stats.disk_free = parts[3] || "0";
    }

    // Docker Status
    const dockerCmd = new Deno.Command("systemctl", {
      args: ["is-active", "docker"],
    });
    const { stdout: dockerStdout } = await dockerCmd.output();
    stats.docker_status = new TextDecoder().decode(dockerStdout).trim();

    // Running Containers
    const runningCmd = new Deno.Command("docker", {
      args: ["ps", "-q"],
    });
    const { stdout: runningStdout } = await runningCmd.output();
    const runningOutput = new TextDecoder().decode(runningStdout);
    stats.running_containers = runningOutput.trim().split("\n").filter(Boolean)
      .length.toString();

    // Unhealthy Containers
    const unhealthyCmd = new Deno.Command("docker", {
      args: ["ps", "--filter", "health=unhealthy", "-q"],
    });
    const { stdout: unhealthyStdout } = await unhealthyCmd.output();
    const unhealthyOutput = new TextDecoder().decode(unhealthyStdout);
    stats.unhealthy_containers = unhealthyOutput.trim().split("\n").filter(
      Boolean,
    ).length.toString();
  } catch (error) {
    console.error("❌ Error collecting system stats:", error);
  }

  return stats;
}

async function sendHealthCheck() {
  const stats = await getSystemStats();
  const message = JSON.stringify(stats);
  
  const signedMessage = await signMessage(message);

  try {
    const response = await fetch(healthstats_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        signature: signedMessage.signature,
        address: signedMessage.address,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorData}`);
    }

    const data = await response.json();
    console.log("✅ Health check sent successfully : ", data);
  } catch (error) {
    console.error("❌ Error sending health check : ", error);   
  }
}

// Initial Registration check
async function checkProviderRegistration() {
  
  if (!pair) {
    await cryptoWaitReady();
    const keyring = new Keyring();
    const mnemonic = Deno.env.get("MNEMONIC");
    pair = keyring.createFromUri(mnemonic);
  }

  try {
    const response = await fetch(`${providers_url}/${pair?.address}`);
    if (!response.ok) {
      console.error("❌ Provider Registration check failed:", response.status);
      return;
    }
    const data = await response.json();
    state.isRegistered = data.address ? true : false;
    console.log(`🔄 Provider registration status updated: ${state.isRegistered ? "validated" : "not validated"}`);
  } catch (error) {
    console.error("❌ Error checking provider registration:", error);
  }
}

async function checkProviderValidation() {

  try {
    const response = await fetch(`${providers_url}/${pair?.address}`);
    if (!response.ok) {
      console.error("❌ Provider Registration check failed:", response.status);
      return;
    }
    const data = await response.json();
    state.isValidated = data.address ? true : false;
    console.log(`🔄 Provider Validation status updated: ${state.isRegistered ? "validated" : "not validated"}`);
  } catch (error) {
    console.error("❌ Error checking provider registration:", error);
  }
}

async function setupWallet() {
  await cryptoWaitReady();
  const keyring = new Keyring();
  const mnemonic = Deno.env.get("MNEMONIC");
  pair = keyring.createFromUri(mnemonic);
 }

async function init() {
  await setupWallet();
  providers_url = Deno.env.get("PROVIDERS_URL");
  healthstats_url = Deno.env.get("HEALTHSTATS_URL");
}

// Run initialization, validation and health check
await init();
await checkProviderRegistration();
if (state.isRegistered) {
  await sendHealthCheck();
}

// Set up the cron job using stored validation state
//Deno.cron("Provider Healtchecks Cron","*/5 * * * *", async () => {
Deno.cron("Provider Healtchecks Cron","* * * * *", async () => {

  if (state.isValidated) {
    console.log("✅ Provider is validated. Running health check...");
    await sendHealthCheck();
  } else {
    console.log("⚠️ Provider is NOT validated. Skipping health check.");
    checkProviderValidation();
  }
});