import {
  cryptoWaitReady,
} from "https://deno.land/x/polkadot@0.2.45/util-crypto/mod.ts";
import { Keyring } from "https://deno.land/x/polkadot@0.2.45/keyring/mod.ts";
import {
  stringToU8a,
  u8aToHex,
} from "https://deno.land/x/polkadot@0.2.45/util/mod.ts";
import "jsr:@std/dotenv/load";
import { KeyringPair } from "https://deno.land/x/polkadot@0.2.45/keyring/types.ts";

const state = {
  isValidated: false,
  isRegistered: false,
};

let pair: KeyringPair | null = null;
const providers_url: string = "http://localhost:8000/kumulus/providers";
const healthstats_url: string = "http://localhost:8000/kumulus/healthstats";

async function setupWallet() {
  await cryptoWaitReady();
  const keyring = new Keyring();
  const mnemonic = Deno.env.get("MNEMONIC");

  if (!mnemonic) {
    throw new Error("MNEMONIC environment variable is not set.");
  }

  pair = keyring.createFromUri(mnemonic);
}

export async function signMessage(message: string) {
  if (!pair) {
    await setupWallet();
  }
  if (!pair) {
    throw new Error("Wallet is not set up properly.");
  }
  const signature = u8aToHex(pair.sign(stringToU8a(message)));
  return { signature, address: pair.address };
}

async function checkDockerStatus(): Promise<{
  status: string;
  runningContainers: string;
  unhealthyContainers: string;
}> {
  try {
    // Try to list containers as a simple check
    const dockerPsCmd = new Deno.Command("docker", {
      args: ["ps", "--format", "{{.ID}}"],
      stdout: "piped",
      stderr: "piped",
    });

    const dockerPsProcess = await dockerPsCmd.output();

    if (!dockerPsProcess.success) {
      console.error(
        "Docker ps command failed:",
        new TextDecoder().decode(dockerPsProcess.stderr),
      );
      return {
        status: "not running",
        runningContainers: "0",
        unhealthyContainers: "0",
      };
    }

    const runningContainers = new TextDecoder()
      .decode(dockerPsProcess.stdout)
      .trim()
      .split("\n")
      .filter((line) => line.length > 0)
      .length
      .toString();

    // Check for unhealthy containers
    const unhealthyCmd = new Deno.Command("docker", {
      args: ["ps", "--filter", "health=unhealthy", "--format", "{{.ID}}"],
      stdout: "piped",
    });

    const unhealthyProcess = await unhealthyCmd.output();
    const unhealthyContainers = unhealthyProcess.success
      ? new TextDecoder()
        .decode(unhealthyProcess.stdout)
        .trim()
        .split("\n")
        .filter((line) => line.length > 0)
        .length
        .toString()
      : "0";

    return {
      status: "running",
      runningContainers,
      unhealthyContainers,
    };
  } catch (error) {
    console.error("Error checking Docker status:", error);
    return {
      status: "unknown",
      runningContainers: "0",
      unhealthyContainers: "0",
    };
  }
}

async function getSystemStats() {
  const now = new Date();

  const stats = {
    cpu_usage: 0,
    memory_free: "0 MB",
    disk_free: "0 GB",
    docker_status: "unknown",
    running_containers: "0",
    unhealthy_containers: "0",
    timestamp_unix: Math.floor(now.getTime() / 1000), // Unix timestamp
    timestamp_human: now.toISOString(), // ISO 8601 formatted time
  };

  try {
    // 1️⃣ Get CPU Usage
    const cpuCmd = new Deno.Command("top", { args: ["-bn1"], stdout: "piped" });
    const cpuProcess = await cpuCmd.output();
    if (cpuProcess.success) {
      const output = new TextDecoder().decode(cpuProcess.stdout);
      const cpuLine = output.split("\n").find((line) =>
        line.includes("Cpu(s)")
      );
      if (cpuLine) {
        const matches = cpuLine.match(/(\d+\.\d+)/g);
        if (matches && matches.length >= 2) {
          stats.cpu_usage = parseFloat(matches[0]) + parseFloat(matches[1]);
        }
      }
    } else {
      console.error("❌ Failed to get CPU usage.");
    }

    // 2️⃣ Get Free Memory
    const memCmd = new Deno.Command("free", { args: ["-m"], stdout: "piped" });
    const memProcess = await memCmd.output();
    if (memProcess.success) {
      const output = new TextDecoder().decode(memProcess.stdout);
      const lines = output.split("\n");
      if (lines.length > 1) {
        const memValues = lines[1].split(/\s+/);
        if (memValues.length > 3) {
          stats.memory_free = `${memValues[3]} MB`;
        }
      }
    } else {
      console.error("❌ Failed to get memory stats.");
    }

    // 3️⃣ Get Free Disk Space
    const diskCmd = new Deno.Command("df", {
      args: ["-h", "/"],
      stdout: "piped",
    });
    const diskProcess = await diskCmd.output();
    if (diskProcess.success) {
      const output = new TextDecoder().decode(diskProcess.stdout);
      const lines = output.split("\n");
      if (lines.length > 1) {
        const diskValues = lines[1].split(/\s+/);
        if (diskValues.length > 3) {
          stats.disk_free = diskValues[3]; // Available disk space
        }
      }
    } else {
      console.error("❌ Failed to get disk space.");
    }

    // 4️⃣ Check Docker Status
    // Get Docker status
    const dockerStats = await checkDockerStatus();
    stats.docker_status = dockerStats.status;
    stats.running_containers = dockerStats.runningContainers;
    stats.unhealthy_containers = dockerStats.unhealthyContainers;
  } catch (error) {
    console.error("❌ Error collecting system stats:", error);
  }

  return stats;
}

async function sendHealthCheck() {
  if (!healthstats_url) {
    throw new Error("Health stats URL is not set.");
  }

  const stats = await getSystemStats();
  const message = JSON.stringify(stats);
  const signedMessage = await signMessage(message);
  /*
  console.log("Message : ",message);
  console.log("Signed Message : ",signedMessage);
  */

  try {
    const response = await fetch(healthstats_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        signature: signedMessage.signature,
        address: signedMessage.address,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, body: ${errorData}`,
      );
    }

    console.log("✅ Health check sent successfully");
  } catch (error) {
    console.error("❌ Error sending health check:", error);
  }
}

async function checkProviderRegistration() {
  if (!pair) {
    await setupWallet();
  }
  if (!providers_url) {
    throw new Error("Providers URL is not set.");
  }

  try {
    const response = await fetch(`${providers_url}/${pair?.address}`);
    if (!response.ok) {
      console.error("❌ Provider Registration check failed:", response.status);
      return;
    }
    const data = await response.json();
    state.isRegistered = data.address ? true : false;
    console.log(
      `🔄 Provider registration status: ${
        state.isRegistered ? "validated" : "not validated"
      }`,
    );
  } catch (error) {
    console.error("❌ Error checking provider registration:", error);
  }
}

async function checkProviderValidation() {
  try {
    const response = await fetch(`${providers_url}/${pair?.address}`);
    if (!response.ok) {
      console.error("❌ Provider Validation check failed:", response.status);
      return;
    }
    const data = await response.json();
    state.isValidated = !!data.address;
    console.log(
      `🔄 Provider Validation status: ${
        state.isValidated ? "validated" : "not validated"
      }`,
    );
  } catch (error) {
    console.error("❌ Error checking provider validation:", error);
  }
}

async function init() {
  await setupWallet();
  await checkProviderRegistration();
  if (state.isRegistered) {
    await sendHealthCheck();
  }
}

await init();

Deno.cron("Provider Healthchecks Cron", "* * * * *", async () => {
  if (state.isValidated) {
    console.log("✅ Provider is validated. Running health check...");
    await sendHealthCheck();
  } else {
    console.log("⚠️ Provider is NOT validated. Skipping health check.");
    await checkProviderValidation();
  }
});
