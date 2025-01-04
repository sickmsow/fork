import {
  cryptoWaitReady,
} from "https://deno.land/x/polkadot@0.2.45/util-crypto/mod.ts";
import { Keyring } from "https://deno.land/x/polkadot@0.2.45/keyring/mod.ts";
import { stringToU8a, u8aToHex } from "https://deno.land/x/polkadot@0.2.45/util/mod.ts";

export async function signMessage(message: string, mnemonic: string) {
  await cryptoWaitReady();
  const keyring = new Keyring();
  const pair = keyring.createFromUri(mnemonic);
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

async function main() {
  const stats = await getSystemStats();

  const message =
    `CPU Usage: ${stats.cpu_usage}, Memory Free: ${stats.memory_free}, ` +
    `Disk Free: ${stats.disk_free}, Docker Status: ${stats.docker_status}, ` +
    `Running Containers: ${stats.running_containers}, ` +
    `Unhealthy Containers: ${stats.unhealthy_containers}`;

  const MNEMONIC = Deno.env.get("MNEMONIC") || "";
  
  const baseUrl = Deno.env.get("HEALTH_CHECK_API") || "localhost:8000/sigverif";
  const HEALTH_CHECK_API = baseUrl.startsWith("http://") || baseUrl.startsWith("https://")
    ? baseUrl
    : `http://${baseUrl}`;

  const signedMessage = await signMessage(message, MNEMONIC);

  // Send health check
  try {
    const response = await fetch(HEALTH_CHECK_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...stats,
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
    if (error instanceof TypeError && error.message.includes("Url scheme")) {
      console.error("❌ Error: Invalid URL format. Please ensure HEALTH_CHECK_API includes http:// or https://");
    } else {
      console.error("❌ Error sending health check : ", error);
    }
  }
}

main().catch(console.error);
